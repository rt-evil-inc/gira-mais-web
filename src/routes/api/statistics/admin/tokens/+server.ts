import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { integrityTokens } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

const initialDate = new Date(env.INITIAL_DATE || '2025-04-27');

export const GET: RequestHandler = async ({ url }) => {
	let startDate = url.searchParams.get('start');
	if (!startDate || Date.parse(startDate) < initialDate.getTime()) {
		startDate = initialDate.toISOString();
	} else {
		startDate = new Date(Date.parse(startDate)).toISOString();
	}
	let endDate = url.searchParams.get('end');
	if (!endDate || Date.parse(endDate) > (new Date).getTime()) {
		endDate = (new Date).toISOString();
	} else {
		endDate = new Date(Date.parse(endDate)).toISOString();
	}
	const groupBy = url.searchParams.get('groupBy') || 'day'; // hour, day, total

	try {
		if (groupBy === 'total') {
			// Get total available tokens in the given time range
			// Available tokens are those that are not expired and not assigned
			const totalQuery = await db
				.select({
					count: sql<number>`COUNT(*)`,
				})
				.from(integrityTokens)
				.where(
					sql`${integrityTokens.createdAt} >= ${startDate} 
						AND ${integrityTokens.createdAt} < ${endDate}
						AND ${integrityTokens.expiresAt} > NOW()
						AND (${integrityTokens.assignedTo} = '' OR ${integrityTokens.assignedTo} IS NULL)`,
				);

			const totalCount = totalQuery[0]?.count || 0;
			return json({
				data: totalCount,
				meta: { startDate, endDate, groupBy },
			});
		}

		// For continuous tracking, we'll create events for token creation and expiry
		// Then calculate cumulative available tokens over time
		const eventsQuery = await db.execute(sql`
			WITH token_events AS (
				-- Token creation events (tokens become available)
				SELECT 
					created_at AS event_time,
					1 AS change_amount,
					'created' AS event_type,
					id
				FROM "integrity_tokens"
				WHERE 
					created_at >= ${startDate} AND created_at <= ${endDate}
				
				UNION ALL
				
				-- Token expiry events (tokens become unavailable)
				SELECT 
					expires_at AS event_time,
					-1 AS change_amount,
					'expired' AS event_type,
					id
				FROM "integrity_tokens"
				WHERE 
					expires_at >= ${startDate} AND expires_at <= ${endDate}
					AND created_at < expires_at -- Only count tokens that were actually created before expiring
				
				UNION ALL
				
				-- Token assignment events (tokens become unavailable)
				SELECT 
					assigned_at AS event_time,
					-1 AS change_amount,
					'assigned' AS event_type,
					id
				FROM "integrity_tokens"
				WHERE 
					assigned_at >= ${startDate} AND assigned_at <= ${endDate}
					AND assigned_at IS NOT NULL
					AND (assigned_to != '' AND assigned_to IS NOT NULL)
					AND created_at < assigned_at -- Only count tokens that were created before being assigned
			),
			-- Get initial count of available tokens at the start date
			initial_count AS (
				SELECT COUNT(*) as initial_available
				FROM "integrity_tokens"
				WHERE 
					created_at < ${startDate}
					AND expires_at > ${startDate}::timestamp
					AND (assigned_to = '' OR assigned_to IS NULL OR assigned_at > ${startDate}::timestamp)
			),
			ordered_events AS (
				SELECT 
					event_time,
					change_amount,
					event_type,
					id,
					SUM(change_amount) OVER (ORDER BY event_time, id) AS cumulative_change
				FROM token_events
				WHERE event_time IS NOT NULL
				ORDER BY event_time, id
			),
			events_with_total AS (
				SELECT 
					event_time,
					change_amount,
					event_type,
					id,
					(SELECT initial_available FROM initial_count) + cumulative_change AS running_total
				FROM ordered_events
			),
			-- Sample events by minute if there are too many
			sampled_events AS (
				SELECT DISTINCT ON (DATE_TRUNC('minute', event_time))
					to_char(event_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
					LAST_VALUE(running_total) OVER (
						PARTITION BY DATE_TRUNC('minute', event_time) 
						ORDER BY event_time, id
						ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
					) AS count
				FROM events_with_total
			)
			-- Add initial point at start date if we have data
			SELECT timestamp, count FROM (
				SELECT 
					to_char(${startDate}::timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
					(SELECT initial_available FROM initial_count) AS count
				WHERE EXISTS (SELECT 1 FROM token_events LIMIT 1)
				
				UNION ALL
				
				SELECT timestamp, count FROM sampled_events
			) combined_data
			ORDER BY timestamp
		`);

		// Format the results
		const results = eventsQuery.map(row => ({
			timestamp: row.timestamp,
			count: Math.max(0, Number(row.count)), // Ensure count doesn't go negative
		}));

		return json({
			data: results,
			meta: { startDate, endDate, groupBy },
		});
	} catch (err) {
		console.error('Error fetching token statistics data:', err);
		throw error(500, { message: 'Failed to fetch token statistics data' });
	}
};
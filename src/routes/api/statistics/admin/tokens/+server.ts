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
			// For short-lived tokens, show total created in time range instead of currently available
			// Since tokens expire in 1 hour, "available" count is mostly meaningless for historical data
			const totalQuery = await db
				.select({
					count: sql<number>`COUNT(*)`,
				})
				.from(integrityTokens)
				.where(
					sql`${integrityTokens.createdAt} >= ${startDate} 
						AND ${integrityTokens.createdAt} < ${endDate}`,
				);

			const totalCount = totalQuery[0]?.count || 0;
			return json({
				data: totalCount,
				meta: { startDate, endDate, groupBy },
			});
		}

		// Calculate tokens available at each time point
		// A token is available from created_at until either assigned_at or created_at + 1 hour
		let eventsQuery;

		if (groupBy === 'hour') {
			eventsQuery = await db.execute(sql`
				WITH time_series AS (
					SELECT generate_series(
						DATE_TRUNC('hour', ${startDate}::timestamp) + 
						(EXTRACT(MINUTE FROM ${startDate}::timestamp)::int / 15) * INTERVAL '15 minutes',
						DATE_TRUNC('hour', ${endDate}::timestamp) + 
						(EXTRACT(MINUTE FROM ${endDate}::timestamp)::int / 15) * INTERVAL '15 minutes',
						'15 minutes'::interval
					) AS time_bucket
				),
				available_tokens AS (
					SELECT 
						ts.time_bucket,
						COUNT(*) as available_count
					FROM time_series ts
					CROSS JOIN "integrity_tokens" it
					WHERE 
						-- Token was created before this time bucket
						it.created_at <= ts.time_bucket
						-- Token is still available at this time bucket
						AND (
							-- Either not assigned yet and hasn't expired (1 hour after creation)
							(
								(it.assigned_to IS NULL OR it.assigned_to = '') 
								AND it.created_at + INTERVAL '1 hour' > ts.time_bucket
							)
							-- Or was assigned after this time bucket
							OR (
								it.assigned_at IS NOT NULL 
								AND it.assigned_at > ts.time_bucket
							)
						)
						-- Token was created before the end of our query range
						AND it.created_at <= ${endDate}::timestamp
					GROUP BY ts.time_bucket
				)
				SELECT
					to_char(ts.time_bucket AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
					COALESCE(at.available_count, 0) AS available_tokens
				FROM time_series ts
				LEFT JOIN available_tokens at ON ts.time_bucket = at.time_bucket
				ORDER BY ts.time_bucket
			`);
		} else {
			eventsQuery = await db.execute(sql`
				WITH time_series AS (
					SELECT generate_series(
						DATE_TRUNC('day', ${startDate}::timestamp),
						DATE_TRUNC('day', ${endDate}::timestamp),
						'1 day'::interval
					) AS time_bucket
				),
				available_tokens AS (
					SELECT 
						ts.time_bucket,
						COUNT(*) as available_count
					FROM time_series ts
					CROSS JOIN "integrity_tokens" it
					WHERE 
						-- Token was created before this time bucket
						it.created_at <= ts.time_bucket
						-- Token is still available at this time bucket
						AND (
							-- Either not assigned yet and hasn't expired (1 hour after creation)
							(
								(it.assigned_to IS NULL OR it.assigned_to = '') 
								AND it.created_at + INTERVAL '1 hour' > ts.time_bucket
							)
							-- Or was assigned after this time bucket
							OR (
								it.assigned_at IS NOT NULL 
								AND it.assigned_at > ts.time_bucket
							)
						)
						-- Token was created before the end of our query range
						AND it.created_at <= ${endDate}::timestamp
					GROUP BY ts.time_bucket
				)
				SELECT
					to_char(ts.time_bucket AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
					COALESCE(at.available_count, 0) AS available_tokens
				FROM time_series ts
				LEFT JOIN available_tokens at ON ts.time_bucket = at.time_bucket
				ORDER BY ts.time_bucket
			`);
		}

		// Format the results - now showing available tokens over time
		const results = eventsQuery.map(row => ({
			timestamp: row.timestamp,
			available_tokens: Number(row.available_tokens),
			// For backward compatibility, use available_tokens as the main "count"
			count: Number(row.available_tokens),
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
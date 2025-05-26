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

		// For tokens that expire in 1 hour, showing "available over time" is misleading
		// Instead, show token creation rate and assignment rate over time
		let eventsQuery;

		if (groupBy === 'hour') {
			eventsQuery = await db.execute(sql`
				WITH time_series AS (
					SELECT generate_series(
						DATE_TRUNC('hour', ${startDate}::timestamp),
						DATE_TRUNC('hour', ${endDate}::timestamp),
						'1 hour'::interval
					) AS time_bucket
				),
				token_stats AS (
					SELECT
						DATE_TRUNC('hour', created_at) AS time_bucket,
						COUNT(*) as tokens_created,
						COUNT(CASE WHEN assigned_to IS NOT NULL AND assigned_to != '' THEN 1 END) as tokens_assigned
					FROM "integrity_tokens"
					WHERE
						created_at >= ${startDate} AND created_at <= ${endDate}
					GROUP BY DATE_TRUNC('hour', created_at)
				)
				SELECT
					to_char(ts.time_bucket AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
					COALESCE(stats.tokens_created, 0) AS tokens_created,
					COALESCE(stats.tokens_assigned, 0) AS tokens_assigned,
					COALESCE(stats.tokens_created, 0) - COALESCE(stats.tokens_assigned, 0) AS tokens_unused
				FROM time_series ts
				LEFT JOIN token_stats stats ON ts.time_bucket = stats.time_bucket
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
				token_stats AS (
					SELECT
						DATE_TRUNC('day', created_at) AS time_bucket,
						COUNT(*) as tokens_created,
						COUNT(CASE WHEN assigned_to IS NOT NULL AND assigned_to != '' THEN 1 END) as tokens_assigned
					FROM "integrity_tokens"
					WHERE
						created_at >= ${startDate} AND created_at <= ${endDate}
					GROUP BY DATE_TRUNC('day', created_at)
				)
				SELECT
					to_char(ts.time_bucket AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
					COALESCE(stats.tokens_created, 0) AS tokens_created,
					COALESCE(stats.tokens_assigned, 0) AS tokens_assigned,
					COALESCE(stats.tokens_created, 0) - COALESCE(stats.tokens_assigned, 0) AS tokens_unused
				FROM time_series ts
				LEFT JOIN token_stats stats ON ts.time_bucket = stats.time_bucket
				ORDER BY ts.time_bucket
			`);
		}

		// Format the results - now showing creation/assignment patterns instead of "available"
		const results = eventsQuery.map(row => ({
			timestamp: row.timestamp,
			tokens_created: Number(row.tokens_created),
			tokens_assigned: Number(row.tokens_assigned),
			tokens_unused: Number(row.tokens_unused),
			// For backward compatibility, use tokens_created as the main "count"
			count: Number(row.tokens_created),
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
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { errors } from '$lib/server/db/schema';
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
	const timezone = url.searchParams.get('timezone') || 'UTC';
	const errorCodes = url.searchParams.getAll('errorCodes');
	const versions = url.searchParams.getAll('versions');

	try {
		let whereClause = sql`${errors.timestamp} >= ${startDate} AND ${errors.timestamp} < ${endDate}`;

		if (errorCodes.length > 0) {
			whereClause = sql`${whereClause} AND ${errors.errorCode} IN ${errorCodes}`;
		}

		if (versions.length > 0) {
			const versionClauses = versions.map(version => sql`${errors.userAgent} LIKE ${`Gira+/${version}%`}`);
			whereClause = sql`${whereClause} AND (${sql.join(versionClauses, sql` OR `)})`;
		}

		if (groupBy === 'total') {
			// Get total errors in the given time range
			const totalQuery = await db
				.select({
					count: sql<number>`COUNT(*)`,
				})
				.from(errors)
				.where(whereClause);

			const totalCount = totalQuery[0]?.count || 0;
			return json({
				data: totalCount,
				meta: { startDate, endDate, groupBy, timezone },
			});
		}

		// For hour or day grouping
		let truncateFormat: string;
		let intervalUnit: string;

		if (groupBy === 'hour') {
			truncateFormat = 'hour';
			intervalUnit = '1 hour';
		} else {
			truncateFormat = 'day';
			intervalUnit = '1 day';
		}

		// Generate series of timestamps from start to end date and join with actual data
		const seriesQuery = await db.execute(sql`
      WITH series AS (
        SELECT generate_series(
          DATE_TRUNC(${truncateFormat}, ${startDate}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}),
          DATE_TRUNC(${truncateFormat}, ${endDate}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}),
          ${intervalUnit}::interval
        ) AS time_point
      ),
      counts AS (
        SELECT 
          DATE_TRUNC(${truncateFormat}, e.timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) AS grouped_time,
          COUNT(*) AS error_count
        FROM 
          "errors" AS e
        WHERE
          e.timestamp >= ${startDate} AND e.timestamp < ${endDate}
          ${errorCodes.length > 0 ? sql`AND e.error_code IN ${errorCodes}` : sql``}
          ${versions.length > 0 ? sql`AND (${sql.join(versions.map(version => sql`e.user_agent LIKE ${`Gira+/${version}%`}`), sql` OR `)})` : sql``}
        GROUP BY
          grouped_time
      )
      SELECT 
        to_char(series.time_point AT TIME ZONE ${timezone}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
        COALESCE(counts.error_count, 0) AS count
      FROM 
        series
      LEFT JOIN counts ON series.time_point = counts.grouped_time
      ORDER BY 
        series.time_point
    `);

		// Format the results
		const results = seriesQuery.map(row => ({
			timestamp: row.timestamp,
			count: Number(row.count),
		}));

		return json({
			data: results,
			meta: { startDate, endDate, groupBy, timezone },
		});
	} catch (err) {
		console.error('Error fetching error statistics data:', err);
		throw error(500, { message: 'Failed to fetch error statistics data' });
	}
};
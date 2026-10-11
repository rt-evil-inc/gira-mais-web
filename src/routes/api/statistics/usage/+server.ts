import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { usage } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { cacheKey, cachedResponse } from '$lib/server/cache';

export const POST: RequestHandler = async ({ request }) => {
	// Parse request body
	const body = await request.json();

	// Validate required fields
	if (!body.deviceId) {
		throw error(400, { message: 'deviceId is required' });
	}
	if (!request.headers.get('user-agent')?.startsWith('Gira+')) {
		throw error(400, { message: 'invalid user-agent' });
	}

	try {
		// Store statistics event in database
		await db.insert(usage).values({
			deviceId: body.deviceId,
			appVersion: body.appVersion,
			os: body.os,
			osVersion: body.osVersion,
			// timestamp will be automatically set to current time
		});

		// Return success response with message
		return json({
			success: true,
		});
	} catch (err) {
		console.error('Error handling statistics request:', err);
		throw error(500, { message: 'An unknown error occurred' });
	}
};

const initialDate = new Date(env.INITIAL_DATE || '2025-04-27');
const CACHE_MS = 60_000;
/** The parameters the response depends on; others don't make new cache entries. */
const CACHE_PARAMS = ['start', 'end', 'groupBy', 'timezone'];

// Every visitor of the statistics page asks for the same figures; one computation a minute serves them all.
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	setHeaders({ 'Cache-Control': 'public, max-age=60' });
	return cachedResponse(cacheKey(url, CACHE_PARAMS), CACHE_MS, () => query(url));
};

async function query(url: URL) {
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

	try {
		if (groupBy === 'total') {
			// Get total unique users in the given time range. COUNT(DISTINCT) would sort every row, spilling to disk;
			// a DISTINCT subquery hashes them instead, several times faster.
			const totalQuery = await db.execute(sql`
				SELECT COUNT(*) AS count FROM (
					SELECT DISTINCT ${usage.deviceId} FROM ${usage}
					WHERE ${usage.timestamp} >= ${startDate} AND ${usage.timestamp} < ${endDate}
				) AS devices
			`);

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
      -- Each device once per bucket, then counted: faster than COUNT(DISTINCT), which sorts every row.
      counts AS (
        SELECT 
          grouped_time,
          COUNT(*) AS user_count
        FROM (
          SELECT DISTINCT
            DATE_TRUNC(${truncateFormat}, au.timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) AS grouped_time,
            au.device_id
          FROM 
            "usage" AS au
          WHERE 
            au.timestamp >= ${startDate} AND au.timestamp < ${endDate}
        ) AS devices
        GROUP BY 
          grouped_time
      )
      SELECT 
        to_char(series.time_point AT TIME ZONE ${timezone}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
        COALESCE(counts.user_count, 0) AS count
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
		console.error('Error fetching usage statistics data:', err);
		throw error(500, { message: 'Failed to fetch usage statistics data' });
	}
}
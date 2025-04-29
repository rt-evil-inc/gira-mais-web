import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { trips } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse request body
		const body = await request.json();

		// Validate required fields
		if (!body.deviceId) {
			throw error(400, { message: 'deviceId is required' });
		}
		if (!request.headers.get('user-agent')?.startsWith('Gira+')) {
			throw error(400, { message: 'invalid user-agent' });
		}

		// Check for recent trips in the last 5 minutes
		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
		const recentTrips = await db
			.select()
			.from(trips)
			.where(
				sql`${trips.deviceId} = ${body.deviceId} AND ${trips.timestamp} > ${fiveMinutesAgo}`,
			)
			.orderBy(sql`${trips.timestamp} DESC`)
			.limit(1);

		if (recentTrips.length > 0) {
			// Update the timestamp of the most recent trip
			const mostRecentTrip = recentTrips[0];
			await db.update(trips)
				.set({ timestamp: new Date })
				.where(
					sql`${trips.deviceId} = ${mostRecentTrip.deviceId} AND 
						${trips.timestamp} = ${mostRecentTrip.timestamp.toISOString()}`,
				);
		} else {
			// Store new statistics event in database
			await db.insert(trips).values({
				deviceId: body.deviceId,
				bikeSerial: body.bikeSerial,
				stationSerial: body.stationSerial,
			});
		}

		// Return success response with message
		return json({
			success: true,
		});
	} catch (err) {
		console.error('Error handling statistics request:', err);

		if (err instanceof Error) {
			throw error(500, { message: err.message });
		}

		throw error(500, { message: 'An unknown error occurred' });
	}
};

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
			// Get total trips in the given time range
			const totalQuery = await db
				.select({
					count: sql<number>`COUNT(*)`,
				})
				.from(trips)
				.where(
					sql`${trips.timestamp} >= ${startDate} AND ${trips.timestamp} < ${endDate}`,
				);

			const totalCount = totalQuery[0]?.count || 0;
			return json({
				data: totalCount,
				meta: { startDate, endDate, groupBy },
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
          DATE_TRUNC(${truncateFormat}, ${startDate}::timestamp),
          DATE_TRUNC(${truncateFormat}, ${endDate}::timestamp),
          ${intervalUnit}::interval
        ) AS time_point
      ),
      counts AS (
        SELECT 
          DATE_TRUNC(${truncateFormat}, au.timestamp) AS grouped_time,
          COUNT(*) AS trip_count
        FROM 
          "trips" AS au
        WHERE 
          au.timestamp >= ${startDate} AND au.timestamp < ${endDate}
        GROUP BY 
          grouped_time
      )
      SELECT 
        to_char(series.time_point AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
        COALESCE(counts.trip_count, 0) AS count
      FROM 
        series
      LEFT JOIN counts ON series.time_point = counts.grouped_time
      ORDER BY 
        series.time_point
    `);

		// Format the results
		const results = seriesQuery.map((row: any) => ({
			timestamp: row.timestamp,
			count: Number(row.count),
		}));

		return json({
			data: results,
			meta: { startDate, endDate, groupBy },
		});
	} catch (err) {
		console.error('Error fetching trip statistics data:', err);
		throw error(500, { message: 'Failed to fetch trip statistics data' });
	}
};
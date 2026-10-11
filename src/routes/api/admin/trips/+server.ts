import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bucketOf, formatBucket, parseRange, rangeBuckets, toSeries } from '$lib/server/admin';
import { cached, cacheKey } from '$lib/server/cache';
import type { TripsResponse } from '$lib/admin';
import type { RequestHandler } from './$types';

const TOP_STATIONS = 15;

/** Trips over the range and the devices that made them, the stations they started from and the bikes' ratings. */
export const GET: RequestHandler = async ({ url }) => {
	const range = parseRange(url);
	return json(await cached(cacheKey(url), 60_000, async (): Promise<TripsResponse> => {
		const [buckets, series, stations, ratings] = await Promise.all([
			rangeBuckets(range),
			db.execute(sql`
				SELECT ${formatBucket(range, bucketOf(range, sql`timestamp`))} AS bucket, COUNT(*) AS trips, COUNT(DISTINCT device_id) AS devices
				FROM trips WHERE timestamp >= ${range.start} AND timestamp < ${range.end}
				GROUP BY 1
			`),
			db.execute(sql`
				SELECT trips.station_serial AS id, MIN(gira_stations.name) AS name,
					COUNT(*) FILTER (WHERE trips.timestamp >= ${range.start}) AS trips,
					COUNT(*) FILTER (WHERE trips.timestamp < ${range.start}) AS previous
				FROM trips LEFT JOIN gira_stations ON gira_stations.id::text = trips.station_serial
				WHERE trips.timestamp >= ${range.previousStart} AND trips.timestamp < ${range.end} AND trips.station_serial IS NOT NULL
				GROUP BY 1 ORDER BY 3 DESC LIMIT ${TOP_STATIONS}
			`),
			db.execute(sql`
				SELECT rating, timestamp >= ${range.start} AS current, COUNT(*) AS count
				FROM bike_ratings WHERE timestamp >= ${range.previousStart} AND timestamp < ${range.end}
				GROUP BY 1, 2 ORDER BY 1
			`),
		]);
		const ratingCounts = (current: boolean) => ratings
			.filter(row => row.current === current)
			.map(row => ({ rating: Number(row.rating), count: Number(row.count) }));
		return {
			series: toSeries(buckets, series.flatMap(row => [
				{ bucket: row.bucket, key: 'trips', count: row.trips },
				{ bucket: row.bucket, key: 'devices', count: row.devices },
			]), ['trips', 'devices']),
			stations: stations.map(row => ({ id: String(row.id), name: row.name == null ? null : String(row.name), trips: Number(row.trips), previous: Number(row.previous) })),
			ratings: ratingCounts(true),
			previousRatings: ratingCounts(false),
		};
	}));
};
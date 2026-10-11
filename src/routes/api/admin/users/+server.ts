import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bucketOf, cached, cacheKey, formatBucket, parseRange, rangeBuckets, toSeries } from '$lib/server/admin';
import type { UsersResponse } from '$lib/admin';
import type { RequestHandler } from './$types';

/** Active and new devices over the range, by platform, and the OS versions they run. */
export const GET: RequestHandler = async ({ url }) => {
	const range = parseRange(url);
	return json(await cached(cacheKey(url), 60_000, async (): Promise<UsersResponse> => {
		const bucket = formatBucket(range, bucketOf(range, sql`timestamp`));
		const [buckets, platforms, newUsers, osVersions] = await Promise.all([
			rangeBuckets(range),
			db.execute(sql`
				SELECT ${bucket} AS bucket, COALESCE(os, 'unknown') AS key, COUNT(DISTINCT device_id) AS count
				FROM usage WHERE timestamp >= ${range.start} AND timestamp < ${range.end}
				GROUP BY 1, 2
			`),
			// A device is new in the bucket it first appears in, if it never appeared before the range.
			db.execute(sql`
				SELECT ${formatBucket(range, bucketOf(range, sql`first_seen`))} AS bucket, 'new' AS key, COUNT(*) AS count
				FROM (
					SELECT device_id, MIN(timestamp) AS first_seen FROM usage
					WHERE timestamp >= ${range.start} AND timestamp < ${range.end}
					GROUP BY device_id
				) AS seen
				WHERE NOT EXISTS (SELECT 1 FROM usage AS earlier WHERE earlier.device_id = seen.device_id AND earlier.timestamp < ${range.start})
				GROUP BY 1
			`),
			db.execute(sql`
				SELECT COALESCE(os, 'unknown') AS os, COALESCE(split_part(os_version, '.', 1), '?') AS version, COUNT(DISTINCT device_id) AS devices
				FROM usage WHERE timestamp >= ${range.start} AND timestamp < ${range.end}
				GROUP BY 1, 2 ORDER BY 3 DESC
			`),
		]);
		return {
			platforms: toSeries(buckets, platforms),
			newUsers: toSeries(buckets, newUsers, ['new'])[0],
			osVersions: osVersions.map(row => ({ os: String(row.os), version: String(row.version), devices: Number(row.devices) })),
		};
	}));
};
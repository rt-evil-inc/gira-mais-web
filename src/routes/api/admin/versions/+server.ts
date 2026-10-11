import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bucketOf, cached, cacheKey, formatBucket, parseRange, rangeBuckets, toSeries } from '$lib/server/admin';
import type { VersionsResponse } from '$lib/admin';
import type { RequestHandler } from './$types';

/**
 * Devices by the newest app version they used, at each bucket of the range, counting the devices seen in the
 * `window` days up to the bucket's end.
 *
 * Each device's activity becomes spans: from a bucket it was seen in until the next one, or until the window
 * runs out. A span adds the device to its version where it starts and takes it away where it ends, so a running
 * sum of those steps gives the count at every bucket in one pass over the usage rather than one per bucket.
 */
export const GET: RequestHandler = async ({ url }) => {
	const range = parseRange(url);
	const window = Math.min(Math.max(Number.parseInt(url.searchParams.get('window') ?? '') || 7, 1), 90);
	const platform = url.searchParams.get('platform');
	// Adoption moves slowly and long ranges take seconds: keep it longer than the rest.
	return json(await cached(cacheKey(url), 10 * 60_000, async (): Promise<VersionsResponse> => {
		const windowStart = new Date(Date.parse(range.start) - window * 86_400_000).toISOString();
		const firstBucket = bucketOf(range, sql`${range.start}::timestamp`);
		const [buckets, rows] = await Promise.all([
			rangeBuckets(range),
			db.execute(sql`
				WITH seen AS (
					-- The newest version a device used in each bucket, compared as numbers so 1.10 comes after 1.9;
					-- development builds count as their release. Cheaper than the last one used, which needs a sort.
					SELECT device_id, ${bucketOf(range, sql`timestamp`)} AS bucket,
						array_to_string(MAX(string_to_array(substring(app_version from '^\\d+\\.\\d+\\.\\d+'), '.')::int[]), '.') AS version
					FROM usage
					WHERE timestamp >= ${windowStart} AND timestamp < ${range.end} AND app_version ~ '^\\d+\\.\\d+\\.\\d+'
						${platform ? sql`AND os = ${platform}` : sql``}
					GROUP BY 1, 2
				),
				spans AS (
					SELECT version, bucket AS since,
						LEAST(LEAD(bucket) OVER (PARTITION BY device_id ORDER BY bucket), bucket + ${`${window} days`}::interval) AS until
					FROM seen
				),
				steps AS (
					-- What changed before the range adds up to its first bucket.
					SELECT version, GREATEST(since, ${firstBucket}) AS bucket, 1 AS step FROM spans
					UNION ALL
					SELECT version, GREATEST(until, ${firstBucket}), -1 FROM spans
				),
				totals AS (
					SELECT version, bucket, SUM(SUM(step)) OVER (PARTITION BY version ORDER BY bucket) AS count
					FROM steps GROUP BY 1, 2
				)
				SELECT version AS key, ${formatBucket(range, sql`bucket`)} AS bucket, count FROM totals
			`),
		]);

		// A version keeps its count until its next step: carry it over the buckets in between.
		const steps = new Map<string, Map<string, number>>;
		for (const row of rows) {
			const version = String(row.key);
			if (!steps.has(version)) steps.set(version, new Map);
			steps.get(version)!.set(String(row.bucket), Number(row.count));
		}
		const filled: Record<string, unknown>[] = [];
		for (const [version, counts] of steps) {
			let count = 0;
			for (const bucket of buckets) {
				count = counts.get(bucket) ?? count;
				if (count > 0) filled.push({ key: version, bucket, count });
			}
		}
		return { series: toSeries(buckets, filled).filter(series => series.data.some(point => point.count > 0)) };
	}));
};
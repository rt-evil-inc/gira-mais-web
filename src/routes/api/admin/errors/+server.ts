import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bucketOf, cached, cacheKey, formatBucket, parseRange, rangeBuckets, toSeries } from '$lib/server/admin';
import { ERROR_SIGNATURE, ERROR_VERSION, errorFilters } from '$lib/server/admin-errors';
import { OTHER_ERRORS, type ErrorsResponse } from '$lib/admin';
import type { RequestHandler } from './$types';

/** Codes charted on their own; the rest are charted together. */
const CHARTED_CODES = 8;
const SIGNATURES = 20;
const timestamp = (column: string) => sql.raw(`to_char(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`);

/**
 * The errors the app reported over the range, filtered by codes, versions, device and text (see errorFilters):
 * by code over time, by message, and the codes and versions to filter by. Each of those two lists leaves out its
 * own filter, so it shows what else there is to pick.
 */
export const GET: RequestHandler = async ({ url }) => {
	const range = parseRange(url);
	const filters = errorFilters(url);
	const inRange = sql`timestamp >= ${range.start} AND timestamp < ${range.end}`;

	return json(await cached(cacheKey(url), 60_000, async (): Promise<ErrorsResponse> => {
		const [buckets, byCode, codes, versions, activeVersions, signatures, [total], [active]] = await Promise.all([
			rangeBuckets(range),
			db.execute(sql`
				SELECT ${formatBucket(range, bucketOf(range, sql`timestamp`))} AS bucket, error_code AS key, COUNT(*) AS count
				FROM errors WHERE ${inRange} ${filters.codes} ${filters.versions} ${filters.other}
				GROUP BY 1, 2
			`),
			db.execute(sql`
				SELECT error_code AS code,
					COUNT(*) FILTER (WHERE timestamp >= ${range.start}) AS count,
					COUNT(DISTINCT device_id) FILTER (WHERE timestamp >= ${range.start}) AS devices,
					COUNT(*) FILTER (WHERE timestamp < ${range.start}) AS previous_count,
					COUNT(DISTINCT device_id) FILTER (WHERE timestamp < ${range.start}) AS previous_devices,
					${timestamp('MAX(timestamp)')} AS last_seen
				FROM errors WHERE timestamp >= ${range.previousStart} AND timestamp < ${range.end} ${filters.versions} ${filters.other}
				GROUP BY 1
				HAVING COUNT(*) FILTER (WHERE timestamp >= ${range.start}) > 0
				ORDER BY 2 DESC
			`),
			db.execute(sql`
				SELECT ${ERROR_VERSION} AS version, COUNT(*) AS count, COUNT(DISTINCT device_id) AS devices
				FROM errors WHERE ${inRange} ${filters.codes} ${filters.other}
				GROUP BY 1
			`),
			db.execute(sql`
				SELECT split_part(app_version, ' ', 1) AS version, COUNT(DISTINCT device_id) AS devices
				FROM usage WHERE ${inRange} GROUP BY 1
			`),
			// Far fewer messages than errors: group the errors by message and device first, and work out each
			// message's signature once.
			db.execute(sql`
				WITH reports AS (
					SELECT error_code, COALESCE(error_message, '') AS error_message, device_id, COUNT(*) AS count, MAX(timestamp) AS last_seen, MAX(id) AS example_id
					FROM errors WHERE ${inRange} ${filters.codes} ${filters.versions} ${filters.other}
					GROUP BY 1, 2, 3
				),
				messages AS MATERIALIZED (
					SELECT error_code, error_message, ${ERROR_SIGNATURE} AS signature
					FROM (SELECT DISTINCT error_code, error_message FROM reports) AS distinct_messages
				)
				SELECT reports.error_code AS code, messages.signature, SUM(reports.count) AS count, COUNT(DISTINCT reports.device_id) AS devices,
					${timestamp('MAX(reports.last_seen)')} AS last_seen, MAX(reports.example_id) AS example_id
				FROM reports JOIN messages USING (error_code, error_message)
				GROUP BY 1, 2 ORDER BY 3 DESC LIMIT ${SIGNATURES}
			`),
			db.execute(sql`
				SELECT COUNT(*) AS count, COUNT(DISTINCT device_id) AS devices
				FROM errors WHERE ${inRange} ${filters.codes} ${filters.versions} ${filters.other}
			`),
			db.execute(sql`SELECT COUNT(DISTINCT device_id) AS devices FROM usage WHERE ${inRange}`),
		]);

		const examples = signatures.length ?
			await db.execute(sql`SELECT id, error_message FROM errors WHERE id IN ${signatures.map(row => Number(row.example_id))}`) :
			[];
		const exampleOf = new Map(examples.map(row => [Number(row.id), row.error_message == null ? null : String(row.error_message)]));

		// The codes with the most errors in the range get a series each, in that order; the others share one.
		const totals = new Map<string, number>;
		for (const row of byCode) totals.set(String(row.key), (totals.get(String(row.key)) ?? 0) + Number(row.count));
		const charted = [...totals.entries()].sort(([, a], [, b]) => b - a).map(([code]) => code);
		const own = new Set(charted.slice(0, charted.length > CHARTED_CODES ? CHARTED_CODES - 1 : CHARTED_CODES));
		const other = new Map<string, number>;
		for (const row of byCode) {
			if (own.has(String(row.key))) continue;
			other.set(String(row.bucket), (other.get(String(row.bucket)) ?? 0) + Number(row.count));
		}
		const seriesRows = [
			...byCode.filter(row => own.has(String(row.key))),
			...[...other].map(([bucket, count]) => ({ bucket, key: OTHER_ERRORS, count })),
		];
		const activeByVersion = new Map(activeVersions.map(row => [String(row.version), Number(row.devices)]));

		return {
			series: toSeries(buckets, seriesRows, [...own, ...other.size ? [OTHER_ERRORS] : []]),
			codes: codes.map(row => ({
				code: String(row.code),
				count: Number(row.count),
				devices: Number(row.devices),
				previousCount: Number(row.previous_count),
				previousDevices: Number(row.previous_devices),
				lastSeen: String(row.last_seen),
			})),
			versions: versions.map(row => ({
				version: String(row.version),
				count: Number(row.count),
				devices: Number(row.devices),
				activeDevices: activeByVersion.get(String(row.version)) ?? 0,
			})),
			signatures: signatures.map(row => ({
				code: String(row.code),
				signature: String(row.signature),
				count: Number(row.count),
				devices: Number(row.devices),
				lastSeen: String(row.last_seen),
				example: exampleOf.get(Number(row.example_id)) ?? null,
			})),
			activeDevices: Number(active.devices),
			total: { count: Number(total.count), devices: Number(total.devices) },
		};
	}));
};
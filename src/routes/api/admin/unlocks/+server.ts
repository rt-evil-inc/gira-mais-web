import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bucketOf, cached, cacheKey, formatBucket, parseRange, rangeBuckets, toSeries } from '$lib/server/admin';
import { UNLOCK_RESULTS, type UnlockResult, type UnlocksResponse } from '$lib/admin';
import type { RequestHandler } from './$types';

const TOP_STATIONS = 10;
const RECENT = 30;

/** An attempt's result, from VAIMOO's answer to the request and what the app saw after. */
const RESULT = sql`CASE
	WHEN request = 'refused' THEN 'refused'
	WHEN request = 'network-error' THEN 'network_error'
	WHEN outcome = 'confirmed' THEN 'confirmed'
	WHEN outcome = 'not-confirmed' THEN 'not_confirmed'
	WHEN outcome = 'unresolved' THEN 'unresolved'
	ELSE 'pending'
END`;
/** Why VAIMOO refused, as the exception it names ("Exception of type '...Bike.BikeIsBrokenException'" is BikeIsBroken). */
const REFUSAL = sql`substring(details #>> '{error,messages,0}' from '\\.([A-Za-z]+)Exception''')`;

/**
 * The unlock attempts the app reports: their results over the range, by how the bike was offered and why it was
 * hidden, VAIMOO's refusals, and the latest attempts. `survey` is 'exclude' (the default), 'include' or 'only'
 * for the field-survey build's, which tries every bike.
 */
export const GET: RequestHandler = async ({ url }) => {
	const range = parseRange(url);
	const survey = url.searchParams.get('survey');
	const surveyFilter = survey === 'include' ? sql`` : survey === 'only' ? sql`AND survey` : sql`AND NOT survey`;
	const where = sql`created_at >= ${range.start} AND created_at < ${range.end} ${surveyFilter}`;

	return json(await cached(cacheKey(url), 60_000, async (): Promise<UnlocksResponse> => {
		const [buckets, series, bySource, byReason, refusals, [elapsed], stations, recent] = await Promise.all([
			rangeBuckets(range),
			db.execute(sql`
				SELECT ${formatBucket(range, bucketOf(range, sql`created_at`))} AS bucket, ${RESULT} AS key, COUNT(*) AS count
				FROM unlock_attempts WHERE ${where} GROUP BY 1, 2
			`),
			db.execute(sql`SELECT source AS key, ${RESULT} AS result, COUNT(*) AS count FROM unlock_attempts WHERE ${where} GROUP BY 1, 2`),
			db.execute(sql`
				SELECT reason AS key, ${RESULT} AS result, COUNT(*) AS count
				FROM unlock_attempts, unnest(hidden_reasons) AS reason WHERE ${where} GROUP BY 1, 2
			`),
			db.execute(sql`
				SELECT vaimoo_code AS code, ${REFUSAL} AS reason, COUNT(*) AS count, COUNT(DISTINCT bike) AS bikes
				FROM unlock_attempts WHERE ${where} AND request = 'refused'
				GROUP BY 1, 2 ORDER BY 3 DESC
			`),
			db.execute(sql`
				SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY elapsed_ms) AS p50, percentile_cont(0.9) WITHIN GROUP (ORDER BY elapsed_ms) AS p90, COUNT(elapsed_ms) AS count
				FROM unlock_attempts WHERE ${where} AND outcome = 'confirmed' AND elapsed_ms IS NOT NULL
			`),
			db.execute(sql`
				SELECT station AS id, MIN(gira_stations.name) AS name, COUNT(*) AS attempts, COUNT(*) FILTER (WHERE outcome = 'confirmed') AS confirmed
				FROM unlock_attempts LEFT JOIN gira_stations ON gira_stations.id::text = unlock_attempts.station
				WHERE ${where} AND station IS NOT NULL
				GROUP BY 1 ORDER BY 3 DESC LIMIT ${TOP_STATIONS}
			`),
			db.execute(sql`
				SELECT to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created, bike, station, gira_stations.name AS station_name, source, hidden_reasons, ${RESULT} AS result, vaimoo_code, elapsed_ms, survey
				FROM unlock_attempts LEFT JOIN gira_stations ON gira_stations.id::text = unlock_attempts.station
				WHERE ${where} ORDER BY created_at DESC LIMIT ${RECENT}
			`),
		]);

		const byResult = (rows: Record<string, unknown>[]) => {
			const groups = new Map<string, Partial<Record<UnlockResult, number>>>;
			for (const row of rows) {
				const key = String(row.key);
				if (!groups.has(key)) groups.set(key, {});
				groups.get(key)![row.result as UnlockResult] = Number(row.count);
			}
			const total = (results: Partial<Record<UnlockResult, number>>) => Object.values(results).reduce((sum, count) => sum + count, 0);
			return [...groups.entries()].map(([key, results]) => ({ key, results })).sort((a, b) => total(b.results) - total(a.results));
		};
		const optionalNumber = (value: unknown) => value == null ? null : Number(value);

		return {
			series: toSeries(buckets, series, Object.keys(UNLOCK_RESULTS)),
			bySource: byResult(bySource),
			byReason: byResult(byReason),
			refusals: refusals.map(row => ({ code: optionalNumber(row.code), reason: row.reason == null ? null : String(row.reason), count: Number(row.count), bikes: Number(row.bikes) })),
			elapsed: { p50: optionalNumber(elapsed.p50), p90: optionalNumber(elapsed.p90), count: Number(elapsed.count) },
			stations: stations.map(row => ({ id: String(row.id), name: row.name == null ? null : String(row.name), attempts: Number(row.attempts), confirmed: Number(row.confirmed) })),
			recent: recent.map(row => ({
				createdAt: String(row.created),
				bike: String(row.bike),
				station: row.station == null ? null : String(row.station),
				stationName: row.station_name == null ? null : String(row.station_name),
				source: String(row.source),
				hiddenReasons: row.hidden_reasons as string[] | null,
				result: row.result as UnlockResult,
				vaimooCode: optionalNumber(row.vaimoo_code),
				elapsedMs: optionalNumber(row.elapsed_ms),
				survey: Boolean(row.survey),
			})),
		};
	}));
};
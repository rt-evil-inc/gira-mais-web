import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cached, cacheKey, parseRange, type Range } from '$lib/server/admin';
import type { ActivityResponse } from '$lib/admin';
import type { RequestHandler } from './$types';

/** When in the week the app is used: average app opens and trips in each hour of each weekday of the range. */
export const GET: RequestHandler = async ({ url }) => {
	const range = parseRange(url);
	return json(await cached(cacheKey(url), 5 * 60_000, async (): Promise<ActivityResponse> => {
		const [opens, trips] = await Promise.all([weekHours(range, 'usage'), weekHours(range, 'trips')]);
		return { opens, trips };
	}));
};

async function weekHours(range: Range, table: 'usage' | 'trips') {
	const local = (column: ReturnType<typeof sql>) => sql`${column} AT TIME ZONE 'UTC' AT TIME ZONE ${range.timezone}`;
	const rows = await db.execute(sql`
		WITH counts AS (
			SELECT EXTRACT(ISODOW FROM local)::int - 1 AS weekday, EXTRACT(HOUR FROM local)::int AS hour, COUNT(*) AS count
			FROM (SELECT ${local(sql`timestamp`)} AS local FROM ${sql.identifier(table)} WHERE timestamp >= ${range.start} AND timestamp < ${range.end}) AS events
			GROUP BY 1, 2
		),
		-- How many times each hour of the week occurs in the range, to average over.
		occurrences AS (
			-- Walked in UTC and then made local, so the hours the clocks skip or repeat are counted as they happened.
			SELECT EXTRACT(ISODOW FROM local)::int - 1 AS weekday, EXTRACT(HOUR FROM local)::int AS hour, COUNT(*) AS times
			FROM (
				SELECT ${local(sql`utc`)} AS local
				FROM generate_series(DATE_TRUNC('hour', ${range.start}::timestamp), ${range.end}::timestamp - interval '1 millisecond', '1 hour') AS utc
			) AS hours
			GROUP BY 1, 2
		)
		SELECT occurrences.weekday, occurrences.hour, COALESCE(counts.count, 0)::float / occurrences.times AS average
		FROM occurrences LEFT JOIN counts USING (weekday, hour)
	`);
	const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
	for (const row of rows) grid[Number(row.weekday)][Number(row.hour)] = Number(row.average);
	return grid;
}
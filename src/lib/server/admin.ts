import { error } from '@sveltejs/kit';
import { sql, type SQL } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import type { GroupBy } from '$lib/admin';

const initialDate = new Date(env.INITIAL_DATE || '2025-04-27');

/** A time range the admin dashboard charts, with the period of the same length right before it. */
export interface Range {
	/** ISO timestamps; end is exclusive and never in the future. */
	start: string;
	end: string;
	previousStart: string;
	groupBy: GroupBy;
	timezone: string;
}

/** The range in a request's start, end, groupBy and timezone parameters, clamped to the data there is. */
export function parseRange(url: URL): Range {
	const now = Date.now();
	const startMs = Math.max(Date.parse(url.searchParams.get('start') ?? '') || 0, initialDate.getTime());
	const endMs = Math.min(Date.parse(url.searchParams.get('end') ?? '') || now, now);
	if (startMs >= endMs) throw error(400, { message: 'start must be before end' });
	const groupBy = url.searchParams.get('groupBy') === 'hour' ? 'hour' : 'day';
	const timezone = url.searchParams.get('timezone') || 'UTC';
	// Only zone names: Postgres reads offsets ("+01:00", "GMT+1") with the sign the other way round from Intl.
	try {
		if (/[+-]\d/.test(timezone)) throw new RangeError;
		new Intl.DateTimeFormat('en', { timeZone: timezone });
	} catch {
		throw error(400, { message: 'invalid timezone' });
	}
	return {
		start: new Date(startMs).toISOString(),
		end: new Date(endMs).toISOString(),
		previousStart: new Date(2 * startMs - endMs).toISOString(),
		groupBy,
		timezone,
	};
}

/**
 * The timezone buckets are cut in. Days follow the range's timezone; hours are cut in UTC, which gives the same
 * hours for zones a whole number of hours off UTC, without the hour that repeats or goes missing when the clocks
 * change (local wall-clock hours would merge two hours into one, or count one twice).
 */
function bucketZone(range: Range) {
	return range.groupBy === 'hour' ? 'UTC' : range.timezone;
}

/** A timestamp column truncated to the range's buckets, as local time in the bucket timezone. */
export function bucketOf(range: Range, column: SQL) {
	return sql`DATE_TRUNC(${range.groupBy}, (${column}) AT TIME ZONE 'UTC' AT TIME ZONE ${bucketZone(range)})`;
}

/** A bucket (as bucketOf gives it) as the ISO timestamp of its start. */
export function formatBucket(range: Range, bucket: SQL) {
	return sql`to_char((${bucket}) AT TIME ZONE ${bucketZone(range)} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

/** Every bucket of the range, oldest first, as ISO timestamps. */
export async function rangeBuckets(range: Range): Promise<string[]> {
	const first = bucketOf(range, sql`${range.start}::timestamp`);
	// The end is exclusive: a range ending at midnight has no bucket for the day that starts then.
	const last = bucketOf(range, sql`${range.end}::timestamp - interval '1 millisecond'`);
	const rows = await db.execute(sql`
		SELECT ${formatBucket(range, sql`t`)} AS bucket
		FROM generate_series(${first}, ${last}, ${`1 ${range.groupBy}`}::interval) AS t
	`);
	return rows.map(row => String(row.bucket));
}

export interface Series {
	key: string;
	data: { timestamp: string; count: number }[];
}

/** Rows of (bucket, key, count) as one series per key over every bucket, zero where a key has no row. */
export function toSeries(buckets: string[], rows: Record<string, unknown>[], keys?: string[]): Series[] {
	const counts = new Map<string, Map<string, number>>;
	for (const row of rows) {
		const key = String(row.key);
		if (!counts.has(key)) counts.set(key, new Map);
		counts.get(key)!.set(String(row.bucket), Number(row.count));
	}
	return (keys ?? [...counts.keys()]).map(key => ({
		key,
		data: buckets.map(timestamp => ({ timestamp, count: counts.get(key)?.get(timestamp) ?? 0 })),
	}));
}

const cache = new Map<string, { expires: number; value: Promise<unknown> }>;

/**
 * The value computed for the key in the last ttlMs, or a new one. Concurrent requests share one computation; a
 * failed one isn't kept. The dashboard refreshes itself, so several open tabs cost the database one query.
 */
export function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
	const now = Date.now();
	const hit = cache.get(key);
	if (hit && hit.expires > now) return hit.value as Promise<T>;
	for (const [entryKey, entry] of cache) if (entry.expires <= now) cache.delete(entryKey);
	const value = compute();
	cache.set(key, { expires: now + ttlMs, value });
	value.catch(() => cache.delete(key));
	return value;
}

/** The request's URL as a cache key: the path and its parameters, in a stable order. */
export function cacheKey(url: URL) {
	const params = [...url.searchParams].sort(([a], [b]) => a.localeCompare(b));
	return `${url.pathname}?${new URLSearchParams(params)}`;
}
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { giraSnapshots } from '$lib/server/db/schema';
import { SYSTEM_STATUSES, type StatusSeries, type SystemKind } from '$lib/gira-system';
import { min, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** What the statistics page charts; snapshots' station statuses are folded into occupancy as its parts. */
const KINDS: SystemKind[] = ['occupancy', 'docks', 'bikes'];
/** The page groups by hour for up to two weeks; longer hourly spans only cost the database. */
const MAX_HOURLY_DAYS = 31;

function validTimezone(timezone: string | null) {
	if (!timezone) return null;
	try {
		new Intl.DateTimeFormat('en', { timeZone: timezone });
		return timezone;
	} catch {
		return null;
	}
}

/**
 * Status totals of the GIRA system's stations (by occupancy), docks and bikes over time. Each bucket holds the average over
 * the polls that fell in it; buckets without polls (before polling started, or while the feed was down) are null.
 * Statuses counted in parts ("unavailable:repair") come whole, with the average of each part.
 */
export const GET: RequestHandler = async ({ url }) => {
	const groupBy = url.searchParams.get('groupBy') === 'hour' ? 'hour' : 'day';
	const timezone = validTimezone(url.searchParams.get('timezone')) ?? 'Europe/Lisbon';
	const now = Date.now();
	const end = new Date(Math.min(Date.parse(url.searchParams.get('end') ?? '') || now, now));

	try {
		const [{ first }] = await db.select({ first: min(giraSnapshots.timestamp) }).from(giraSnapshots);
		if (!first) return json({ data: Object.fromEntries(KINDS.map(kind => [kind, []])), meta: { firstSnapshot: null } });
		const earliest = groupBy === 'hour' ? end.getTime() - MAX_HOURLY_DAYS * 86_400_000 : 0;
		const start = new Date(Math.max(Date.parse(url.searchParams.get('start') ?? '') || 0, first.getTime(), earliest));
		if (start >= end) return json({ data: Object.fromEntries(KINDS.map(kind => [kind, []])), meta: { firstSnapshot: first.toISOString() } });

		const startDate = start.toISOString();
		const endDate = end.toISOString();
		const unitInterval = groupBy === 'hour' ? '1 hour' : '1 day';
		const bucket = sql`DATE_TRUNC(${groupBy}, s.timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})`;

		const [series, polls, totals] = await Promise.all([
			db.execute(sql`
				SELECT to_char(time_point AT TIME ZONE ${timezone}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp
				FROM generate_series(
					DATE_TRUNC(${groupBy}, ${startDate}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}),
					DATE_TRUNC(${groupBy}, ${endDate}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}),
					${unitInterval}::interval
				) AS time_point
				ORDER BY time_point
			`),
			db.execute(sql`
				SELECT to_char(${bucket} AT TIME ZONE ${timezone}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp, k.kind, COUNT(*) AS polls
				FROM gira_snapshots AS s
				CROSS JOIN LATERAL (VALUES ('occupancy', s.occupancy), ('docks', s.docks), ('bikes', s.bikes)) AS k(kind, counts)
				-- Polls from before a kind was tracked recorded it as {}; they don't count towards its average.
				WHERE s.timestamp >= ${startDate} AND s.timestamp < ${endDate} AND k.counts <> '{}'::jsonb
				GROUP BY 1, 2
			`),
			db.execute(sql`
				SELECT to_char(${bucket} AT TIME ZONE ${timezone}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp, k.kind, kv.key AS status, SUM(kv.value::numeric) AS total
				FROM gira_snapshots AS s
				CROSS JOIN LATERAL (VALUES ('occupancy', s.occupancy), ('docks', s.docks), ('bikes', s.bikes)) AS k(kind, counts)
				CROSS JOIN LATERAL jsonb_each_text(k.counts) AS kv
				WHERE s.timestamp >= ${startDate} AND s.timestamp < ${endDate}
				GROUP BY 1, 2, 3
			`),
		]);

		const pollsByBucket = new Map(polls.map(row => [`${row.kind}:${row.timestamp}`, Number(row.polls)]));
		const timestamps = series.map(row => String(row.timestamp));
		// kind → status → timestamp → { total, parts: part → total }; whole: some polls counted the status without parts.
		type Bucket = { total: number; parts: Map<string, number>; whole: boolean };
		const totalsByKind = new Map<string, Map<string, Map<string, Bucket>>>;
		for (const row of totals) {
			const kind = String(row.kind);
			const [status, part] = String(row.status).split(':');
			if (!totalsByKind.has(kind)) totalsByKind.set(kind, new Map);
			const byStatus = totalsByKind.get(kind)!;
			if (!byStatus.has(status)) byStatus.set(status, new Map);
			const byTimestamp = byStatus.get(status)!;
			const timestamp = String(row.timestamp);
			if (!byTimestamp.has(timestamp)) byTimestamp.set(timestamp, { total: 0, parts: new Map, whole: false });
			const bucket = byTimestamp.get(timestamp)!;
			bucket.total += Number(row.total);
			if (part) bucket.parts.set(part, (bucket.parts.get(part) ?? 0) + Number(row.total));
			else bucket.whole = true;
		}

		const data = Object.fromEntries(KINDS.map(kind => {
			const byStatus = totalsByKind.get(kind) ?? new Map<string, Map<string, Bucket>>;
			// Known statuses in their stacking order, then whatever new ones the feed has started using.
			const statuses = [...Object.keys(SYSTEM_STATUSES[kind]), ...[...byStatus.keys()].filter(status => !(status in SYSTEM_STATUSES[kind]))];
			return [kind, statuses.filter(status => byStatus.has(status)).map((status): StatusSeries => ({
				status,
				data: timestamps.map(timestamp => {
					const polls = pollsByBucket.get(`${kind}:${timestamp}`);
					if (!polls) return { timestamp, count: null };
					const bucket = byStatus.get(status)!.get(timestamp);
					// Parts that don't add up to the whole would mislead, so then there are none.
					if (!bucket?.parts.size || bucket.whole) return { timestamp, count: (bucket?.total ?? 0) / polls };
					return { timestamp, count: bucket.total / polls, parts: Object.fromEntries([...bucket.parts].map(([part, total]) => [part, total / polls])) };
				}),
			}))];
		}));

		return json({ data, meta: { firstSnapshot: first.toISOString(), startDate, endDate, groupBy, timezone } });
	} catch (err) {
		console.error('Error fetching GIRA system statistics:', err);
		throw error(500, { message: 'Failed to fetch GIRA system statistics' });
	}
};
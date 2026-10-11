import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cached } from '$lib/server/admin';
import type { RetentionResponse } from '$lib/admin';
import type { RequestHandler } from './$types';

const WEEKS = 12;
const TIMEZONE = 'Europe/Lisbon';

/**
 * Weekly cohorts of the last weeks: the devices first seen in each week (Monday to Sunday), and how many of them
 * opened the app again in each of the weeks after. The current week is still going, so its figures are partial.
 */
export const GET: RequestHandler = async () => json(await cached('retention', 60 * 60_000, compute));

async function compute(): Promise<RetentionResponse> {
	const rows = await db.execute(sql`
		WITH bounds AS (
			SELECT (DATE_TRUNC('week', now() AT TIME ZONE ${TIMEZONE}) - ${`${WEEKS - 1} weeks`}::interval) AT TIME ZONE ${TIMEZONE} AT TIME ZONE 'UTC' AS since
		),
		weeks AS (
			SELECT device_id, DATE_TRUNC('week', timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${TIMEZONE}) AS week
			FROM usage, bounds WHERE timestamp >= bounds.since
			GROUP BY 1, 2
		),
		cohorts AS (
			SELECT device_id, MIN(week) AS cohort FROM weeks GROUP BY 1
		)
		SELECT to_char(cohorts.cohort, 'YYYY-MM-DD') AS cohort, (weeks.week::date - cohorts.cohort::date) / 7 AS offset, COUNT(*) AS devices
		FROM cohorts JOIN weeks USING (device_id), bounds
		WHERE NOT EXISTS (SELECT 1 FROM usage AS earlier WHERE earlier.device_id = cohorts.device_id AND earlier.timestamp < bounds.since)
		GROUP BY 1, 2
	`);

	const WEEK = 7 * 86_400_000;
	const cohorts = new Map<string, number[]>;
	let latest = 0;
	for (const row of rows) {
		const week = String(row.cohort);
		if (!cohorts.has(week)) cohorts.set(week, []);
		cohorts.get(week)![Number(row.offset)] = Number(row.devices);
		latest = Math.max(latest, Date.parse(week) + Number(row.offset) * WEEK);
	}
	return {
		cohorts: [...cohorts.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([week, counts]) => ({
				week,
				devices: counts[0] ?? 0,
				// Every week since, up to the current one, even those nobody came back in.
				retained: Array.from({ length: Math.round((latest - Date.parse(week)) / WEEK) }, (_, index) => counts[index + 1] ?? 0),
			})),
	};
}
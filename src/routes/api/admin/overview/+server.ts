import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cached } from '$lib/server/admin';
import type { Compared, Overview } from '$lib/admin';
import type { RequestHandler } from './$types';

const HOUR = 3_600_000;

/** The dashboard's headline figures, for fixed periods up to now. */
export const GET: RequestHandler = async () => json(await cached('overview', 60_000, compute));

async function compute(): Promise<Overview> {
	const now = Date.now();
	const ago = (hours: number) => new Date(now - hours * HOUR).toISOString();
	const [day, twoDays, week, twoWeeks, month, twoMonths] = [24, 48, 7 * 24, 14 * 24, 30 * 24, 60 * 24].map(ago);
	const compared = (row: Record<string, unknown>, current: string, previous: string): Compared => ({
		current: Number(row[current] ?? 0),
		previous: Number(row[previous] ?? 0),
	});

	const [[users], [newUsers], [trips], [errors], [unlocks], [ratings], versions] = await Promise.all([
		db.execute(sql`
			SELECT
				COUNT(DISTINCT device_id) FILTER (WHERE timestamp >= ${day}) AS day,
				COUNT(DISTINCT device_id) FILTER (WHERE timestamp >= ${twoDays} AND timestamp < ${day}) AS previous_day,
				COUNT(DISTINCT device_id) FILTER (WHERE timestamp >= ${week}) AS week,
				COUNT(DISTINCT device_id) FILTER (WHERE timestamp >= ${twoWeeks} AND timestamp < ${week}) AS previous_week,
				COUNT(DISTINCT device_id) FILTER (WHERE timestamp >= ${month}) AS month,
				COUNT(DISTINCT device_id) FILTER (WHERE timestamp < ${month}) AS previous_month
			FROM usage WHERE timestamp >= ${twoMonths}
		`),
		// Devices seen in the last two weeks and never before them, by the week they first appeared in.
		db.execute(sql`
			SELECT COUNT(*) FILTER (WHERE first_seen >= ${week}) AS week, COUNT(*) FILTER (WHERE first_seen < ${week}) AS previous_week
			FROM (SELECT device_id, MIN(timestamp) AS first_seen FROM usage WHERE timestamp >= ${twoWeeks} GROUP BY device_id) AS recent
			WHERE NOT EXISTS (SELECT 1 FROM usage AS earlier WHERE earlier.device_id = recent.device_id AND earlier.timestamp < ${twoWeeks})
		`),
		db.execute(sql`
			SELECT
				COUNT(*) FILTER (WHERE timestamp >= ${day}) AS day,
				COUNT(*) FILTER (WHERE timestamp >= ${twoDays} AND timestamp < ${day}) AS previous_day,
				COUNT(*) FILTER (WHERE timestamp >= ${week}) AS week,
				COUNT(*) FILTER (WHERE timestamp < ${week}) AS previous_week
			FROM trips WHERE timestamp >= ${twoWeeks}
		`),
		db.execute(sql`
			SELECT
				COUNT(*) FILTER (WHERE timestamp >= ${day}) AS count,
				COUNT(*) FILTER (WHERE timestamp < ${day}) AS previous_count,
				COUNT(DISTINCT device_id) FILTER (WHERE timestamp >= ${day}) AS devices,
				COUNT(DISTINCT device_id) FILTER (WHERE timestamp < ${day}) AS previous_devices
			FROM errors WHERE timestamp >= ${twoDays}
		`),
		db.execute(sql`
			SELECT
				COUNT(*) FILTER (WHERE created_at >= ${week}) AS attempts,
				COUNT(*) FILTER (WHERE created_at < ${week}) AS previous_attempts,
				COUNT(*) FILTER (WHERE created_at >= ${week} AND outcome = 'confirmed') AS confirmed,
				COUNT(*) FILTER (WHERE created_at < ${week} AND outcome = 'confirmed') AS previous_confirmed
			FROM unlock_attempts WHERE created_at >= ${twoWeeks} AND NOT survey
		`),
		db.execute(sql`
			SELECT
				COUNT(*) FILTER (WHERE timestamp >= ${week}) AS count,
				COUNT(*) FILTER (WHERE timestamp < ${week}) AS previous_count,
				AVG(rating) FILTER (WHERE timestamp >= ${week}) AS average,
				AVG(rating) FILTER (WHERE timestamp < ${week}) AS previous_average
			FROM bike_ratings WHERE timestamp >= ${twoWeeks}
		`),
		db.execute(sql`
			SELECT app_version AS version, COALESCE(os, 'unknown') AS os, COUNT(*) AS devices
			FROM (
				SELECT DISTINCT ON (device_id) device_id, app_version, os
				FROM usage WHERE timestamp >= ${week} AND app_version IS NOT NULL
				ORDER BY device_id, timestamp DESC
			) AS latest
			GROUP BY 1, 2
		`),
	]);

	return {
		generatedAt: new Date(now).toISOString(),
		activeUsers: {
			day: compared(users, 'day', 'previous_day'),
			week: compared(users, 'week', 'previous_week'),
			month: compared(users, 'month', 'previous_month'),
		},
		newUsers: compared(newUsers, 'week', 'previous_week'),
		trips: { day: compared(trips, 'day', 'previous_day'), week: compared(trips, 'week', 'previous_week') },
		errors: { count: compared(errors, 'count', 'previous_count'), devices: compared(errors, 'devices', 'previous_devices') },
		unlocks: { attempts: compared(unlocks, 'attempts', 'previous_attempts'), confirmed: compared(unlocks, 'confirmed', 'previous_confirmed') },
		ratings: {
			count: compared(ratings, 'count', 'previous_count'),
			average: {
				current: ratings.average == null ? null : Number(ratings.average),
				previous: ratings.previous_average == null ? null : Number(ratings.previous_average),
			},
		},
		versions: versions.map(row => ({ version: String(row.version), os: String(row.os), devices: Number(row.devices) })),
	};
}
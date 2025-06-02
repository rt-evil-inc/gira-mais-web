import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';
import { sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

const initialDate = new Date(env.INITIAL_DATE || '2025-04-27');

export const GET: RequestHandler = async ({ url }) => {
	let startDate = url.searchParams.get('start');
	if (!startDate || Date.parse(startDate) < initialDate.getTime()) {
		startDate = initialDate.toISOString();
	} else {
		startDate = new Date(Date.parse(startDate)).toISOString();
	}
	let endDate = url.searchParams.get('end');
	if (!endDate || Date.parse(endDate) > (new Date).getTime()) {
		endDate = (new Date).toISOString();
	} else {
		endDate = new Date(Date.parse(endDate)).toISOString();
	}
	const groupBy = url.searchParams.get('groupBy') || 'hour'; // hour, day
	const timezone = url.searchParams.get('timezone') || 'UTC';
	const slidingWindow = parseInt(url.searchParams.get('slidingWindow') || '2'); // days
	const platform = url.searchParams.get('platform'); // android, ios, web, or null for all

	try {
		// For hour or day grouping
		let truncateFormat: string;
		let intervalUnit: string;

		if (groupBy === 'hour') {
			truncateFormat = 'hour';
			intervalUnit = '1 hour';
		} else {
			truncateFormat = 'day';
			intervalUnit = '1 day';
		}

		// Create the sliding window interval string
		const slidingWindowInterval = `${slidingWindow} days`;

		// Generate series of timestamps and get the last viewed version per device at each time point
		const seriesQuery = await db.execute(sql`
			WITH series AS (
				SELECT generate_series(
					DATE_TRUNC(${truncateFormat}, ${startDate}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}),
					DATE_TRUNC(${truncateFormat}, ${endDate}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}),
					${intervalUnit}::interval
				) AS time_point
			),
			device_versions_at_time AS (
				SELECT DISTINCT ON (series.time_point, u.device_id)
					series.time_point,
					u.device_id,
					COALESCE(u.app_version, 'Unknown') AS app_version,
					u.timestamp AS last_seen
				FROM 
					series
				LEFT JOIN "usage" AS u ON u.timestamp <= series.time_point
					AND u.timestamp >= ${startDate}
					AND u.app_version IS NOT NULL
					${platform ? sql`AND u.os = ${platform}` : sql``}
					-- Only include devices seen within the last 7 days from the current time point
					AND u.timestamp >= series.time_point - INTERVAL '7 days'
				WHERE u.device_id IS NOT NULL
					AND u.timestamp >= series.time_point - ${slidingWindowInterval}::interval
				ORDER BY series.time_point, u.device_id, u.timestamp DESC
			),
			version_counts AS (
				SELECT 
					time_point,
					app_version,
					COUNT(DISTINCT device_id) AS unique_devices
				FROM device_versions_at_time
				WHERE app_version IS NOT NULL
				GROUP BY time_point, app_version
			),
			all_versions AS (
				SELECT DISTINCT app_version FROM version_counts
			)
			SELECT 
				to_char(series.time_point AT TIME ZONE ${timezone}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
				all_versions.app_version,
				COALESCE(version_counts.unique_devices, 0) AS count
			FROM 
				series
			CROSS JOIN all_versions
			LEFT JOIN version_counts ON series.time_point = version_counts.time_point 
				AND all_versions.app_version = version_counts.app_version
			ORDER BY 
				series.time_point, all_versions.app_version
		`);

		// Group results by timestamp and create datasets for each app version
		const groupedData: Record<string, Record<string, number>> = {};
		const appVersions = new Set<string>;

		for (const row of seriesQuery) {
			const timestamp = row.timestamp as string;
			const appVersion = row.app_version as string;
			const count = Number(row.count);

			if (!groupedData[timestamp]) {
				groupedData[timestamp] = {};
			}
			groupedData[timestamp][appVersion] = count;
			appVersions.add(appVersion);
		}

		// Convert to array format with separate datasets for each app version
		const timestamps = Object.keys(groupedData).sort();
		const datasets: Array<{
			label: string;
			data: Array<{ timestamp: string; count: number }>;
		}> = [];

		for (const version of Array.from(appVersions).sort()) {
			const data = timestamps.map(timestamp => ({
				timestamp,
				count: groupedData[timestamp][version] || 0,
			}));

			datasets.push({
				label: version,
				data,
			});
		}

		return json({
			data: datasets,
			meta: {
				startDate,
				endDate,
				groupBy,
				timezone,
				slidingWindow,
				platform,
				appVersions: Array.from(appVersions).sort(),
			},
		});
	} catch (err) {
		console.error('Error fetching version statistics data:', err);
		throw error(500, { message: 'Failed to fetch version statistics data' });
	}
};
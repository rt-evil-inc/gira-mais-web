import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import {
	SERVICES,
	hourStatus,
	judgedByReports,
	worst,
	type FailureKind,
	type HourStatus,
	type ServiceId,
	type ServiceStatus,
	type StatusDay,
	type StatusHour,
	type StatusResponse,
} from '$lib/gira-status';
import type { RequestHandler } from './$types';

/** When EMEL switched GIRA to the VAIMOO backend; before it the services were different ones. */
const NEW_BACKEND_SINCE = new Date('2026-09-15T00:00:00Z');
const WINDOW_DAYS = 90;
const DETAIL_HOURS = 7 * 24;
const TIMEZONE = 'Europe/Lisbon';
/** The figures only move with the 5-minute checks; every visitor shares one computation. */
const CACHE_MS = 5 * 60_000;

/** "Gira+/1.6.1 (...)" or "1.6.1" as {1,6,1}, for comparing versions. */
const version = (column: ReturnType<typeof sql>) => sql`string_to_array(substring(${column} from '(\\d+\\.\\d+\\.\\d+)'), '.')::int[]`;
/** The first app version on the new backend; older ones still call the retired hosts and fail there. */
const NEW_BACKEND_VERSION = '{1,5,0}';

/**
 * User reports that say a service failed, by service and kind, and nothing else: refusals the app expects (a
 * broken bike, a rejected rating), bike signals and the user's own lack of connection don't count. The map's
 * feed isn't judged by reports (see ServiceDefinition.reported).
 */
const REPORT_SERVICE = sql`CASE
	WHEN e.error_code IN ('auth_api_communication_error', 'login_error') THEN 'login'
	ELSE 'api'
END`;
const REPORT_KIND = sql`CASE
	WHEN e.error_code LIKE '%communication_error' THEN CASE
		WHEN e.error_message ~* 'appears to be offline|not connected to the internet' THEN NULL
		WHEN e.error_message ~* 'timed out|timeout' THEN 'timeout'
		WHEN e.error_message ~* 'hostname could not be found|unable to resolve host|unknownhost|enotfound' THEN 'dns'
		WHEN e.error_message ~* 'tls|ssl|certificate|handshake' THEN 'tls'
		ELSE 'network'
	END
	WHEN substring(e.error_message from '"status":\\s*(\\d{3})')::int = 429 THEN 'rate_limited'
	WHEN substring(e.error_message from '"status":\\s*(\\d{3})')::int >= 500 THEN 'server'
END`;
const REPORTED_CODES = [
	'auth_api_communication_error',
	'gira_api_communication_error',
	'login_error',
	'gira_api_error',
	'token_refresh_error',
	'account_info_error',
	'user_info_error',
	'trip_status_error',
	'trip_history_error',
	'trip_rating_error',
];

type HourRecord = Omit<StatusHour, 'status' | 'hour'>;

async function compute(): Promise<StatusResponse> {
	const now = new Date;
	const since = new Date(Math.max(NEW_BACKEND_SINCE.getTime(), now.getTime() - WINDOW_DAYS * 86_400_000));
	const sinceIso = since.toISOString();
	const hourOf = (column: string) => sql.raw(`to_char(date_trunc('hour', ${column}), 'YYYY-MM-DD"T"HH24":00:00Z"')`);

	const [checks, reports, active] = await Promise.all([
		db.execute(sql`
			SELECT ${hourOf('timestamp')} AS hour, service, COUNT(*) AS total, COUNT(*) FILTER (WHERE NOT ok) AS failed,
				percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE ok) AS latency
			FROM gira_checks WHERE timestamp >= ${sinceIso}
			GROUP BY 1, 2
		`),
		db.execute(sql`
			WITH failures AS (
				SELECT ${hourOf('e.timestamp')} AS hour, ${REPORT_SERVICE} AS service, ${REPORT_KIND} AS kind, e.device_id
				FROM errors AS e
				WHERE e.timestamp >= ${sinceIso} AND e.error_code IN ${REPORTED_CODES} AND ${version(sql`e.user_agent`)} >= ${NEW_BACKEND_VERSION}::int[]
			)
			SELECT hour, service, kind, COUNT(DISTINCT device_id) AS devices
			FROM failures WHERE kind IS NOT NULL
			GROUP BY GROUPING SETS ((hour, service, kind), (hour, service))
		`),
		// Users active in the hour: they opened the app, or it reported a failure (it was open, if not opened then).
		db.execute(sql`
			SELECT hour, COUNT(DISTINCT device_id) AS devices FROM (
				SELECT ${hourOf('timestamp')} AS hour, device_id FROM usage WHERE timestamp >= ${sinceIso} AND ${version(sql`app_version`)} >= ${NEW_BACKEND_VERSION}::int[]
				UNION ALL
				SELECT ${hourOf('timestamp')} AS hour, device_id FROM errors WHERE timestamp >= ${sinceIso} AND error_code IN ${REPORTED_CODES} AND ${version(sql`user_agent`)} >= ${NEW_BACKEND_VERSION}::int[]
			) AS seen GROUP BY 1
		`),
	]);

	const activeByHour = new Map(active.map(row => [String(row.hour), Number(row.devices)]));
	// Services users' reports don't judge have no users to judge them by.
	const activeAt = (id: ServiceId, hour: string) => SERVICES[id].reported ? activeByHour.get(hour) ?? 0 : 0;
	const records = new Map<string, HourRecord>;
	const record = (service: string, hour: string) => {
		const key = `${service}:${hour}`;
		if (!records.has(key)) records.set(key, { checks: { total: 0, failed: 0, latencyMs: null }, reports: { active: 0, affected: 0, byKind: {} } });
		return records.get(key)!;
	};
	for (const row of checks) {
		record(String(row.service), String(row.hour)).checks = { total: Number(row.total), failed: Number(row.failed), latencyMs: row.latency == null ? null : Math.round(Number(row.latency)) };
	}
	for (const row of reports) {
		const entry = record(String(row.service), String(row.hour));
		if (row.kind == null) entry.reports.affected = Number(row.devices);
		else entry.reports.byKind[row.kind as FailureKind] = Number(row.devices);
	}

	// Every hour of the window, oldest first, so days and the detail chart have no holes.
	const hours: string[] = [];
	for (let time = Math.floor(since.getTime() / 3_600_000) * 3_600_000; time <= now.getTime(); time += 3_600_000) {
		hours.push(new Date(time).toISOString().replace('.000Z', 'Z'));
	}
	const dayOf = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

	const services = (Object.keys(SERVICES) as ServiceId[]).map((id): ServiceStatus => {
		const serviceHours = hours.map((hour): StatusHour & { hasData: boolean } => {
			const entry = records.get(`${id}:${hour}`);
			const reportsData = { active: activeAt(id, hour), affected: entry?.reports.affected ?? 0, byKind: entry?.reports.byKind ?? {} };
			const checksData = entry?.checks ?? { total: 0, failed: 0, latencyMs: null };
			return {
				hour,
				status: hourStatus(checksData, reportsData),
				checks: checksData,
				reports: reportsData,
				// Checks or enough users to judge the hour by; the night can go without either.
				hasData: checksData.total > 0 || judgedByReports(reportsData),
			};
		});

		const days = new Map<string, StatusDay>;
		for (const hour of serviceHours) {
			const day = dayOf.format(new Date(hour.hour));
			if (!days.has(day)) days.set(day, { day, status: 'no_data', degradedHours: 0, outageHours: 0, hours: 0, checks: { total: 0, failed: 0 }, peak: null });
			const entry = days.get(day)!;
			if (!hour.hasData) continue;
			entry.hours++;
			entry.status = worst([entry.status === 'no_data' ? 'operational' : entry.status, hour.status]);
			if (hour.status === 'degraded') entry.degradedHours++;
			if (hour.status === 'outage') entry.outageHours++;
			entry.checks.total += hour.checks.total;
			entry.checks.failed += hour.checks.failed;
			const share = hour.reports.active ? hour.reports.affected / hour.reports.active : 0;
			const peakShare = entry.peak?.active ? entry.peak.affected / entry.peak.active : 0;
			// The worst hour by users' reports, among hours with enough users to say.
			if (judgedByReports(hour.reports) && hour.reports.affected && (share > peakShare || (share === peakShare && hour.reports.affected > (entry.peak?.affected ?? 0)))) {
				entry.peak = { affected: hour.reports.affected, active: hour.reports.active };
			}
		}

		const judged = serviceHours.filter(hour => hour.hasData);
		// Now: the last full hour and the current one, so a fresh incident shows without waiting for the hour to end.
		const recent = judged.slice(-2).map(hour => hour.status as HourStatus);
		return {
			id,
			status: recent.length ? worst(recent) : 'no_data',
			uptime: judged.length ? judged.filter(hour => hour.status !== 'outage').length / judged.length : null,
			days: [...days.values()],
			hours: serviceHours.slice(-DETAIL_HOURS).map(({ hasData: _, ...hour }) => hour),
		};
	});

	return { generatedAt: now.toISOString(), since: sinceIso, services };
}

let cache: { at: number; result: Promise<StatusResponse> } | null = null;

/**
 * Uptime of the services behind GIRA over the last 90 days (since the new backend), hour by hour and day by day,
 * from the server's own checks and the failures Gira+ users report (see $lib/gira-status).
 */
export const GET: RequestHandler = async ({ setHeaders }) => {
	try {
		if (!cache || Date.now() - cache.at > CACHE_MS) {
			cache = { at: Date.now(), result: compute() };
			// A failed computation isn't kept for the next visitor.
			cache.result.catch(() => { cache = null; });
		}
		setHeaders({ 'Cache-Control': 'public, max-age=60' });
		return json(await cache.result);
	} catch (err) {
		console.error('Error computing GIRA service status:', err);
		throw error(500, { message: 'Failed to compute GIRA service status' });
	}
};
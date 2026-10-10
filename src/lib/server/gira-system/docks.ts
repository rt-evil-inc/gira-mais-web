import { env } from '$env/dynamic/private';

/** How long a dock can go without a bike before it counts as long empty (7 days unless configured). */
export const SUSPICIOUS_AFTER_HOURS = Number(env.GIRA_SUSPICIOUS_DOCK_HOURS) || 7 * 24;
const SUSPICIOUS_AFTER_MS = SUSPICIOUS_AFTER_HOURS * 3_600_000;

export interface DockRecord {
	occupied: boolean;
	lastOccupiedAt: Date;
}

/** Dock numbers come as "09" on some bikes and "9" on others. */
export function normalizeDock(dock: string) {
	const number = parseInt(dock, 10);
	return Number.isNaN(number) ? dock : String(number);
}

export const dockKey = (stationId: number, number: string) => `${stationId}:${number}`;

/**
 * The station's empty docks that haven't held a bike for SUSPICIOUS_AFTER_HOURS, and how many of the docks
 * the system calls free that makes suspicious.
 *
 * The feed says how many docks are free and, by difference, unavailable, but not which. A dock that can't take
 * bikes stays empty, so the unavailable docks are presumably among the long-empty ones; any long-empty docks
 * beyond them are docks the system reports as free. That makes the count a lower bound: a dock the system
 * only just marked unavailable may have held a bike recently.
 *
 * Only the docks seen with a bike have known numbers, and those don't always run 1 to DockLimit (a station of
 * 19 docks can have a dock 20). Docks never seen with a bike are counted instead, as DockLimit minus the numbers
 * seen, and are long empty once the station has been watched for the whole period. Long-empty docks can't
 * outnumber the station's empty ones: numbers seen before the station lost docks may no longer exist.
 */
export function longEmptyDocks(
	station: { id: number; dockLimit: number; freeDocks: number; unavailableDocks: number },
	docks: Map<string, DockRecord>,
	occupied: Set<string>,
	watchedSince: Date,
	now: Date,
) {
	const cutoff = now.getTime() - SUSPICIOUS_AFTER_MS;
	const prefix = `${station.id}:`;
	const seen = new Set<string>;
	for (const key of docks.keys()) if (key.startsWith(prefix)) seen.add(key.slice(prefix.length));
	let occupiedHere = 0;
	for (const key of occupied) {
		if (!key.startsWith(prefix)) continue;
		occupiedHere++;
		seen.add(key.slice(prefix.length));
	}

	const longEmpty: { number: string; lastOccupiedAt: Date }[] = [];
	for (const number of seen) {
		const key = dockKey(station.id, number);
		const record = docks.get(key);
		if (occupied.has(key) || !record) continue;
		if (record.lastOccupiedAt.getTime() < cutoff) longEmpty.push({ number, lastOccupiedAt: record.lastOccupiedAt });
	}
	longEmpty.sort((a, b) => (Number(a.number) || Infinity) - (Number(b.number) || Infinity));
	/** Docks never seen with a bike, long empty only once the station has been watched for the whole period. */
	const neverOccupied = watchedSince.getTime() < cutoff ? Math.max(0, station.dockLimit - seen.size) : 0;
	const longEmptyCount = Math.min(longEmpty.length + neverOccupied, Math.max(0, station.dockLimit - occupiedHere));
	const suspicious = Math.min(station.freeDocks, Math.max(0, longEmptyCount - station.unavailableDocks));
	return { longEmpty, neverOccupied, suspicious };
}
import { env } from '$env/dynamic/private';
import { stationInService } from '$lib/gira-system';

/** How long a station in service can go without its record changing before it counts as idle (48 hours unless configured). */
export const IDLE_AFTER_HOURS = Number(env.GIRA_IDLE_STATION_HOURS) || 48;

/**
 * Since when a station in service has been idle, or null. A station's record changes whenever a bike arrives or
 * leaves (its counts change), many times a day at a busy one; one that stays the same for days while the system
 * calls it available most likely has a controller or connection down, and the map shows it working regardless.
 */
export function idleSince(station: { sourceUpdatedAt: Date }, status: string, now: Date): Date | null {
	if (!stationInService(status)) return null;
	return now.getTime() - station.sourceUpdatedAt.getTime() >= IDLE_AFTER_HOURS * 3_600_000 ? station.sourceUpdatedAt : null;
}
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { giraBikes, giraDocks, giraSnapshots, giraStations } from '$lib/server/db/schema';
import { stationStatus, unavailableDocks } from '$lib/gira-system';
import { SUSPICIOUS_AFTER_HOURS, dockKey, longEmptyDocks, normalizeDock, type DockRecord } from '$lib/server/gira-system/docks';
import { IDLE_AFTER_HOURS, idleSince } from '$lib/server/gira-system/stations';
import { desc, isNotNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** Stations have a "123 - Street name" name; the number is what riders know them by. */
function stationNumber(name: string) {
	const match = /^\s*(\d+)\s*-\s*/.exec(name);
	return match ? { number: match[1], name: name.slice(match[0].length) } : { number: null, name };
}

function dockOrder(dock: string | null) {
	const number = dock == null ? NaN : parseInt(dock, 10);
	return Number.isNaN(number) ? Number.POSITIVE_INFINITY : number;
}

/**
 * The current state of every station as of the latest poll, with the bikes in its docks, and the stations and
 * bikes the feed has stopped returning. Served from the poller's tables, never from the feed itself.
 */
export const GET: RequestHandler = async ({ setHeaders }) => {
	try {
		const [[latest], stations, bikes, docks] = await Promise.all([
			db.select().from(giraSnapshots).orderBy(desc(giraSnapshots.timestamp)).limit(1),
			db.select().from(giraStations),
			db.select({
				id: giraBikes.id,
				visualId: giraBikes.visualId,
				stationId: giraBikes.stationId,
				dock: giraBikes.dock,
				battery: giraBikes.battery,
				reasons: giraBikes.reasons,
				status: giraBikes.status,
				lastSeenAt: giraBikes.lastSeenAt,
				missingSince: giraBikes.missingSince,
			}).from(giraBikes).where(isNotNull(giraBikes.stationId)),
			db.select().from(giraDocks),
		]);

		// Judged as of the latest poll, as its totals are.
		const now = latest?.timestamp ?? new Date;
		const dockRecords = new Map<string, DockRecord>(docks.map(dock => [dockKey(dock.stationId, dock.number), dock]));
		const docksSince = docks.reduce<Date | null>((earliest, dock) => !earliest || dock.firstSeenAt < earliest ? dock.firstSeenAt : earliest, null) ?? now;
		const occupied = new Set(bikes.filter(bike => !bike.missingSince && bike.stationId != null && bike.dock != null).map(bike => dockKey(bike.stationId!, normalizeDock(bike.dock!))));

		const bikesAt = new Map<number, typeof bikes>;
		for (const bike of bikes) {
			// A bike riding away keeps the station it left from, without a dock; one about to start is still docked.
			if (bike.missingSince || bike.stationId == null || (bike.status === 'in_trip' && bike.dock == null)) continue;
			if (!bikesAt.has(bike.stationId)) bikesAt.set(bike.stationId, []);
			bikesAt.get(bike.stationId)!.push(bike);
		}

		const stationNames = new Map(stations.map(station => [station.id, station.name]));

		const result = stations.map(station => {
			const atStation = (bikesAt.get(station.id) ?? []).sort((a, b) => dockOrder(a.dock) - dockOrder(b.dock) || a.visualId.localeCompare(b.visualId));
			const docked = atStation.filter(bike => bike.dock != null);
			const unavailable = unavailableDocks(station, docked.length);
			const watchedSince = new Date(Math.max(station.firstSeenAt.getTime(), docksSince.getTime()));
			const { longEmpty, neverOccupied, suspicious } = station.missingSince ?
				{ longEmpty: [], neverOccupied: 0, suspicious: 0 } :
				longEmptyDocks({ id: station.id, dockLimit: station.dockLimit, freeDocks: station.freeDocks, unavailableDocks: unavailable }, dockRecords, occupied, watchedSince, now);
			return {
				id: station.id,
				...stationNumber(station.name),
				address: station.address,
				latitude: station.latitude,
				longitude: station.longitude,
				status: station.missingSince ? 'missing' : stationStatus(station),
				serviceStatus: station.serviceStatus,
				dockLimit: station.dockLimit,
				freeDocks: station.freeDocks,
				unavailableDocks: unavailable,
				/** Of freeDocks, how many are suspicious. */
				suspiciousDocks: suspicious,
				/** Empty docks without a bike for SUSPICIOUS_AFTER_HOURS, with when they last had one. */
				longEmptyDocks: longEmpty,
				/** Docks never seen with a bike since tracking began, once that's longer than SUSPICIOUS_AFTER_HOURS. */
				neverOccupiedDocks: neverOccupied,
				availableBikes: station.availableBikes,
				idleSince: station.missingSince ? null : idleSince(station, stationStatus(station), now),
				firstSeenAt: station.firstSeenAt,
				lastSeenAt: station.missingSince ? station.lastSeenAt : latest?.timestamp ?? station.lastSeenAt,
				missingSince: station.missingSince,
				bikes: atStation.map(bike => ({ visualId: bike.visualId, dock: bike.dock, battery: bike.battery, status: bike.status, reasons: bike.reasons })),
			};
		}).sort((a, b) => (Number(a.number) || Infinity) - (Number(b.number) || Infinity) || a.name.localeCompare(b.name));

		const missingBikes = await db.select({
			visualId: giraBikes.visualId,
			stationId: giraBikes.stationId,
			dock: giraBikes.dock,
			status: giraBikes.status,
			firstSeenAt: giraBikes.firstSeenAt,
			lastSeenAt: giraBikes.lastSeenAt,
			missingSince: giraBikes.missingSince,
		}).from(giraBikes).where(isNotNull(giraBikes.missingSince)).orderBy(desc(giraBikes.missingSince));

		// The poller refreshes this every few minutes; let browsers and proxies reuse it for a minute.
		setHeaders({ 'Cache-Control': 'public, max-age=60' });
		return json({
			polledAt: latest?.timestamp ?? null,
			suspiciousAfterHours: SUSPICIOUS_AFTER_HOURS,
			idleAfterHours: IDLE_AFTER_HOURS,
			/** Since when docks are tracked; before SUSPICIOUS_AFTER_HOURS have passed, only docks seen with a bike can be long empty. */
			docksSince: docks.length ? docksSince : null,
			totals: latest ? { stations: latest.stations, occupancy: latest.occupancy, docks: latest.docks, bikes: latest.bikes } : null,
			stations: result,
			missingBikes: missingBikes.map(bike => ({
				...bike,
				// Where it was last seen: the station it was docked at, if any.
				stationName: bike.stationId != null ? stationNames.get(bike.stationId) ?? null : null,
			})),
		});
	} catch (err) {
		console.error('Error fetching GIRA stations:', err);
		throw error(500, { message: 'Failed to fetch GIRA stations' });
	}
};
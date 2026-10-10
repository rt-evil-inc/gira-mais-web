import { db } from '$lib/server/db';
import { giraBikes, giraDocks, giraEvents, giraSnapshots, giraStations } from '$lib/server/db/schema';
import { DOCK_STATUSES, bikeReasons, bikeStatus, stationOccupancy, stationStatus, unavailableDocks, unavailableReason } from '$lib/gira-system';
import { and, eq, getTableColumns, inArray, max, min, sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { queryTenantCollection, type FirestoreBike, type FirestoreStation } from './firestore';
import { dockKey, longEmptyDocks, normalizeDock, type DockRecord } from './docks';
import { checked, ServiceError } from '$lib/server/gira-status/checks';
import { idleSince } from './stations';

/*
 * Polls the whole GIRA feed (~200 stations, ~2,500 bikes) on a fixed schedule and records status totals.
 *
 * A full read costs VAIMOO one Firestore document read per record, ~2,700 per poll: every 5 minutes that is
 * ~32k reads an hour, in two gzipped requests of ~250 KB. A live listener bills each change instead, and the
 * feed changed ~19k times an hour on a Sunday evening, mostly battery levels. That is fewer reads, but it
 * grows with activity, needs the Firebase SDK and a long-lived connection kept alive, and 5-minute snapshots
 * don't need it. Polls are aligned to the clock, offset from the minute, and back off while the feed fails.
 */

const POLL_OFFSET_MS = 37_000;
const MAX_BACKOFF_STEPS = 3;
const BATCH_SIZE = 500;

type StationRow = typeof giraStations.$inferInsert;
type BikeRow = typeof giraBikes.$inferInsert;
type Known = { sourceUpdatedAt: number; missing: boolean };

interface PollerState {
	stations: Map<number, Known & { dockLimit: number; firstSeenAt: Date; status: string }>;
	bikes: Map<number, Known>;
	/** By dockKey. */
	docks: Map<string, DockRecord>;
	/** When dock tracking began, for docks never seen with a bike. */
	docksSince: Date | null;
	lastPollAt: Date | null;
}

function toStationRow(id: number, station: FirestoreStation, sourceUpdatedAt: Date, now: Date): StationRow {
	return {
		id,
		name: station.Name,
		address: [station.StreetBuildingIdentifier, station.Street].filter(Boolean).join(' ') || null,
		latitude: station.Location?.latitude ?? null,
		longitude: station.Location?.longitude ?? null,
		active: station.IsActive,
		serviceStatus: station.ServiceStatus ?? null,
		dockLimit: Math.max(0, Math.trunc(station.DockLimit ?? 0)),
		freeDocks: Math.max(0, Math.trunc(station.FreeDocks ?? 0)),
		availableBikes: Math.max(0, Math.trunc(station.AvailableBikes ?? 0)),
		sourceUpdatedAt,
		lastSeenAt: now,
		missingSince: null,
	};
}

function toBikeRow(id: number, bike: FirestoreBike, sourceUpdatedAt: Date, now: Date): BikeRow {
	// Bikes out of a station carry DockingStationId null or -1.
	const stationId = bike.DockingStationId != null && bike.DockingStationId > 0 ? bike.DockingStationId : null;
	const dock = stationId != null ? bike.DockingPointVisualId || null : null;
	const reasons = bikeReasons(bike.Comment);
	return {
		id,
		visualId: bike.VisualId,
		category: bike.Category ?? null,
		stationId,
		dockId: dock ? bike.DockingPointId ?? null : null,
		dock,
		available: bike.IsAvaliable,
		booked: bike.IsBooked,
		tripState: bike.TripVehicleState ?? null,
		tripErrorCode: bike.TripErrorCode ?? null,
		battery: bike.BatteryPercentage ?? null,
		reasons,
		status: bikeStatus({ available: bike.IsAvaliable, booked: bike.IsBooked, tripState: bike.TripVehicleState ?? null, docked: dock != null, reasons }),
		sourceUpdatedAt,
		lastSeenAt: now,
		missingSince: null,
	};
}

function count<K extends string>(keys: readonly K[]): Record<K, number> {
	return Object.fromEntries(keys.map(key => [key, 0])) as Record<K, number>;
}

/** The docks holding a bike in this poll, by dockKey, with the dock's VAIMOO id. */
function occupiedDocks(bikes: BikeRow[]) {
	const occupied = new Map<string, { stationId: number; number: string; dockId: number | null }>;
	for (const bike of bikes) {
		if (bike.stationId == null || bike.dock == null) continue;
		const number = normalizeDock(bike.dock);
		occupied.set(dockKey(bike.stationId, number), { stationId: bike.stationId, number, dockId: bike.dockId ?? null });
	}
	return occupied;
}

/** Status totals of one poll; the feed's current records plus those it has stopped returning. */
function snapshotCounts(stations: StationRow[], bikes: BikeRow[], state: PollerState, now: Date) {
	const stationCounts: Record<string, number> = {};
	for (const station of stations) {
		const status = stationStatus(station);
		stationCounts[status] = (stationCounts[status] ?? 0) + 1;
	}
	stationCounts.missing = [...state.stations.values()].filter(station => station.missing).length;

	const add = (counts: Record<string, number>, key: string) => { counts[key] = (counts[key] ?? 0) + 1; };

	const bikeCounts: Record<string, number> = {};
	const bikeKey = (bike: BikeRow) => {
		if (bike.status === 'unavailable') return `unavailable:${unavailableReason(bike.reasons)}`;
		if (bike.status === 'outside') return `outside:${bike.stationId != null ? 'at_station' : 'elsewhere'}`;
		return bike.status;
	};
	for (const bike of bikes) add(bikeCounts, bikeKey(bike));
	bikeCounts.missing = [...state.bikes.values()].filter(bike => bike.missing).length;

	const dockCounts = count(Object.keys(DOCK_STATUSES) as (keyof typeof DOCK_STATUSES)[]);
	const occupancyCounts: Record<string, number> = {};
	const dockedAt = new Map<number, number>;
	const availableAt = new Map<number, number>;
	for (const bike of bikes) {
		if (bike.stationId == null || bike.dock == null) continue;
		dockedAt.set(bike.stationId, (dockedAt.get(bike.stationId) ?? 0) + 1);
		if (bike.status === 'available') availableAt.set(bike.stationId, (availableAt.get(bike.stationId) ?? 0) + 1);
		dockCounts[bike.status === 'available' ? 'available_bike' : 'unavailable_bike']++;
	}
	const occupied = new Set(occupiedDocks(bikes).keys());
	for (const station of stations) {
		const unavailable = unavailableDocks(station, dockedAt.get(station.id) ?? 0);
		const firstSeenAt = state.stations.get(station.id)?.firstSeenAt ?? now;
		const watchedSince = new Date(Math.max(firstSeenAt.getTime(), (state.docksSince ?? now).getTime()));
		const { suspicious } = longEmptyDocks({ id: station.id, dockLimit: station.dockLimit, freeDocks: station.freeDocks, unavailableDocks: unavailable }, state.docks, occupied, watchedSince, now);
		dockCounts.free += station.freeDocks - suspicious;
		dockCounts.suspicious += suspicious;
		dockCounts.unavailable += unavailable;
		const status = stationStatus(station);
		const idle = idleSince(station, status, now) != null;
		const occupancy = stationOccupancy(status, availableAt.get(station.id) ?? 0, station.freeDocks - suspicious, idle);
		add(occupancyCounts, occupancy === 'out_of_service' ? `out_of_service:${status}` : occupancy);
	}
	occupancyCounts.missing = stationCounts.missing;
	dockCounts.missing = [...state.stations.values()].filter(station => station.missing).reduce((total, station) => total + station.dockLimit, 0);

	return { stations: stationCounts, occupancy: occupancyCounts, bikes: bikeCounts, docks: dockCounts };
}

/** `excluded.<column>` for every column but the ones kept from the first insert. */
function excludedSet(table: PgTable, keep: string[]) {
	const set: Record<string, SQL> = {};
	for (const [key, column] of Object.entries(getTableColumns(table))) {
		if (!keep.includes(key)) set[key] = sql.raw(`excluded."${column.name}"`);
	}
	return set;
}

function chunks<T>(items: T[]): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < items.length; i += BATCH_SIZE) result.push(items.slice(i, i + BATCH_SIZE));
	return result;
}

async function loadState(): Promise<PollerState> {
	const [stations, bikes, docks, [docksSince], [latest]] = await Promise.all([
		db.select({ id: giraStations.id, sourceUpdatedAt: giraStations.sourceUpdatedAt, missingSince: giraStations.missingSince, dockLimit: giraStations.dockLimit, firstSeenAt: giraStations.firstSeenAt, active: giraStations.active, serviceStatus: giraStations.serviceStatus }).from(giraStations),
		db.select({ id: giraBikes.id, sourceUpdatedAt: giraBikes.sourceUpdatedAt, missingSince: giraBikes.missingSince }).from(giraBikes),
		db.select({ stationId: giraDocks.stationId, number: giraDocks.number, occupied: giraDocks.occupied, lastOccupiedAt: giraDocks.lastOccupiedAt }).from(giraDocks),
		db.select({ timestamp: min(giraDocks.firstSeenAt) }).from(giraDocks),
		db.select({ timestamp: max(giraSnapshots.timestamp) }).from(giraSnapshots),
	]);
	return {
		stations: new Map(stations.map(row => [row.id, { sourceUpdatedAt: row.sourceUpdatedAt.getTime(), missing: row.missingSince != null, dockLimit: row.dockLimit, firstSeenAt: row.firstSeenAt, status: stationStatus(row) }])),
		bikes: new Map(bikes.map(row => [row.id, { sourceUpdatedAt: row.sourceUpdatedAt.getTime(), missing: row.missingSince != null }])),
		docks: new Map(docks.map(row => [dockKey(row.stationId, row.number), { occupied: row.occupied, lastOccupiedAt: row.lastOccupiedAt }])),
		docksSince: docksSince?.timestamp ?? null,
		lastPollAt: latest?.timestamp ?? null,
	};
}

type Event = typeof giraEvents.$inferInsert;

/** Records the feed returned this time that are new, changed or back, and the events they raise. */
function diff<T extends { id: number; sourceUpdatedAt: Date }>(
	entity: 'station' | 'bike',
	rows: T[],
	known: Map<number, Known>,
	now: Date,
	events: Event[],
) {
	// On the very first poll everything is new; that isn't worth an event per record.
	const seeding = known.size === 0;
	const changed: T[] = [];
	const present = new Set<number>;
	for (const row of rows) {
		present.add(row.id);
		const previous = known.get(row.id);
		if (!previous) {
			if (!seeding) events.push({ timestamp: now, entity, entityId: row.id, type: 'appeared' });
			changed.push(row);
		} else if (previous.missing) {
			events.push({ timestamp: now, entity, entityId: row.id, type: 'reappeared' });
			changed.push(row);
		} else if (previous.sourceUpdatedAt !== row.sourceUpdatedAt.getTime()) {
			changed.push(row);
		}
	}
	const disappeared = [...known].filter(([id, record]) => !record.missing && !present.has(id)).map(([id]) => id);
	for (const id of disappeared) events.push({ timestamp: now, entity, entityId: id, type: 'disappeared' });
	return { changed, disappeared };
}

async function poll(state: PollerState) {
	// One collection after the other, not both at once: no need to hit the feed harder than that.
	// Each request is recorded as a check of the feed, for its uptime. An empty answer is an outage or a changed
	// tenant, not every record disappearing at once, so it fails the check and the poll.
	const nonEmpty = async <T>(collectionId: 'docking-stations' | 'bikes') => {
		const documents = await queryTenantCollection<T>(collectionId);
		if (!documents.length) throw new ServiceError(`Feed returned no ${collectionId}`);
		return documents;
	};
	const stationDocuments = await checked('feed', 'docking-stations', () => nonEmpty<FirestoreStation>('docking-stations'));
	const bikeDocuments = await checked('feed', 'bikes', () => nonEmpty<FirestoreBike>('bikes'));

	const now = new Date;
	const stations = stationDocuments.map(document => toStationRow(Number(document.data.DockingStationId ?? document.id), document.data, document.updateTime, now));
	const bikes = bikeDocuments.map(document => toBikeRow(Number(document.data.BikeId ?? document.id), document.data, document.updateTime, now));

	const events: Event[] = [];
	const stationDiff = diff('station', stations, state.stations, now, events);
	const bikeDiff = diff('bike', bikes, state.bikes, now, events);
	for (const station of stations) {
		const previous = state.stations.get(station.id);
		const status = stationStatus(station);
		if (previous && previous.status !== status) {
			events.push({ timestamp: now, entity: 'station', entityId: station.id, type: 'status_changed', details: { from: previous.status, to: status } });
		}
		if (previous && previous.dockLimit !== station.dockLimit) {
			events.push({ timestamp: now, entity: 'station', entityId: station.id, type: 'docks_changed', details: { from: previous.dockLimit, to: station.dockLimit } });
			if (!stationDiff.changed.includes(station)) stationDiff.changed.push(station);
		}
	}
	const lastSeenAt = state.lastPollAt ?? now;

	// Docks are only written when a bike arrives or leaves, not on every poll for every occupied dock.
	const occupied = occupiedDocks(bikes);
	const arrivals = [...occupied].filter(([key]) => !state.docks.get(key)?.occupied).map(([, dock]) => dock);
	const departures = [...state.docks].filter(([key, dock]) => dock.occupied && !occupied.has(key)).map(([key]) => key);

	await db.transaction(async tx => {
		for (const batch of chunks(stationDiff.changed)) {
			await tx.insert(giraStations).values(batch).onConflictDoUpdate({ target: giraStations.id, set: excludedSet(giraStations, ['id', 'firstSeenAt']) });
		}
		for (const batch of chunks(bikeDiff.changed)) {
			await tx.insert(giraBikes).values(batch).onConflictDoUpdate({ target: giraBikes.id, set: excludedSet(giraBikes, ['id', 'firstSeenAt']) });
		}
		if (stationDiff.disappeared.length) {
			await tx.update(giraStations).set({ missingSince: now, lastSeenAt }).where(inArray(giraStations.id, stationDiff.disappeared));
		}
		for (const batch of chunks(bikeDiff.disappeared)) {
			await tx.update(giraBikes).set({ missingSince: now, lastSeenAt }).where(inArray(giraBikes.id, batch));
		}
		for (const batch of chunks(events)) await tx.insert(giraEvents).values(batch);
		for (const batch of chunks(arrivals)) {
			await tx.insert(giraDocks).values(batch.map(dock => ({ ...dock, occupied: true, lastOccupiedAt: now })))
				.onConflictDoUpdate({ target: [giraDocks.stationId, giraDocks.number], set: excludedSet(giraDocks, ['stationId', 'number', 'firstSeenAt']) });
		}
		// A dock that just emptied last held its bike at the previous poll.
		for (const key of departures) {
			const [stationId, number] = [Number(key.slice(0, key.indexOf(':'))), key.slice(key.indexOf(':') + 1)];
			await tx.update(giraDocks).set({ occupied: false, lastOccupiedAt: lastSeenAt }).where(and(eq(giraDocks.stationId, stationId), eq(giraDocks.number, number)));
		}

		// Counting missing records needs the state as of this poll, so update a copy first.
		const next: PollerState = { stations: new Map(state.stations), bikes: new Map(state.bikes), docks: new Map(state.docks), docksSince: state.docksSince ?? now, lastPollAt: now };
		for (const station of stations) {
			next.stations.set(station.id, { sourceUpdatedAt: station.sourceUpdatedAt.getTime(), missing: false, dockLimit: station.dockLimit, firstSeenAt: state.stations.get(station.id)?.firstSeenAt ?? now, status: stationStatus(station) });
		}
		for (const dock of arrivals) next.docks.set(dockKey(dock.stationId, dock.number), { occupied: true, lastOccupiedAt: now });
		for (const key of departures) next.docks.set(key, { occupied: false, lastOccupiedAt: lastSeenAt });
		for (const bike of bikes) next.bikes.set(bike.id, { sourceUpdatedAt: bike.sourceUpdatedAt.getTime(), missing: false });
		for (const id of stationDiff.disappeared) next.stations.set(id, { ...next.stations.get(id)!, missing: true });
		for (const id of bikeDiff.disappeared) next.bikes.set(id, { ...next.bikes.get(id)!, missing: true });

		await tx.insert(giraSnapshots).values({ timestamp: now, ...snapshotCounts(stations, bikes, next, now) });

		// Only adopt the new state once the transaction is about to commit.
		Object.assign(state, next);
	});

	return { stations: stations.length, bikes: bikes.length, changed: stationDiff.changed.length + bikeDiff.changed.length, docks: arrivals.length + departures.length, events: events.length };
}

interface Poller {
	stop: () => void;
	/** Settles once the poll in progress, if any, has finished. */
	idle: () => Promise<unknown>;
}

// Vite re-runs the server hooks on every change in development; keep a single poller across reloads.
const globalPoller = globalThis as typeof globalThis & { __giraSystemPoller?: Poller };

export function startGiraSystemPoller({ intervalMinutes }: { intervalMinutes: number }) {
	const previous = globalPoller.__giraSystemPoller;
	previous?.stop();

	const intervalMs = intervalMinutes * 60_000;
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let failures = 0;
	let state: PollerState | null = null;
	let inFlight: Promise<void> | null = null;

	/** The next slot on the clock (e.g. :05:37, :10:37 for 5 minutes), skipping slots while the feed keeps failing. */
	function nextSlot(from: number) {
		const slots = 2 ** Math.min(failures, MAX_BACKOFF_STEPS);
		const slot = Math.floor((from - POLL_OFFSET_MS) / intervalMs) + slots;
		return slot * intervalMs + POLL_OFFSET_MS;
	}

	function schedule(at: number) {
		if (stopped) return;
		timer = setTimeout(() => { inFlight = run().finally(() => { inFlight = null; }); }, Math.max(0, at - Date.now()));
	}

	async function run() {
		try {
			state ??= await loadState();
			const started = Date.now();
			const result = await poll(state);
			failures = 0;
			console.log(`GIRA poll: ${result.stations} stations, ${result.bikes} bikes, ${result.changed} changed, ${result.docks} dock changes, ${result.events} events in ${Date.now() - started} ms`);
		} catch (error) {
			failures++;
			// The in-memory state may be behind what the transaction managed to write; reload it next time.
			state = null;
			// Not the error itself: a failed batch insert carries the whole query and its thousands of parameters.
			const cause = error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : '';
			console.error(`GIRA poll failed (${failures} in a row): ${error instanceof Error ? error.message.split('\n')[0].slice(0, 200) : error}${cause}`);
		}
		schedule(nextSlot(Date.now()));
	}

	// Start right away if the last poll is overdue (e.g. after a deploy), otherwise wait for the next slot.
	(async () => {
		// After a reload, the replaced poller's poll may still be committing; its writes are part of the state.
		// (A poller from before idle() existed has none.) Nothing here may reject: it would take the server down.
		await Promise.resolve(previous?.idle?.()).catch(() => {});
		try {
			state = await loadState();
		} catch (error) {
			console.error('Could not load the GIRA poller state:', error);
		}
		const overdue = !state?.lastPollAt || Date.now() - state.lastPollAt.getTime() > intervalMs;
		schedule(overdue ? Date.now() + 10_000 : nextSlot(Date.now()));
	})();

	console.log(`GIRA system poller started, every ${intervalMinutes} minutes`);
	globalPoller.__giraSystemPoller = {
		stop() {
			stopped = true;
			if (timer) clearTimeout(timer);
		},
		idle: () => inFlight ?? Promise.resolve(),
	};
}
/*
 * Bikes on their way to a station: riders navigating to a destination share the station they will dock at
 * and when they expect to get there, so the app can show the station's incoming bikes to everyone else.
 *
 * Kept in memory only. An arrival is worth something for a few minutes, the app re-sends it as the rider moves,
 * and losing them all on a restart costs at most a few minutes of missing ETAs. Nothing ties an arrival to a
 * device: its id is a random token the app makes for each trip, and it doubles as the secret for changing it.
 * The bike's plate is shared too, so the app can show the incoming bike's type, battery and condition.
 */

/** How long after its expected time an arrival is still shown: riders run a little late. */
export const OVERDUE_GRACE_MS = 2 * 60_000;
/**
 * An arrival the rider stopped updating, e.g. the app was killed mid-trip, is dropped after this. The app resends
 * its arrival every minute, so this allows for two missed updates.
 */
export const STALE_AFTER_MS = 3 * 60_000;
/** The furthest ahead an arrival may be; no ride across Lisbon takes longer. */
export const MAX_AHEAD_MS = 2 * 60 * 60_000;
/** Bounds memory if someone floods the endpoint; far more than GIRA has bikes. */
export const MAX_ARRIVALS = 5_000;
/** The most arrivals returned for one station. */
export const MAX_STATION_ARRIVALS = 20;

export const ARRIVAL_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
/** A bike's VisualId, e.g. E1336. */
export const BIKE_PLATE_PATTERN = /^[A-Za-z0-9]{1,16}$/;

type Arrival = { station: string; bike: string | null; arrivesAt: number; updatedAt: number };

const arrivals = new Map<string, Arrival>;

function expired(arrival: Arrival, now: number) {
	return now > arrival.arrivesAt + OVERDUE_GRACE_MS || now - arrival.updatedAt > STALE_AFTER_MS;
}

function sweep(now: number) {
	for (const [id, arrival] of arrivals) if (expired(arrival, now)) arrivals.delete(id);
}

export type PutResult = 'ok' | 'too-early' | 'too-late' | 'full';

/** Add or move an arrival. Times are epoch milliseconds. */
export function putArrival(id: string, station: string, bike: string | null, arrivesAt: number, now = Date.now()): PutResult {
	if (arrivesAt < now - OVERDUE_GRACE_MS) return 'too-early';
	if (arrivesAt > now + MAX_AHEAD_MS) return 'too-late';
	if (!arrivals.has(id) && arrivals.size >= MAX_ARRIVALS) {
		sweep(now);
		if (arrivals.size >= MAX_ARRIVALS) return 'full';
	}
	arrivals.set(id, { station, bike, arrivesAt, updatedAt: now });
	return 'ok';
}

export function deleteArrival(id: string) {
	return arrivals.delete(id);
}

/** The station's upcoming arrivals, soonest first. */
export function stationArrivals(station: string, now = Date.now()) {
	sweep(now);
	const result: { arrivesAt: number; bike: string | null }[] = [];
	for (const arrival of arrivals.values()) {
		if (arrival.station === station) result.push({ arrivesAt: arrival.arrivesAt, bike: arrival.bike });
	}
	return result.sort((a, b) => a.arrivesAt - b.arrivesAt).slice(0, MAX_STATION_ARRIVALS);
}

/** For tests. */
export function clearArrivals() {
	arrivals.clear();
}
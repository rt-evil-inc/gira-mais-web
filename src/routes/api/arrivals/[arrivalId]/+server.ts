import { error, isHttpError, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { giraStations } from '$lib/server/db/schema';
import { cached } from '$lib/server/cache';
import { ARRIVAL_ID_PATTERN, BIKE_PLATE_PATTERN, deleteArrival, putArrival } from '$lib/server/arrivals';
import { optionalString, requireAppUserAgent, requireString } from '$lib/server/unlock-attempts';
import { isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const STATIONS_CACHE_MS = 10 * 60_000;

/** The stations the GIRA feed currently lists, or null while the poller hasn't stored any (e.g. in development). */
async function knownStations() {
	const ids = await cached('arrivals:stations', STATIONS_CACHE_MS, async () => {
		const rows = await db.select({ id: giraStations.id }).from(giraStations).where(isNull(giraStations.missingSince));
		return new Set(rows.map(row => String(row.id)));
	});
	return ids.size > 0 ? ids : null;
}

function requireArrivalId(value: string | undefined) {
	if (!value || !ARRIVAL_ID_PATTERN.test(value)) throw error(400, { message: 'invalid arrival id' });
	return value;
}

/**
 * Share or update when the rider expects to dock at a station: `{ station, bike, arrivesAt }`, bike being the
 * plate (optional) and arrivesAt in ISO 8601.
 */
export const PUT: RequestHandler = async ({ request, params }) => {
	try {
		requireAppUserAgent(request);
		const id = requireArrivalId(params.arrivalId);
		const body = await request.json();
		const station = requireString(body.station, 'station', 9);
		const bike = optionalString(body.bike, 'bike', 16)?.toUpperCase() ?? null;
		if (bike && !BIKE_PLATE_PATTERN.test(bike)) throw error(400, { message: 'invalid bike' });
		const arrivesAt = typeof body.arrivesAt === 'string' ? Date.parse(body.arrivesAt) : NaN;
		if (Number.isNaN(arrivesAt)) throw error(400, { message: 'arrivesAt must be an ISO 8601 date' });

		const stations = await knownStations().catch(err => {
			// Better to take an unchecked arrival than to drop it because the database hiccuped.
			console.error('Could not load stations to check an arrival:', err);
			return null;
		});
		if (stations ? !stations.has(station) : !/^\d{1,9}$/.test(station)) throw error(400, { message: 'unknown station' });

		const result = putArrival(id, station, bike, arrivesAt);
		if (result === 'too-early' || result === 'too-late') throw error(400, { message: `arrivesAt is ${result === 'too-early' ? 'in the past' : 'too far ahead'}` });
		if (result === 'full') throw error(503, { message: 'too many arrivals' });
		return json({ success: true });
	} catch (err) {
		if (isHttpError(err)) throw err;
		if (err instanceof SyntaxError) throw error(400, { message: 'invalid JSON body' });
		console.error('Error handling arrival:', err);
		throw error(500, { message: 'An unknown error occurred' });
	}
};

/** The rider docked, gave up on the destination or stopped sharing. Deleting an arrival that is already gone is fine. */
export const DELETE: RequestHandler = async ({ request, params }) => {
	requireAppUserAgent(request);
	deleteArrival(requireArrivalId(params.arrivalId));
	return json({ success: true });
};
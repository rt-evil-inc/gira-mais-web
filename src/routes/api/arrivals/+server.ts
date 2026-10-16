import { error, json } from '@sveltejs/kit';
import { stationArrivals } from '$lib/server/arrivals';
import type { RequestHandler } from './$types';

/** The bikes riders are bringing to a station, as `{ arrivals: [{ arrivesAt, bike }] }`, soonest first. */
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const station = url.searchParams.get('station');
	if (!station || !/^\d{1,9}$/.test(station)) throw error(400, { message: 'station must be a station id' });
	setHeaders({ 'Cache-Control': 'no-store' });
	const arrivals = stationArrivals(station);
	return json({ arrivals: arrivals.map(({ arrivesAt, bike }) => ({ arrivesAt: new Date(arrivesAt).toISOString(), bike })) });
};
import { json } from '@sveltejs/kit';
import { getOverview } from '$lib/server/overview';
import type { RequestHandler } from './$types';

/** Active users, new users and trips in the last 7 days, from the admin dashboard's figures. */
export const GET: RequestHandler = async ({ setHeaders }) => {
	const overview = await getOverview();
	setHeaders({ 'Cache-Control': 'public, max-age=60' });
	return json({
		users: overview.activeUsers.week.current,
		newUsers: overview.newUsers.current,
		trips: overview.trips.week.current,
	});
};
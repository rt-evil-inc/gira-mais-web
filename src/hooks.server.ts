import { env } from '$env/dynamic/private';
import { building, dev } from '$app/environment';
import type { Handle, ServerInit } from '@sveltejs/kit';
import { startGiraSystemPoller } from '$lib/server/gira-system/poller';
import { startStatusProbes } from '$lib/server/gira-status/probes';

// Check if admin credentials are set
if (!env.ADMIN_LOGIN) {
	console.warn('⚠️ WARNING: ADMIN_LOGIN environment variable is not set. The admin pages and endpoints will refuse every request without it.');
}

export const init: ServerInit = () => {
	if (building) return;
	// On in production; development servers share a database, so they only poll when asked to.
	const polling = env.GIRA_POLLING ? env.GIRA_POLLING === 'true' : !dev;
	if (!polling) return;
	startGiraSystemPoller({ intervalMinutes: Number(env.GIRA_POLLING_INTERVAL_MINUTES) || 5 });
	startStatusProbes();
};

/** Whether the request is for an admin page or endpoint, however its path is encoded ("/%61dmin" is "/admin"). */
function isAdmin(pathname: string, routeId: string | null) {
	if (routeId?.startsWith('/admin') || routeId?.startsWith('/api/admin')) return true;
	try {
		return decodeURIComponent(pathname).includes('/admin');
	} catch {
		// Undecodable paths match no route anyway; refuse them rather than guess.
		return true;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	if (isAdmin(event.url.pathname, event.route.id)) {
		const auth = event.request.headers.get('Authorization');

		if (!env.ADMIN_LOGIN || auth !== `Basic ${btoa(env.ADMIN_LOGIN)}`) {
			return new Response('Not authorized', {
				status: 401,
				headers: {
					'WWW-Authenticate': 'Basic realm="User Visible Realm", charset="UTF-8"',
				},
			});
		}
	}

	return resolve(event);
};
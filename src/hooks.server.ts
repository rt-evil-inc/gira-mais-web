import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { integrityTokens } from '$lib/server/db/schema';
import { and, lt, ne } from 'drizzle-orm';

// Token cleanup interval in milliseconds
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

// Check if admin credentials are set
if (!env.ADMIN_LOGIN) {
	console.warn('⚠️ WARNING: ADMIN_LOGIN environment variable is not set. The message update endpoint will not work without it.');
}

// Add any other hook handlers as needed
export async function handle({
	event,
	resolve,
}: Parameters<Handle>[0]): Promise<ReturnType<Handle>> {
	const url = new URL(event.request.url);

	// If cleanup hasn't been initialized yet, do it now
	if (!cleanupInterval) {
		startTokenCleanup();
	}

	if (url.pathname.includes('/admin')) {
		const auth = event.request.headers.get('Authorization');

		if (auth !== `Basic ${btoa(env.ADMIN_LOGIN)}`) {
			return new Response('Not authorized', {
				status: 401,
				headers: {
					'WWW-Authenticate':
                        'Basic realm="User Visible Realm", charset="UTF-8"',
				},
			});
		}
	}

	return resolve(event);
}

/**
 * Cleans up expired tokens by clearing the token field
 */
async function cleanupTokens() {
	try {
		const now = new Date;

		// Update expired tokens, setting token to empty string
		await db.update(integrityTokens)
			.set({ token: '' })
			.where(and(
				lt(integrityTokens.expiresAt, now),
				ne(integrityTokens.token, ''),
			));

		// Log cleanup result
		console.log(`Token cleanup attempt completed.`);
	} catch (err) {
		console.error('Error cleaning up tokens:', err);
	}
}

// Start the cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

function startTokenCleanup() {
	// Run an initial cleanup
	cleanupTokens();

	// Set up periodic cleanup
	cleanupInterval = setInterval(cleanupTokens, CLEANUP_INTERVAL);
	console.log('Token cleanup service started');
}
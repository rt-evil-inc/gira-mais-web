import { json, error, isHttpError } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { unlockAttempts } from '$lib/server/db/schema';
import {
	optionalDetails,
	optionalInteger,
	optionalReasons,
	optionalString,
	requireAppUserAgent,
	requireOneOf,
	requireString,
	UNLOCK_REQUESTS,
	UNLOCK_SOURCES,
} from '$lib/server/unlock-attempts';
import type { RequestHandler } from './$types';

/** Record an unlock attempt once VAIMOO has answered the unlock request. */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const userAgent = requireAppUserAgent(request);
		const body = await request.json();
		const values = {
			attemptId: requireString(body.attemptId, 'attemptId', 64),
			deviceId: requireString(body.deviceId, 'deviceId', 64),
			userAgent,
			survey: body.survey === true,
			bike: requireString(body.bike, 'bike', 16),
			station: optionalString(body.station, 'station', 32),
			source: requireOneOf(body.source, 'source', UNLOCK_SOURCES),
			hiddenReasons: optionalReasons(body.hiddenReasons),
			request: requireOneOf(body.request, 'request', UNLOCK_REQUESTS),
			vaimooCode: optionalInteger(body.vaimooCode, 'vaimooCode'),
			details: optionalDetails(body.details),
		};

		// The app retries failed posts, so the same attempt can arrive twice.
		await db.insert(unlockAttempts).values(values).onConflictDoNothing({ target: unlockAttempts.attemptId });
		return json({ success: true });
	} catch (err) {
		if (isHttpError(err)) throw err;
		if (err instanceof SyntaxError) throw error(400, { message: 'invalid JSON body' });
		console.error('Error handling unlock attempt report:', err);
		throw error(500, { message: 'An unknown error occurred' });
	}
};
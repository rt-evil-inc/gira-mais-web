import { json, error, isHttpError } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { unlockAttempts } from '$lib/server/db/schema';
import {
	optionalDetails,
	optionalInteger,
	requireAppUserAgent,
	requireOneOf,
	requireString,
	UNLOCK_OUTCOMES,
} from '$lib/server/unlock-attempts';
import type { RequestHandler } from './$types';

/** Complete an attempt with whether the trip was confirmed; only the device that reported it can do so. */
export const POST: RequestHandler = async ({ request, params }) => {
	try {
		requireAppUserAgent(request);
		const body = await request.json();
		const attemptId = requireString(params.attemptId, 'attemptId', 64);
		const deviceId = requireString(body.deviceId, 'deviceId', 64);
		const outcome = requireOneOf(body.outcome, 'outcome', UNLOCK_OUTCOMES);
		const elapsedMs = optionalInteger(body.elapsedMs, 'elapsedMs');
		const details = optionalDetails(body.details);

		const updated = await db.update(unlockAttempts)
			.set({
				outcome,
				elapsedMs,
				resolvedAt: new Date,
				// Merge into what the attempt already stored rather than replacing it.
				...details && { details: sql`coalesce(${unlockAttempts.details}, '{}'::jsonb) || ${JSON.stringify(details)}::jsonb` },
			})
			.where(and(eq(unlockAttempts.attemptId, attemptId), eq(unlockAttempts.deviceId, deviceId)))
			.returning({ id: unlockAttempts.id });

		if (!updated.length) throw error(404, { message: 'unknown attempt' });
		return json({ success: true });
	} catch (err) {
		if (isHttpError(err)) throw err;
		if (err instanceof SyntaxError) throw error(400, { message: 'invalid JSON body' });
		console.error('Error handling unlock result report:', err);
		throw error(500, { message: 'An unknown error occurred' });
	}
};
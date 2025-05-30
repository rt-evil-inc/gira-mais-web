import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { errors } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	// Parse request body
	const body = await request.json();

	// Validate required fields
	if (!body.deviceId) {
		throw error(400, { message: 'deviceId is required' });
	}
	if (!request.headers.get('user-agent')?.startsWith('Gira+')) {
		throw error(400, { message: 'invalid user-agent' });
	}

	try {
		// Store error event in database
		await db.insert(errors).values({
			deviceId: body.deviceId,
			errorCode: body.errorCode,
			errorMessage: body.errorMessage,
			userAgent: request.headers.get('user-agent') || null,
		});

		// Return success response
		return json({
			success: true,
		});
	} catch (err) {
		console.error('Error handling error report:', err);
		throw error(500, { message: 'An unknown error occurred' });
	}
};
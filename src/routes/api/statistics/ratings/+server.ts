import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { bikeRatings } from '$lib/server/db/schema';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	// Parse request body
	const body = await request.json();

	// Validate required fields
	if (!body.deviceId) {
		throw error(400, { message: 'deviceId is required' });
	}

	if (!body.bikeSerial) {
		throw error(400, { message: 'bikeSerial is required' });
	}

	if (!body.rating) {
		throw error(400, { message: 'rating is required' });
	}

	// Validate rating is between 1 and 5
	const rating = parseInt(body.rating);
	if (isNaN(rating) || rating < 1 || rating > 5) {
		throw error(400, { message: 'rating must be a number between 1 and 5' });
	}

	if (!request.headers.get('user-agent')?.startsWith('Gira+')) {
		throw error(400, { message: 'invalid user-agent' });
	}

	try {
		// Store bike rating in database
		await db.insert(bikeRatings).values({
			deviceId: body.deviceId,
			bikeSerial: body.bikeSerial,
			rating: rating,
		});

		// Return success response
		return json({
			success: true,
			message: 'Rating submitted successfully',
		});
	} catch (err) {
		console.error('Error handling bike rating:', err);
		throw error(500, { message: 'An unknown error occurred' });
	}
};
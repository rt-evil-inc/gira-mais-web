import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { config } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const currentConfig = (await db.select().from(config).limit(1))[0];

		return json({
			message: currentConfig?.message || '',
			timestamp: currentConfig?.messageTimestamp,
			showAlways: currentConfig?.messageShowAlways === 'true',
		});
	} catch (err) {
		console.error('Error retrieving message:', err);
		throw error(500, { message: 'An unknown error occurred' });
	}
};
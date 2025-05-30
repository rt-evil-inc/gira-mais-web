import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { config } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	try {
		const currentConfig = (await db.select().from(config).limit(1))[0];

		return json({
			message: currentConfig?.message || '',
			messageEn: currentConfig?.messageEn || '',
			timestamp: currentConfig?.messageTimestamp,
			showAlways: currentConfig?.messageShowAlways === 'true',
		});
	} catch (err) {
		console.error('Error retrieving config:', err);
		throw error(500, { message: 'An unknown error occurred' });
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		const currentConfig = (await db.select().from(config).limit(1))[0];

		if (!currentConfig) {
			throw error(500, { message: 'Configuration not found' });
		}

		await db.update(config)
			.set({
				message: body.message,
				messageEn: body.messageEn,
				messageShowAlways: body.showAlways,
				messageTimestamp: new Date,
			})
			.where(eq(config.id, currentConfig.id));

		return json({
			success: true,
		});
	} catch (err) {
		console.error('Error updating message:', err);

		if (err instanceof Error) {
			throw error(500, { message: err.message });
		}

		throw error(500, { message: 'An unknown error occurred' });
	}
};
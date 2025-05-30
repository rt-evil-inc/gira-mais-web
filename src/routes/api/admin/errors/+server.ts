import { json, error, isHttpError } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { errors } from '$lib/server/db/schema';
import { desc, gte, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * Endpoint for getting recent errors for admin dashboard
 */
export const GET: RequestHandler = async () => {
	try {
		const now = new Date;
		const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

		// Get count of errors in last 24 hours
		const errorCountResult = await db.select({
			count: sql<number>`count(*)`,
		}).from(errors)
			.where(gte(errors.timestamp, threeDaysAgo));

		const errorCount = Number(errorCountResult[0]?.count || 0);

		// Get recent errors (last 50)
		const recentErrors = await db.select({
			id: errors.id,
			deviceId: errors.deviceId,
			timestamp: errors.timestamp,
			errorCode: errors.errorCode,
			errorMessage: errors.errorMessage,
			userAgent: errors.userAgent,
		}).from(errors)
			.where(gte(errors.timestamp, threeDaysAgo))
			.orderBy(desc(errors.timestamp))
			.limit(50);

		return json({
			errorCount,
			errors: recentErrors,
		});
	} catch (err) {
		console.error('Error getting recent errors:', err);
		if (isHttpError(err)) {
			throw err;
		}
		throw error(500, 'Failed to get recent errors');
	}
};
import { json, error, isHttpError } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { integrityTokens } from '$lib/server/db/schema';
import { eq, and, gt, lt, ne, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * Endpoint for getting token statistics
 */
export const GET: RequestHandler = async () => {
	try {
		// Calculate stats
		const now = new Date;
		const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

		// Total tokens
		const totalTokensResult = await db.select({
			count: sql<number>`count(*)`,
		}).from(integrityTokens);

		const totalTokens = totalTokensResult[0]?.count || 0;

		// Expired unassigned tokens
		const expiredUnassignedResult = await db.select({
			count: sql<number>`count(*)`,
		}).from(integrityTokens)
			.where(and(
				eq(integrityTokens.assignedTo, ''),
				lt(integrityTokens.expiresAt, now),
			));

		const expiredUnassigned = expiredUnassignedResult[0]?.count || 0;

		// Valid tokens
		const validTokensResult = await db.select({
			count: sql<number>`count(*)`,
		}).from(integrityTokens)
			.where(gt(integrityTokens.expiresAt, now));

		const validTokens = validTokensResult[0]?.count || 0;

		// Available tokens
		const availableTokensResult = await db.select({
			count: sql<number>`count(*)`,
		}).from(integrityTokens)
			.where(and(
				eq(integrityTokens.assignedTo, ''),
				gt(integrityTokens.expiresAt, now),
			));

		const availableTokens = availableTokensResult[0]?.count || 0;

		// Available tokens after 10 minutes
		const availableTokensAfter10MinsResult = await db.select({
			count: sql<number>`count(*)`,
		}).from(integrityTokens)
			.where(and(
				eq(integrityTokens.assignedTo, ''),
				gt(integrityTokens.expiresAt, tenMinutesFromNow),
			));

		const availableTokensAfter10Mins = availableTokensAfter10MinsResult[0]?.count || 0;

		// Assigned tokens
		const assignedTokensResult = await db.select({
			count: sql<number>`count(*)`,
		}).from(integrityTokens)
			.where(and(
				ne(integrityTokens.assignedTo, ''),
				gt(integrityTokens.expiresAt, now),
			));

		const assignedTokens = assignedTokensResult[0]?.count || 0;

		// Return stats
		return json({
			total_tokens: totalTokens,
			expired_unassigned: expiredUnassigned,
			valid_tokens: validTokens,
			available_tokens: availableTokens,
			available_tokens_after_10_mins: availableTokensAfter10Mins,
			assigned_tokens: assignedTokens,
		});
	} catch (err) {
		console.error('Error getting stats:', err);
		if (isHttpError(err)) {
			throw err;
		}
		throw error(500, 'Failed to get token statistics');
	}
};
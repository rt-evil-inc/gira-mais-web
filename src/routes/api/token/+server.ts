import { json, error, isHttpError } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { integrityTokens } from '$lib/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { parseFirebaseToken } from '$lib/server/jwt';

export const GET: RequestHandler = async event => {
	// TODO: rate limiting

	try {
		// Reject requests from default user agents
		if (event.request.headers.get('user-agent')?.startsWith('Mozilla/')) {
			throw error(400, 'Hello pls identify your application thx <3');
		}

		// Get user ID from request headers
		const userId = event.request.headers.get('x-user-id');
		if (!userId) {
			throw error(400, 'Missing x-user-id header');
		}

		// First, check if this user already has an assigned token
		const existingTokens = await db.select()
			.from(integrityTokens)
			.where(and(
				eq(integrityTokens.assignedTo, userId),
				gt(integrityTokens.expiresAt, new Date),
			));

		if (existingTokens.length > 0) {
			console.log(`Using existing token for user ${userId}`);
			return new Response(existingTokens[0].token);
		}

		// No token found, assign a new one from the pool of available tokens
		const availableTokens = await db.select()
			.from(integrityTokens)
			.where(and(
				eq(integrityTokens.assignedTo, ''),
				gt(integrityTokens.expiresAt, new Date),
			))
			.orderBy(integrityTokens.expiresAt)
			.limit(1);

		if (availableTokens.length === 0) {
			throw error(404, 'No tokens available');
		}

		// Assign the token to the user
		await db.update(integrityTokens)
			.set({
				assignedTo: userId,
				assignedAt: new Date,
				userAgent: event.request.headers.get('user-agent') || '',
			})
			.where(eq(integrityTokens.id, availableTokens[0].id));

		console.log(`Assigned new token to user ${userId}`);
		return new Response(availableTokens[0].token);
	} catch (err) {
		console.error('Error getting token:', err);
		if (isHttpError(err)) {
			throw err;
		}
		throw error(500, 'Failed to get token');
	}
};

export const POST: RequestHandler = async event => {
	try {
		const token = event.request.headers.get('x-firebase-token');
		if (!token) {
			throw error(400, 'Missing x-firebase-token header');
		}

		// Validate the token
		const claims = await parseFirebaseToken(token);

		// Get token source from header
		const tokenSource = event.request.headers.get('x-token-source') || '';
		if (tokenSource.length > 32) {
			throw error(400, 'Token source too long (max 32 characters)');
		}

		// Check if token already exists
		const existingTokens = await db.select().from(integrityTokens).where(eq(integrityTokens.token, token));

		if (existingTokens.length > 0) {
			throw error(409, 'Token already exists');
		}

		// Store the token
		await db.insert(integrityTokens).values({
			token: token,
			tokenSource: tokenSource,
			expiresAt: new Date(claims.exp ? claims.exp * 1000 : 0),
			createdAt: new Date,
			assignedTo: '', // Initially unassigned
		});

		console.log(`New integrity token added (valid until ${claims.exp}): sub ${claims.sub} jti ${claims.jti}`);

		return json({ success: true, message: 'Token stored successfully' });
	} catch (err) {
		console.error('Error storing token:', err);
		if (isHttpError(err)) {
			throw err;
		}
		throw error(500, 'Failed to store token');
	}
};
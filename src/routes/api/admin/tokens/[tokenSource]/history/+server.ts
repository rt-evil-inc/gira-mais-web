import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { integrityTokens } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const { tokenSource: thisTokenSource } = params;

	try {
		// Get last 10 tokens for this token source
		const tokens = await db
			.select({
				id: integrityTokens.id,
				token: integrityTokens.token,
				createdAt: integrityTokens.createdAt,
			})
			.from(integrityTokens)
			.where(eq(integrityTokens.tokenSource, thisTokenSource))
			.orderBy(desc(integrityTokens.createdAt))
			.limit(10);

		const formattedTokens = tokens.map(token => ({
			id: token.id,
			timestamp: token.createdAt,
			token: token.token,
		}));

		return json({ tokens: formattedTokens });
	} catch (error) {
		console.error('Error fetching token source\'s tokens:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
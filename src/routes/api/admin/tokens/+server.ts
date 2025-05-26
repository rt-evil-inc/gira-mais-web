import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { integrityTokens } from '$lib/server/db/schema';
import { sql, desc, ne } from 'drizzle-orm';

interface TokenSource {
  id: string;
  lastTokenAt: string;
  minutesAgo: number;
  tokenCount: number;
}

export async function _getTokenSources(): Promise<TokenSource[]> {
	// Get token source data from database
	const tokenSourceData = await db
		.select({
			tokenSource: integrityTokens.tokenSource,
			lastTokenAt: sql<string>`MAX(${integrityTokens.createdAt})`,
			tokenCount: sql<number>`COUNT(*)`,
		})
		.from(integrityTokens)
		.where(ne(integrityTokens.tokenSource, ''))
		.groupBy(integrityTokens.tokenSource)
		.orderBy(desc(sql`MAX(${integrityTokens.createdAt})`));

	return tokenSourceData.map(tokenRow => {
		const lastTokenTime = new Date(tokenRow.lastTokenAt);
		const minutesAgo = Math.floor((Date.now() - lastTokenTime.getTime()) / (1000 * 60));

		return {
			id: tokenRow.tokenSource,
			lastTokenAt: lastTokenTime.toISOString(),
			minutesAgo,
			tokenCount: tokenRow.tokenCount,
		};
	});
}

export const GET: RequestHandler = async () => {
	try {
		const tokenSources = await _getTokenSources();
		return json({ tokenSources });
	} catch (error) {
		console.error('Error fetching token sources:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
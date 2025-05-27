import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { integrityTokens } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

const initialDate = new Date(env.INITIAL_DATE || '2025-04-27');

export const GET: RequestHandler = async ({ url }) => {
	let startDate = url.searchParams.get('start');
	if (!startDate || Date.parse(startDate) < initialDate.getTime()) {
		startDate = initialDate.toISOString();
	} else {
		startDate = new Date(Date.parse(startDate)).toISOString();
	}
	let endDate = url.searchParams.get('end');
	if (!endDate || Date.parse(endDate) > (new Date).getTime()) {
		endDate = (new Date).toISOString();
	} else {
		endDate = new Date(Date.parse(endDate)).toISOString();
	}	try {
		// Fetch all tokens that were created or assigned within the date range
		// We need to extend the range to include tokens created before startDate that might still be available
		const extendedStartDate = new Date(new Date(startDate).getTime() - 60 * 60 * 1000).toISOString(); // 1 hour before

		const tokensQuery = await db
			.select({
				id: integrityTokens.id,
				createdAt: integrityTokens.createdAt,
				assignedAt: integrityTokens.assignedAt,
				assignedTo: integrityTokens.assignedTo,
			})
			.from(integrityTokens)
			.where(
				sql`${integrityTokens.createdAt} >= ${extendedStartDate} 
					AND ${integrityTokens.createdAt} <= ${endDate}`,
			);

		// Create events for token lifecycle
		type TokenEvent = {
			timestamp: Date;
			type: 'created' | 'assigned' | 'expired';
			tokenId: number;
			change: number; // +1 for available, -1 for unavailable
		};

		const events: TokenEvent[] = [];

		for (const token of tokensQuery) {
			const createdAt = new Date(token.createdAt);
			const expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000); // 1 hour after creation

			// Token becomes available when created
			events.push({
				timestamp: createdAt,
				type: 'created',
				tokenId: token.id,
				change: 1,
			});

			// Token becomes unavailable when assigned or expired (whichever comes first)
			if (token.assignedAt) {
				const assignedAt = new Date(token.assignedAt);
				if (assignedAt < expiresAt) {
					// Assigned before expiry
					events.push({
						timestamp: assignedAt,
						type: 'assigned',
						tokenId: token.id,
						change: -1,
					});
				} else {
					// Expired before assignment (shouldn't happen but handle gracefully)
					events.push({
						timestamp: expiresAt,
						type: 'expired',
						tokenId: token.id,
						change: -1,
					});
				}
			} else {
				// Not assigned, so it expires after 1 hour
				events.push({
					timestamp: expiresAt,
					type: 'expired',
					tokenId: token.id,
					change: -1,
				});
			}
		}

		// Sort events by timestamp
		events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		// Calculate running total and create continuous event stream
		let availableCount = 0;
		const startDateTime = new Date(startDate);
		const endDateTime = new Date(endDate);

		// Calculate initial state (tokens available at startDate)
		for (const event of events) {
			if (event.timestamp < startDateTime) {
				availableCount += event.change;
			}
		}

		// Create results array with only events within the date range
		const results: Array<{
			timestamp: string;
			available_tokens: number;
			count: number;
			event_type: string;
			token_id: number;
		}> = [];

		// Process events within the requested date range
		for (const event of events) {
			if (event.timestamp >= startDateTime && event.timestamp <= endDateTime) {
				availableCount += event.change;

				results.push({
					timestamp: event.timestamp.toISOString(),
					available_tokens: Math.max(0, availableCount),
					count: Math.max(0, availableCount),
					event_type: event.type,
					token_id: event.tokenId,
				});
			}
		}

		return json({
			data: results,
			meta: { startDate, endDate },
		});
	} catch (err) {
		console.error('Error fetching token statistics data:', err);
		throw error(500, { message: 'Failed to fetch token statistics data' });
	}
};
import { error, json } from '@sveltejs/kit';
import { and, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bikeRatings } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const MAX_BIKES = 50;
const MAX_AGE_DAYS = 3;

// Returns a compact bike signal for the requested bike ids: 1 = bad, 3 = neutral,
// 5 = good, null = no ratings in the last 3 days. The current heuristic sums
// rating - 4 for each recent rating, then maps <= -3 to bad, < 0 to neutral,
// and >= 0 to good. Values 2 and 4 are intentionally unused for now so the
// client can keep a stable 1-5 scale if future heuristics add more nuance.
export const GET: RequestHandler = async ({ url }) => {
	const bikeIds = (url.searchParams.get('bikes') || '')
		.split(',')
		.map(bikeId => bikeId.trim().toUpperCase())
		.filter(Boolean);

	if (bikeIds.length === 0) {
		throw error(400, 'bikes parameter must include at least one bike id');
	}
	if (bikeIds.length > MAX_BIKES) {
		throw error(400, `you cannot request more than ${MAX_BIKES} bikes`);
	}

	const uniqueBikeIds = [...new Set(bikeIds)];
	const since = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

	try {
		const recentRatings = await db
			.select({
				bikePlate: bikeRatings.bikePlate,
				score: sql<number>`SUM(${bikeRatings.rating} - 4)`,
			})
			.from(bikeRatings)
			.where(and(
				inArray(bikeRatings.bikePlate, uniqueBikeIds),
				sql`${bikeRatings.timestamp} >= ${since}`,
			))
			.groupBy(bikeRatings.bikePlate);

		const ratingsByBike = new Map<string, 1 | 3 | 5>;

		for (const row of recentRatings) {
			const score = Number(row.score);
			const state = score <= -3 ? 1 : score < 0 ? 3 : 5;
			ratingsByBike.set(String(row.bikePlate), state);
		}

		const data = Object.fromEntries(
			uniqueBikeIds.map(bikeId => [bikeId, ratingsByBike.get(bikeId) || null]),
		);

		return json(data);
	} catch (err) {
		console.error('Error fetching station bike ratings:', err);
		throw error(500, { message: 'Failed to fetch station bike ratings' });
	}
};
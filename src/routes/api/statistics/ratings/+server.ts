import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { bikeRatings } from '$lib/server/db/schema';
import type { RequestHandler } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

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

	// Validate timestamp
	let timestamp: Date | undefined;
	if (body.timestamp) {
		const parsedTimestamp = new Date(body.timestamp);
		if (isNaN(parsedTimestamp.getTime())) {
			throw error(400, { message: 'Invalid timestamp format' });
		}
		timestamp = parsedTimestamp;
	}

	try {
		// Store bike rating in database
		await db.insert(bikeRatings).values({
			deviceId: body.deviceId,
			bikeSerial: body.bikeSerial,
			rating: rating,
			...timestamp && { timestamp }, // Use provided timestamp if valid
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
	}
	const groupBy = url.searchParams.get('groupBy') || 'day'; // hour, day, total
	const timezone = url.searchParams.get('timezone') || 'UTC';

	try {
		if (groupBy === 'total') {
			// Get total ratings in the given time range
			const totalQuery = await db
				.select({
					count: sql<number>`COUNT(*)`,
				})
				.from(bikeRatings)
				.where(
					sql`${bikeRatings.timestamp} >= ${startDate} AND ${bikeRatings.timestamp} < ${endDate}`,
				);

			const totalCount = totalQuery[0]?.count || 0;
			return json({
				data: totalCount,
				meta: { startDate, endDate, groupBy, timezone },
			});
		}

		// For hour or day grouping - get ratings grouped by rating value (1-5 stars)
		let truncateFormat: string;
		let intervalUnit: string;

		if (groupBy === 'hour') {
			truncateFormat = 'hour';
			intervalUnit = '1 hour';
		} else {
			truncateFormat = 'day';
			intervalUnit = '1 day';
		}

		// Generate series of timestamps and get ratings grouped by rating value
		const seriesQuery = await db.execute(sql`
			WITH series AS (
				SELECT generate_series(
					DATE_TRUNC(${truncateFormat}, ${startDate}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}),
					DATE_TRUNC(${truncateFormat}, ${endDate}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}),
					${intervalUnit}::interval
				) AS time_point
			),
			rating_series AS (
				SELECT generate_series(1, 5) AS rating_value
			),
			counts AS (
				SELECT 
					DATE_TRUNC(${truncateFormat}, br.timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) AS grouped_time,
					br.rating,
					COUNT(*) AS rating_count
				FROM 
					"bike_ratings" AS br
				WHERE 
					br.timestamp >= ${startDate} AND br.timestamp < ${endDate}
				GROUP BY 
					grouped_time, br.rating
			)
			SELECT 
				to_char(series.time_point AT TIME ZONE ${timezone}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
				rating_series.rating_value,
				COALESCE(counts.rating_count, 0) AS count
			FROM 
				series
			CROSS JOIN rating_series
			LEFT JOIN counts ON series.time_point = counts.grouped_time AND rating_series.rating_value = counts.rating
			ORDER BY 
				series.time_point, rating_series.rating_value
		`);

		// Transform the results to group by rating value
		const ratingGroups: { [key: string]: Array<{ timestamp: string; count: number }> } = {
			'1': [],
			'2': [],
			'3': [],
			'4': [],
			'5': [],
		};

		seriesQuery.forEach(row => {
			const ratingKey = String(row.rating_value);
			ratingGroups[ratingKey].push({
				timestamp: String(row.timestamp),
				count: Number(row.count),
			});
		});

		// Format results as array of rating groups
		const results = Object.entries(ratingGroups).map(([rating, data]) => {
			let label: string;
			switch (rating) {
			case '1':
				label = 'Muito Mau';
				break;
			case '2':
				label = 'Mau';
				break;
			case '3':
				label = 'Neutro';
				break;
			case '4':
				label = 'Bom';
				break;
			case '5':
				label = 'Muito Bom';
				break;
			default:
				label = `${rating} estrela${rating === '1' ? '' : 's'}`;
			}
			return {
				label,
				data,
			};
		});

		return json({
			data: results,
			meta: { startDate, endDate, groupBy, timezone },
		});
	} catch (err) {
		console.error('Error fetching ratings statistics data:', err);
		throw error(500, { message: 'Failed to fetch ratings statistics data' });
	}
};
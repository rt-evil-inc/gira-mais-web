import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { parseRange } from '$lib/server/admin';
import { errorFilters } from '$lib/server/admin-errors';
import type { ErrorListResponse } from '$lib/admin';
import type { RequestHandler } from './$types';

const PAGE = 25;

/** The errors in the range, newest first, filtered as /api/admin/errors is; `before` (an id) asks for the next page. */
export const GET: RequestHandler = async ({ url }) => {
	const range = parseRange(url);
	const filters = errorFilters(url);
	const before = Number.parseInt(url.searchParams.get('before') ?? '');
	const rows = await db.execute(sql`
		SELECT id, device_id, to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp, error_code, error_message, user_agent
		FROM errors
		WHERE timestamp >= ${range.start} AND timestamp < ${range.end} ${filters.codes} ${filters.versions} ${filters.other}
			${Number.isNaN(before) ? sql`` : sql`AND id < ${before}`}
		ORDER BY id DESC LIMIT ${PAGE + 1}
	`);
	const page = rows.slice(0, PAGE);
	return json({
		errors: page.map(row => ({
			id: Number(row.id),
			deviceId: String(row.device_id),
			timestamp: String(row.timestamp),
			errorCode: String(row.error_code),
			errorMessage: row.error_message == null ? null : String(row.error_message),
			userAgent: row.user_agent == null ? null : String(row.user_agent),
		})),
		next: rows.length > PAGE ? String(page[page.length - 1].id) : null,
	} satisfies ErrorListResponse);
};
import { sql, type SQL } from 'drizzle-orm';

/** The app version in an error's user agent ("Gira+/1.6.1" or "Gira+/1.6.1-dev (abc1234)" is 1.6.1(-dev)). */
export const ERROR_VERSION = sql`COALESCE(substring(user_agent from 'Gira\\+/([^ ]+)'), '?')`;

/**
 * The filters the errors endpoints share: codes to leave out (excludeCodes) or to keep (codes), versions (all
 * repeatable), a device and text to search for.
 */
export function errorFilters(url: URL) {
	const codes = url.searchParams.getAll('codes').filter(Boolean);
	const excludedCodes = url.searchParams.getAll('excludeCodes').filter(Boolean);
	const versions = url.searchParams.getAll('versions').filter(Boolean);
	const device = url.searchParams.get('device');
	const search = url.searchParams.get('q')?.trim();
	return {
		codes: sql.join([
			codes.length ? sql`AND error_code IN ${codes}` : sql``,
			excludedCodes.length ? sql`AND error_code NOT IN ${excludedCodes}` : sql``,
		], sql` `),
		versions: versions.length ? sql`AND ${ERROR_VERSION} IN ${versions}` : sql``,
		other: sql.join([
			device ? sql`AND device_id = ${device}` : sql``,
			search ? sql`AND (error_message ILIKE ${`%${search.replace(/[\\%_]/g, '\\$&')}%`} OR device_id = ${search})` : sql``,
		], sql` `),
	};
}

const field = (pattern: string) => sql`substring(error_message from ${pattern})`;
const string = (key: string) => field(`"${key}":\\s*"((?:[^"\\\\]|\\\\.)*)"`);
const number = (key: string) => field(`"${key}":\\s*(-?\\d+)`);

/**
 * What an error message says, without what changes from one report to the next: the app reports most errors as
 * JSON with the bike, station or rating involved, and its platforms write the keys in different orders, so the
 * telling fields are picked out in a fixed order ("GET /user/trip · The request timed out."). Messages that
 * aren't such JSON are taken as they are.
 */
export const ERROR_SIGNATURE: SQL = sql`CASE WHEN error_message IS NULL OR error_message = '' THEN '(sem mensagem)' ELSE COALESCE(
	NULLIF(concat_ws(' · ',
		${string('source')},
		${string('method')} || ' ' || ${string('path')},
		${string('type')},
		'HTTP ' || ${number('status')},
		'código ' || COALESCE(${number('code')}, ${string('code')}),
		COALESCE(${field(`"messages":\\s*\\["((?:[^"\\\\]|\\\\.)*)"`)}, ${string('message')}),
		${string('error')},
		${string('state')}
	), ''),
	left(regexp_replace(error_message, '"(bike|bikeIds|station|rating|tripId|attempt|attempts)":\\s*("[^"]*"|\\[[^\\]]*\\]|[^,}]*),?', '', 'g'), 200)
) END`;
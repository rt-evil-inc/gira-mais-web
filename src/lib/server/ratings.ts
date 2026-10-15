import { sql } from 'drizzle-orm';

/**
 * Whether a `bike_ratings` row says anything about the bike, for the figures built on them (the
 * statistics page, the app's bike-condition signals). A rating of 3 or less whose only stated reasons
 * are about something else (the Gira+ app, the dock, unlocking) is left out: it would count against a
 * bike that did nothing wrong. Reason codes are the app's `TRIP_RATING_REASONS`. Unqualified columns,
 * so it fits both the query builder and raw queries over the table, aliased or not.
 */
export const aboutBike = sql`NOT (rating <= 3 AND COALESCE(cardinality(reasons), 0) > 0 AND reasons <@ '{app,docking,unlocking}'::text[])`;
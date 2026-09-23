import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const usage = pgTable('usage', {
	id: serial('id').primaryKey(),
	deviceId: varchar('device_id', { length: 64 }).notNull(),
	timestamp: timestamp('timestamp').defaultNow().notNull(),
	appVersion: varchar('app_version', { length: 32 }),
	os: varchar('os', { length: 32 }),
	osVersion: varchar('os_version', { length: 32 }),
});

export const trips = pgTable('trips', {
	id: serial('id').primaryKey(),
	deviceId: varchar('device_id', { length: 64 }).notNull(),
	timestamp: timestamp('timestamp').defaultNow().notNull(),
	bikeSerial: varchar('bike_serial', { length: 32 }),
	stationSerial: varchar('station_serial', { length: 32 }),
});

export const errors = pgTable('errors', {
	id: serial('id').primaryKey(),
	deviceId: varchar('device_id', { length: 64 }).notNull(),
	timestamp: timestamp('timestamp').defaultNow().notNull(),
	errorCode: varchar('error_code', { length: 64 }).notNull(),
	errorMessage: text('error_message'),
	userAgent: varchar('user_agent', { length: 512 }),
});

export const config = pgTable('config', {
	id: serial('id').primaryKey(),
	message: text('message').notNull().default(''),
	messageEn: text('message_en').notNull().default(''),
	messageTimestamp: timestamp('messageTimestamp').defaultNow().notNull(),
	messageShowAlways: text('messageShowAlways').notNull().default('false'),
});

export const integrityTokens = pgTable('integrity_tokens', {
	id: serial('id').primaryKey(),
	token: varchar('token', { length: 2048 }).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	tokenSource: varchar('token_source', { length: 64 }).notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	assignedTo: varchar('assigned_to', { length: 128 }).default(''),
	assignedAt: timestamp('assigned_at'),
	userAgent: varchar('user_agent', { length: 512 }),
});

export const bikeRatings = pgTable(
	'bike_ratings',
	{
		id: serial('id').primaryKey(),
		deviceId: varchar('device_id', { length: 64 }).notNull(),
		timestamp: timestamp('timestamp').defaultNow().notNull(),
		ratedAt: timestamp('rated_at'),
		tripCode: varchar('trip_code', { length: 16 }),
		bikePlate: varchar('bike_plate', { length: 8 }),
		rating: integer('rating').notNull(),
	},
	table => [
		index('bike_ratings_bike_plate_timestamp_idx').on(table.bikePlate, table.timestamp),
	],
);

/**
 * One row per unlock attempt the app reports: created when VAIMOO answers the unlock request, completed
 * once the app knows whether the trip was confirmed (the bike released) or dropped.
 */
export const unlockAttempts = pgTable(
	'unlock_attempts',
	{
		id: serial('id').primaryKey(),
		attemptId: varchar('attempt_id', { length: 64 }).notNull().unique(),
		deviceId: varchar('device_id', { length: 64 }).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		userAgent: varchar('user_agent', { length: 512 }),
		/** Sent by the app's field-survey build, which lists and reports every bike. */
		survey: boolean('survey').notNull().default(false),
		bike: varchar('bike', { length: 16 }).notNull(),
		station: varchar('station', { length: 32 }),
		/** How the bike was offered: 'listed' (available), 'hidden' (flagged unavailable) or 'typed' (entered by number). */
		source: varchar('source', { length: 16 }).notNull(),
		/** The server's reasons for hiding the bike (its Firestore `Comment`), null if it was listed as available. */
		hiddenReasons: text('hidden_reasons').array(),
		/** 'accepted', 'accepted-after-network-error', 'refused' or 'network-error'. */
		request: varchar('request', { length: 32 }).notNull(),
		/** VAIMOO's numeric responseStatus.errorCode when the request was refused. */
		vaimooCode: integer('vaimoo_code'),
		/** 'confirmed', 'not-confirmed' or 'unresolved'; null until the result arrives, and for refused requests. */
		outcome: varchar('outcome', { length: 16 }),
		resolvedAt: timestamp('resolved_at'),
		elapsedMs: integer('elapsed_ms'),
		/** Exploratory data that has no column yet, e.g. the bike's Firestore record before and after. */
		details: jsonb('details'),
	},
	table => [
		index('unlock_attempts_created_at_idx').on(table.createdAt),
		index('unlock_attempts_bike_created_at_idx').on(table.bike, table.createdAt),
	],
);
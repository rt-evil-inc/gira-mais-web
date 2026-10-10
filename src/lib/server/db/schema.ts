import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const usage = pgTable(
	'usage',
	{
		id: serial('id').primaryKey(),
		deviceId: varchar('device_id', { length: 64 }).notNull(),
		timestamp: timestamp('timestamp').defaultNow().notNull(),
		appVersion: varchar('app_version', { length: 32 }),
		os: varchar('os', { length: 32 }),
		osVersion: varchar('os_version', { length: 32 }),
	},
	// For the status page's hourly active users.
	table => [index('usage_timestamp_idx').on(table.timestamp)],
);

export const trips = pgTable('trips', {
	id: serial('id').primaryKey(),
	deviceId: varchar('device_id', { length: 64 }).notNull(),
	timestamp: timestamp('timestamp').defaultNow().notNull(),
	bikeSerial: varchar('bike_serial', { length: 32 }),
	stationSerial: varchar('station_serial', { length: 32 }),
});

export const errors = pgTable(
	'errors',
	{
		id: serial('id').primaryKey(),
		deviceId: varchar('device_id', { length: 64 }).notNull(),
		timestamp: timestamp('timestamp').defaultNow().notNull(),
		errorCode: varchar('error_code', { length: 64 }).notNull(),
		errorMessage: text('error_message'),
		userAgent: varchar('user_agent', { length: 512 }),
	},
	table => [index('errors_timestamp_idx').on(table.timestamp)],
);

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
/**
 * GIRA stations as last seen in EMEL's VAIMOO station feed (Firestore `docking-stations`), kept after the feed
 * stops returning them: `missingSince` is set from the first poll that no longer had the station.
 */
export const giraStations = pgTable('gira_stations', {
	/** VAIMOO's DockingStationId. */
	id: integer('id').primaryKey(),
	name: text('name').notNull(),
	address: text('address'),
	latitude: doublePrecision('latitude'),
	longitude: doublePrecision('longitude'),
	active: boolean('active').notNull(),
	/** AVAILABLE, LIMITED_USE, IN_USE, UNAVAILABLE_BY_SYSTEM, UNAVAILABLE_BY_OPERATOR, DISABLED or UNKNOWN. */
	serviceStatus: text('service_status'),
	dockLimit: integer('dock_limit').notNull(),
	freeDocks: integer('free_docks').notNull(),
	/** The feed's own counter, which doesn't always match the bikes flagged available at the station. */
	availableBikes: integer('available_bikes').notNull(),
	/** The document's Firestore updateTime, to skip writing records that haven't changed. */
	sourceUpdatedAt: timestamp('source_updated_at').notNull(),
	firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
	/** The last poll that returned the station. Only written when the record changes or goes missing, so for a station still in the feed it is the latest poll. */
	lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
	missingSince: timestamp('missing_since'),
});

/** GIRA bikes as last seen in the VAIMOO bike feed (Firestore `bikes`), kept after the feed stops returning them. */
export const giraBikes = pgTable(
	'gira_bikes',
	{
		/** VAIMOO's BikeId. */
		id: integer('id').primaryKey(),
		/** The number painted on the bike, e.g. E0566 (test vehicles have longer names). */
		visualId: text('visual_id').notNull(),
		category: text('category'),
		stationId: integer('station_id'),
		dockId: integer('dock_id'),
		/** The dock's number at the station, as printed on it. */
		dock: text('dock'),
		available: boolean('available').notNull(),
		booked: boolean('booked').notNull(),
		/** LOCKED, RUNNING or WAITING_FOR_START. */
		tripState: text('trip_state'),
		tripErrorCode: integer('trip_error_code'),
		battery: integer('battery'),
		/** Why the server flags the bike unavailable, from its `Comment`. */
		reasons: text('reasons').array().notNull(),
		/** See bikeStatus in $lib/gira-system. */
		status: varchar('status', { length: 16 }).notNull(),
		sourceUpdatedAt: timestamp('source_updated_at').notNull(),
		firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
		/** As for stations: exact once the bike goes missing, otherwise the latest poll. */
		lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
		missingSince: timestamp('missing_since'),
	},
	table => [
		index('gira_bikes_station_id_idx').on(table.stationId),
	],
);

/**
 * GIRA docks, as far as the bikes in them reveal: the feed has no dock records, only each bike's dock. Written
 * when a bike arrives in or leaves a dock, so docks that never held a bike since polling began have no row.
 */
export const giraDocks = pgTable(
	'gira_docks',
	{
		stationId: integer('station_id').notNull(),
		/** The dock's number at the station, without leading zeros. */
		number: text('number').notNull(),
		/** VAIMOO's DockingPointId, from the last bike seen in the dock. */
		dockId: integer('dock_id'),
		occupied: boolean('occupied').notNull(),
		/** The last poll that found a bike in the dock; for an occupied dock, when the current bike arrived. */
		lastOccupiedAt: timestamp('last_occupied_at').notNull(),
		firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
	},
	table => [
		primaryKey({ columns: [table.stationId, table.number] }),
	],
);

/** Status totals of the whole system at each poll, as { status: count } objects (see $lib/gira-system). */
export const giraSnapshots = pgTable(
	'gira_snapshots',
	{
		id: serial('id').primaryKey(),
		timestamp: timestamp('timestamp').notNull(),
		stations: jsonb('stations').$type<Record<string, number>>().notNull(),
		docks: jsonb('docks').$type<Record<string, number>>().notNull(),
		bikes: jsonb('bikes').$type<Record<string, number>>().notNull(),
		/** Stations in service by whether they have bikes to take and docks to return to. Empty before it was tracked. */
		occupancy: jsonb('occupancy').$type<Record<string, number>>().notNull().default({}),
	},
	table => [
		index('gira_snapshots_timestamp_idx').on(table.timestamp),
	],
);

/**
 * Stations and bikes appearing in, disappearing from and returning to the feed, stations gaining or losing
 * docks (the feed has no dock records, only each station's dock count) and stations changing status.
 */
export const giraEvents = pgTable(
	'gira_events',
	{
		id: serial('id').primaryKey(),
		timestamp: timestamp('timestamp').notNull(),
		/** 'station' or 'bike'. */
		entity: varchar('entity', { length: 16 }).notNull(),
		entityId: integer('entity_id').notNull(),
		/** 'appeared', 'disappeared', 'reappeared', 'docks_changed' or, for stations, 'status_changed'. */
		type: varchar('type', { length: 16 }).notNull(),
		details: jsonb('details'),
	},
	table => [
		index('gira_events_timestamp_idx').on(table.timestamp),
		index('gira_events_entity_idx').on(table.entity, table.entityId),
	],
);
/**
 * The server's own requests to the GIRA services, for their uptime: the poller's feed queries and light probes
 * of the other hosts (see $lib/server/gira-status/probes). One row per request.
 */
export const giraChecks = pgTable(
	'gira_checks',
	{
		id: serial('id').primaryKey(),
		timestamp: timestamp('timestamp').notNull(),
		/** A service of $lib/gira-status, e.g. 'feed'. */
		service: varchar('service', { length: 16 }).notNull(),
		/** What was requested, e.g. 'bikes' or 'GET /auth'. */
		target: varchar('target', { length: 64 }).notNull(),
		ok: boolean('ok').notNull(),
		/** The HTTP status, null when no response came back. */
		status: integer('status'),
		latencyMs: integer('latency_ms'),
		error: text('error'),
	},
	table => [
		index('gira_checks_service_timestamp_idx').on(table.service, table.timestamp),
	],
);
import { pgTable, serial, text, timestamp, varchar, integer } from 'drizzle-orm/pg-core';

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

export const bikeRatings = pgTable('bike_ratings', {
	id: serial('id').primaryKey(),
	deviceId: varchar('device_id', { length: 64 }).notNull(),
	timestamp: timestamp('timestamp').defaultNow().notNull(),
	bikeSerial: varchar('bike_serial', { length: 32 }).notNull(),
	rating: integer('rating').notNull(),
});
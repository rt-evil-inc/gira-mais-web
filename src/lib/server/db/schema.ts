import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

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

export const config = pgTable('config', {
	id: serial('id').primaryKey(),
	message: text('message').notNull().default(''),
	messageTimestamp: timestamp('messageTimestamp').defaultNow().notNull(),
	messageShowAlways: text('messageShowAlways').notNull().default('false'),
});
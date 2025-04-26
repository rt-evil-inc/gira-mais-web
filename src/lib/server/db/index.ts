import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Create Postgres connection
const connectionString = env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/gira';
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// Initialize the config table if it doesn't already have data
export async function initializeConfig() {
	const existingConfig = await db.select().from(schema.config).limit(1);

	if (!existingConfig.length) {
		await db.insert(schema.config).values({
			message: 'Thank you for your statistics submission!',
		});

		console.log('Initialized config with default message.');
	}
}
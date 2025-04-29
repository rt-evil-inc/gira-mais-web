import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Create Postgres connection
const connectionString = env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/gira';
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
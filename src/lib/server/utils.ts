import { db } from './db';
import { config } from './db/schema';

/**
 * Retrieves the current message from the config table
 */
export async function getMessage(): Promise<{ html: string; timestamp: Date }> {
	const currentConfig = (await db.select().from(config).limit(1))[0];
	return {
		html: currentConfig?.message,
		timestamp: currentConfig?.messageTimestamp,
	};
}
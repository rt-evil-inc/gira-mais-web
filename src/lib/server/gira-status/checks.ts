import { db } from '$lib/server/db';
import { giraChecks } from '$lib/server/db/schema';

/** A failed request to a GIRA service, with the HTTP status when one came back. */
export class ServiceError extends Error {
	constructor(message: string, readonly status: number | null = null) {
		super(message);
	}
}

function describe(error: unknown) {
	if (error instanceof Error && error.name === 'TimeoutError') return 'timeout';
	// fetch hides DNS, TLS and connection failures behind "fetch failed"; the cause says which.
	const cause = error instanceof Error && error.cause instanceof Error ? error.cause : null;
	const message = cause ? `${(cause as Error & { code?: string }).code ?? cause.name}: ${cause.message}` : error instanceof Error ? error.message : String(error);
	return message.split('\n')[0].slice(0, 300);
}

/**
 * Runs one request to a service and records how it went; the request's own result or error passes through.
 * Recording never fails the request: a check that can't be stored is only logged. `statusOf` reads the HTTP
 * status off a successful result; without it a success counts as 200.
 */
export async function checked<T>(service: string, target: string, request: () => Promise<T>, statusOf: (result: T) => number = () => 200): Promise<T> {
	const timestamp = new Date;
	const started = performance.now();
	let failure: unknown = null;
	let status: number | null = null;
	try {
		const result = await request();
		status = statusOf(result);
		return result;
	} catch (error) {
		failure = error;
		throw error;
	} finally {
		const latencyMs = Math.round(performance.now() - started);
		if (failure) status = failure instanceof ServiceError ? failure.status : null;
		await db.insert(giraChecks).values({ timestamp, service, target, ok: !failure, status, latencyMs, error: failure ? describe(failure) : null })
			.catch(error => console.error(`Could not record the ${service} check:`, describe(error)));
	}
}
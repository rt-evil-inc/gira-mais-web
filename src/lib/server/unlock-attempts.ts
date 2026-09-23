import { error } from '@sveltejs/kit';

export const UNLOCK_SOURCES = ['listed', 'hidden', 'typed'] as const;
export const UNLOCK_REQUESTS = ['accepted', 'accepted-after-network-error', 'refused', 'network-error'] as const;
export const UNLOCK_OUTCOMES = ['confirmed', 'not-confirmed', 'unresolved'] as const;

/** Two bike records plus an error envelope fit comfortably; anything bigger is not what the app sends. */
const MAX_DETAILS_CHARS = 32_000;
const MAX_REASONS = 16;
const MAX_REASON_CHARS = 64;

export function requireAppUserAgent(request: Request) {
	const userAgent = request.headers.get('user-agent');
	if (!userAgent?.startsWith('Gira+')) throw error(400, { message: 'invalid user-agent' });
	return userAgent;
}

export function requireString(value: unknown, name: string, maxLength: number) {
	if (typeof value !== 'string' || !value || value.length > maxLength) {
		throw error(400, { message: `${name} must be a non-empty string of at most ${maxLength} characters` });
	}
	return value;
}

export function optionalString(value: unknown, name: string, maxLength: number) {
	if (value === undefined || value === null) return null;
	return requireString(value, name, maxLength);
}

export function requireOneOf<T extends string>(value: unknown, name: string, allowed: readonly T[]): T {
	if (!allowed.includes(value as T)) throw error(400, { message: `${name} must be one of ${allowed.join(', ')}` });
	return value as T;
}

export function optionalInteger(value: unknown, name: string) {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'number' || !Number.isInteger(value) || Math.abs(value) > 2 ** 31 - 1) {
		throw error(400, { message: `${name} must be an integer` });
	}
	return value;
}

export function optionalReasons(value: unknown) {
	if (value === undefined || value === null) return null;
	if (!Array.isArray(value) || value.length > MAX_REASONS || !value.every(reason => typeof reason === 'string' && reason.length <= MAX_REASON_CHARS)) {
		throw error(400, { message: `hiddenReasons must be an array of at most ${MAX_REASONS} strings` });
	}
	return value as string[];
}

export function optionalDetails(value: unknown): Record<string, unknown> | null {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'object' || Array.isArray(value)) throw error(400, { message: 'details must be an object' });
	if (JSON.stringify(value).length > MAX_DETAILS_CHARS) throw error(413, { message: 'details is too large' });
	return value as Record<string, unknown>;
}
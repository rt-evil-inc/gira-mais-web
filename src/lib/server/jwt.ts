import { error } from '@sveltejs/kit';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

// Firebase App Check JWKS URL
const FIREBASE_JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';
// Firebase App Check issuer
const FIREBASE_ISSUER = 'https://firebaseappcheck.googleapis.com/860507348154';

// Create a JWKS (JSON Web Key Set) client to fetch and use keys from Firebase
const jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL), {
	cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours cache
});

/**
 * Firebase App Check token claims interface
 */
export interface FirebaseAppCheckClaims extends JWTPayload {
	app_id?: string;
	sub?: string;
	aud?: string[];
	iat?: number;
	exp?: number;
	iss?: string;
	jti?: string;
}

/**
 * Validates a Firebase App Check token using the jose library:
 * - Verifies the token signature using Firebase's public keys
 * - Validates the issuer
 * - Checks the token expiration (with optional leeway)
 *
 * @param token The Firebase App Check token to validate
 * @returns The decoded and verified token payload
 */
export async function parseFirebaseToken(token: string): Promise<FirebaseAppCheckClaims> {
	if (!token) {
		throw error(400, 'Token is required');
	}

	try {
		const { payload } = await jwtVerify(token, jwks, {
			issuer: FIREBASE_ISSUER,
		});

		return payload as FirebaseAppCheckClaims;
	} catch (err) {
		if (err instanceof Response) {
			throw err;
		}

		// Log the specific error for debugging
		console.error('JWT validation error:', err);

		// Provide more specific error messages based on error type
		if (err.code === 'ERR_JWT_EXPIRED') {
			throw error(400, 'Token expired');
		} else if (err.code === 'ERR_JWT_INVALID_SIGNATURE') {
			throw error(400, 'Invalid token signature');
		} else if (err.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
			throw error(400, 'Token claim validation failed');
		}

		throw error(400, 'Invalid token');
	}
}
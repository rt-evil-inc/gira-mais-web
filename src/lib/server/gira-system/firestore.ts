import { ServiceError } from '$lib/server/gira-status/checks';

/**
 * Read-only access to the Firestore feed behind EMEL's VAIMOO app, through Firestore's REST API. The project,
 * API key and tenant are the official app's public client credentials, the same ones Gira+ uses; the security
 * rules only allow tenant-scoped queries on `docking-stations` and `bikes`, and there are no dock records.
 */

const FIRESTORE_PROJECT = 'vaimoorotterdam';
const FIRESTORE_API_KEY = 'AIzaSyAmKfHdjYUhzYmg7qSZtRwwYE92HQQlmJ4';
const GIRA_TENANT = 'P1/EML/EML/';
const RUN_QUERY_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents:runQuery?key=${FIRESTORE_API_KEY}`;
const REQUEST_TIMEOUT_MS = 60_000;

export interface FirestoreStation {
	DockingStationId: number;
	Name: string;
	Street?: string | null;
	City?: string | null;
	StreetBuildingIdentifier?: string | null;
	Location?: { latitude: number; longitude: number } | null;
	IsActive: boolean;
	ServiceStatus?: string | null;
	DockLimit: number;
	FreeDocks: number;
	AvailableBikes: number;
}

export interface FirestoreBike {
	BikeId: number;
	VisualId: string;
	Category?: string | null;
	DockingStationId?: number | null;
	DockingPointId?: number | null;
	DockingPointVisualId?: string | null;
	IsAvaliable: boolean;
	IsBooked: boolean;
	TripVehicleState?: string | null;
	TripErrorCode?: number | null;
	BatteryPercentage?: number | null;
	Comment?: string | null;
}

export interface FirestoreDocument<T> {
	id: string;
	updateTime: Date;
	data: T;
}

type FirestoreValue =
	| { nullValue: null }
	| { booleanValue: boolean }
	| { integerValue: string }
	| { doubleValue: number }
	| { stringValue: string }
	| { timestampValue: string }
	| { geoPointValue: { latitude?: number; longitude?: number } }
	| { arrayValue: { values?: FirestoreValue[] } }
	| { mapValue: { fields?: Record<string, FirestoreValue> } }
	| { referenceValue: string }
	| { bytesValue: string };

function decodeValue(value: FirestoreValue): unknown {
	if ('nullValue' in value) return null;
	if ('booleanValue' in value) return value.booleanValue;
	if ('integerValue' in value) return Number(value.integerValue);
	if ('doubleValue' in value) return value.doubleValue;
	if ('stringValue' in value) return value.stringValue;
	if ('timestampValue' in value) return value.timestampValue;
	if ('geoPointValue' in value) return { latitude: value.geoPointValue.latitude ?? 0, longitude: value.geoPointValue.longitude ?? 0 };
	if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
	if ('mapValue' in value) return decodeFields(value.mapValue.fields ?? {});
	if ('referenceValue' in value) return value.referenceValue;
	return value.bytesValue;
}

function decodeFields(fields: Record<string, FirestoreValue>) {
	return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

type RunQueryItem = {
	document?: { name: string; fields?: Record<string, FirestoreValue>; updateTime: string };
	error?: { code: number; message: string; status: string };
};

/**
 * Every document of a tenant-scoped collection, in one request. The response is only used once it has been
 * parsed whole, so a cut-off stream fails the poll instead of passing for a feed that dropped records.
 */
export async function queryTenantCollection<T>(collectionId: 'docking-stations' | 'bikes'): Promise<FirestoreDocument<T>[]> {
	const response = await fetch(RUN_QUERY_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Accept-Encoding': 'gzip',
		},
		body: JSON.stringify({
			structuredQuery: {
				from: [{ collectionId }],
				where: { fieldFilter: { field: { fieldPath: 'Tenant' }, op: 'EQUAL', value: { stringValue: GIRA_TENANT } } },
			},
		}),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	if (!response.ok) throw new ServiceError(`Firestore ${collectionId} query failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`, response.status);

	const items = await response.json() as RunQueryItem[];
	if (!Array.isArray(items)) throw new Error(`Firestore ${collectionId} query returned ${typeof items}`);
	const failure = items.find(item => item.error);
	if (failure?.error) throw new ServiceError(`Firestore ${collectionId} query failed: ${failure.error.status} ${failure.error.message}`, failure.error.code);

	return items.flatMap(item => {
		if (!item.document) return [];
		return [{
			id: item.document.name.slice(item.document.name.lastIndexOf('/') + 1),
			updateTime: new Date(item.document.updateTime),
			data: decodeFields(item.document.fields ?? {}) as T,
		}];
	});
}
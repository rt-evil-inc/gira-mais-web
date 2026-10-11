/**
 * What the admin dashboard and its endpoints (/api/admin/*) share: the shapes of the responses, and the labels and
 * colours of what they count.
 */
import { getLocalTimeZone, type DateValue } from '@internationalized/date';
import { COLORS } from '$lib/gira-system';

export type GroupBy = 'hour' | 'day';

/** The dashboard's sections, linked from the header while on it. */
export const ADMIN_SECTIONS = [
	{ id: 'resumo', label: 'Resumo' },
	{ id: 'utilizadores', label: 'Utilizadores' },
	{ id: 'viagens', label: 'Viagens' },
	{ id: 'desbloqueios', label: 'Desbloqueios' },
	{ id: 'erros', label: 'Erros' },
];

/** A figure for a period and the period of the same length right before it. */
export interface Compared {
	current: number;
	previous: number;
}

export interface Overview {
	generatedAt: string;
	/** Devices that opened the app in the last 24 hours, 7 days and 30 days. */
	activeUsers: { day: Compared; week: Compared; month: Compared };
	/** Devices first seen in the last 7 days. */
	newUsers: Compared;
	trips: { day: Compared; week: Compared };
	/** Errors reported in the last 24 hours, and the devices that reported them. */
	errors: { count: Compared; devices: Compared };
	/** Unlock attempts in the last 7 days (survey builds left out), and how many released the bike. */
	unlocks: { attempts: Compared; confirmed: Compared };
	/** Bike ratings in the last 7 days. */
	ratings: { count: Compared; average: { current: number | null; previous: number | null } };
	/** Devices active in the last 7 days by the version and platform they last used. */
	versions: { version: string; os: string; devices: number }[];
}

export interface CountSeries {
	key: string;
	data: { timestamp: string; count: number }[];
}

export interface UsersResponse {
	/** Devices that opened the app in each bucket, by platform. */
	platforms: CountSeries[];
	/** Devices first seen in each bucket. */
	newUsers: CountSeries;
	/** Devices active in the range by platform and major OS version. */
	osVersions: { os: string; version: string; devices: number }[];
}

export interface VersionsResponse {
	/** Devices seen in the window up to each bucket, by the newest version they used. */
	series: CountSeries[];
}

export interface ActivityResponse {
	/** Average app opens and trips in each hour of each weekday (0 is Monday) in the range. */
	opens: number[][];
	trips: number[][];
}

export interface RetentionResponse {
	/** Devices first seen in each week, and how many of them came back in each week after. */
	cohorts: { week: string; devices: number; retained: number[] }[];
}

export interface TripsResponse {
	/** Trips per bucket, and the devices that made them. */
	series: CountSeries[];
	/** Devices that opened the app in each bucket, to put the trips in proportion. */
	activeDevices: CountSeries;
	stations: { id: string; name: string | null; trips: number; previous: number }[];
	ratings: { rating: number; count: number }[];
	previousRatings: { rating: number; count: number }[];
}

export interface UnlockAttempt {
	createdAt: string;
	bike: string;
	station: string | null;
	stationName: string | null;
	source: string;
	hiddenReasons: string[] | null;
	result: UnlockResult;
	vaimooCode: number | null;
	elapsedMs: number | null;
	survey: boolean;
}

export interface UnlocksResponse {
	series: CountSeries[];
	/** Attempts by how the bike was offered, and by why it was hidden, broken down by result. */
	bySource: { key: string; results: Partial<Record<UnlockResult, number>> }[];
	byReason: { key: string; results: Partial<Record<UnlockResult, number>> }[];
	refusals: { code: number | null; reason: string | null; count: number; bikes: number }[];
	/** How long confirmed unlocks took, from the request to the bike's release. */
	elapsed: { p50: number | null; p90: number | null; count: number };
	stations: { id: string; name: string | null; attempts: number; confirmed: number }[];
	recent: UnlockAttempt[];
}

export interface ErrorsResponse {
	/** Errors per bucket, by code: the most frequent ones, and the rest together as OTHER_ERRORS. */
	series: CountSeries[];
	/** Every code in the range, whatever the filters. */
	codes: { code: string; count: number; devices: number; previousCount: number; previousDevices: number; lastSeen: string }[];
	/** Every app version that reported errors in the range, whatever the filters. */
	versions: { version: string; count: number; devices: number; activeDevices: number }[];
	/** Messages with what changes between reports (bikes, stations, ratings) taken out, most frequent first. */
	signatures: { code: string; signature: string; count: number; devices: number; lastSeen: string; example: string | null }[];
	/** Devices active in the range, to put the devices with errors in proportion. */
	activeDevices: number;
	total: { count: number; devices: number };
}

export interface ErrorItem {
	id: number;
	deviceId: string;
	timestamp: string;
	errorCode: string;
	errorMessage: string | null;
	userAgent: string | null;
}

export interface ErrorListResponse {
	errors: ErrorItem[];
	/** Pass back as `before` for the next page; null on the last one. */
	next: string | null;
}

export const OTHER_ERRORS = '__other__';

type Color = { light: string; dark: string };

export const PLATFORMS: Record<string, Color & { label: string }> = {
	ios: { label: 'iOS', ...COLORS.blue },
	android: { label: 'Android', ...COLORS.good },
	unknown: { label: 'Desconhecida', ...COLORS.gray },
};

export type UnlockResult = 'confirmed' | 'not_confirmed' | 'unresolved' | 'pending' | 'network_error' | 'refused';

/** In stacking order, from the bottom up. */
export const UNLOCK_RESULTS: Record<UnlockResult, Color & { label: string; description: string }> = {
	confirmed: { label: 'Desbloqueada', description: 'A viagem começou', ...COLORS.good },
	not_confirmed: { label: 'Não confirmada', description: 'Aceite, mas a bicicleta não chegou a sair', ...COLORS.serious },
	unresolved: { label: 'Sem resposta', description: 'Aceite, mas a app não soube se a bicicleta saiu', ...COLORS.warning },
	pending: { label: 'Sem resultado', description: 'Aceite, e a app ainda não enviou o resultado', ...COLORS.grayLight },
	network_error: { label: 'Erro de rede', description: 'O pedido não chegou à VAIMOO', ...COLORS.violet },
	refused: { label: 'Recusada', description: 'A VAIMOO recusou o pedido', ...COLORS.critical },
};

/** Trip ratings as the statistics page names them; the app asks for them with faces (see RatingFace). */
export const RATING_LABELS: Record<number, string> = {
	1: 'Muito mau',
	2: 'Mau',
	3: 'Neutro',
	4: 'Bom',
	5: 'Muito bom',
};

export const UNLOCK_SOURCES: Record<string, string> = {
	listed: 'Listada como disponível',
	hidden: 'Escondida (indisponível)',
	typed: 'Introduzida pelo número',
};

export const HIDDEN_REASONS: Record<string, string> = {
	'Service status is not OK': 'Estado de serviço não OK',
	'Has low battery': 'Bateria fraca',
	'Is offline': 'Offline',
	'Has repair': 'Em reparação',
};

/** Colours for series that aren't anything in particular, such as error codes or app versions. */
export const PALETTE: Color[] = [
	COLORS.blue,
	COLORS.serious,
	COLORS.good,
	COLORS.violet,
	COLORS.warning,
	COLORS.critical,
	COLORS.free,
	{ light: '#d07fb0', dark: '#d68fbb' },
	{ light: '#4fa89a', dark: '#5fb3a5' },
	{ light: '#b08a5a', dark: '#c09c6e' },
];

export function color(entry: Color, dark: boolean) {
	return dark ? entry.dark : entry.light;
}

/** Version strings in numeric order ("1.10.0" after "1.9.0"), development builds right after their release. */
export function compareVersions(a: string, b: string) {
	const parse = (version: string) => (version.match(/\d+/g) ?? []).slice(0, 3).map(Number);
	const [partsA, partsB] = [parse(a), parse(b)];
	for (let index = 0; index < 3; index++) {
		const difference = (partsA[index] ?? 0) - (partsB[index] ?? 0);
		if (difference) return difference;
	}
	return a.localeCompare(b);
}

/** The parameters of a range endpoint for the days picked: the start of the first to the end of the last. */
export function rangeQuery(interval: { start?: DateValue; end?: DateValue }, groupBy: string, extra: Record<string, string | string[] | undefined> = {}) {
	const timezone = getLocalTimeZone();
	const params = new URLSearchParams({ groupBy, timezone });
	if (interval.start) params.set('start', interval.start.toDate(timezone).toISOString());
	if (interval.end) params.set('end', interval.end.add({ days: 1 }).toDate(timezone).toISOString());
	for (const [key, value] of Object.entries(extra)) {
		for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
	}
	return params.toString();
}

export function formatNumber(value: number, maximumFractionDigits = 0) {
	return value.toLocaleString('pt-PT', { maximumFractionDigits });
}

export function formatPercent(value: number, maximumFractionDigits = 0) {
	return value.toLocaleString('pt-PT', { style: 'percent', maximumFractionDigits });
}

/** A duration in milliseconds as "8,1 s" or "1 min 5 s". */
export function formatDuration(ms: number) {
	if (ms < 60_000) return `${formatNumber(ms / 1000, 1)} s`;
	return `${Math.floor(ms / 60_000)} min ${Math.round(ms % 60_000 / 1000)} s`;
}
/** How long ago, briefly: "agora", "há 5 min", "há 3 h", "há 2 dias". */
export function timeAgo(timestamp: string | Date, now = Date.now()) {
	const minutes = Math.max(0, Math.round((now - new Date(timestamp).getTime()) / 60_000));
	if (minutes < 1) return 'agora';
	if (minutes < 60) return `há ${minutes} min`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `há ${hours} h`;
	const days = Math.round(hours / 24);
	return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

/** A relative change, as "+12%", or "×31" once it's past doubling. */
export function formatChange(change: number) {
	if (change >= 1) return `×${formatNumber(change + 1, change < 9 ? 1 : 0)}`;
	return `${change > 0 ? '+' : ''}${formatPercent(change, Math.abs(change) < 0.1 ? 1 : 0)}`;
}
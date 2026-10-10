/**
 * Statuses of the GIRA system (EMEL's VAIMOO backend) as recorded by the server-side poller, shared by the
 * poller, the statistics endpoints and the statistics page. Each status carries the colour it is charted in,
 * in stacking order from the bottom up.
 *
 * Snapshots can count a status in parts, as "status:part" keys ("unavailable:repair"); charts show the status as a
 * whole and its parts in the tooltip. A status's `parts` labels them.
 */

type Color = { light: string; dark: string };
type StatusDefinition = Color & { label: string; parts?: Record<string, string> };

/**
 * Soft, light steps around the site's lime primary, each stepped for its mode's surface. Neighbours in every stack
 * below stay apart under colour-blindness simulation; greys are for states that aren't good or bad.
 */
export const COLORS = {
	good: { light: '#7dae32', dark: '#7aa33e' },
	warning: { light: '#f1c255', dark: '#ebc670' },
	serious: { light: '#eb9d70', dark: '#e29f78' },
	critical: { light: '#d44e49', dark: '#cd5551' },
	blue: { light: '#498aca', dark: '#6c9ed0' },
	violet: { light: '#8e70c2', dark: '#aa94d1' },
	free: { light: '#a5d4e9', dark: '#376a81' },
	gray: { light: '#aeaaa3', dark: '#6a6762' },
	grayLight: { light: '#e3e1de', dark: '#383633' },
	grayDark: { light: '#75726c', dark: '#c5c3bf' },
} satisfies Record<string, Color>;

export const STATION_STATUSES = {
	available: { label: 'Disponível', ...COLORS.good },
	limited_use: { label: 'Uso limitado', ...COLORS.warning },
	in_use: { label: 'Em uso', ...COLORS.blue },
	unavailable_by_system: { label: 'Indisponível (sistema)', ...COLORS.serious },
	unavailable_by_operator: { label: 'Indisponível (operador)', ...COLORS.critical },
	disabled: { label: 'Desativada', ...COLORS.violet },
	inactive: { label: 'Inativa', ...COLORS.gray },
	unknown: { label: 'Desconhecido', ...COLORS.grayLight },
	missing: { label: 'Desaparecida', ...COLORS.grayDark },
} satisfies Record<string, StatusDefinition>;

/** Why a station is out of service, from its station status; riders can't tell these apart, so they're only detail. */
const CLOSURES = {
	unavailable_by_operator: 'Fechada pelo operador',
	unavailable_by_system: 'Fechada pelo sistema',
	disabled: 'Desativada',
	inactive: 'Desligada no sistema',
	unknown: 'Sem estado',
};

/**
 * Stations by whether a rider can take a bike and return one there (see stationOccupancy), counted with the
 * station status as the part for those out of service.
 */
export const OCCUPANCY_STATUSES = {
	ok: { label: 'Com bicicletas e docas', ...COLORS.good },
	empty: { label: 'Vazia', ...COLORS.blue },
	full: { label: 'Cheia', ...COLORS.warning },
	blocked: { label: 'Sem bicicletas nem docas', ...COLORS.violet },
	/** In service, but its record hasn't changed for a long time: see idleSince in $lib/server/gira-system/stations. */
	idle: { label: 'Suspeita', ...COLORS.serious },
	out_of_service: { label: 'Indisponível', ...COLORS.critical, parts: CLOSURES },
	missing: { label: 'Desaparecida', light: COLORS.gray.light, dark: COLORS.grayDark.dark },
} satisfies Record<string, StatusDefinition>;

export const DOCK_STATUSES = {
	available_bike: { label: 'Com bicicleta disponível', ...COLORS.good },
	unavailable_bike: { label: 'Com bicicleta indisponível', ...COLORS.warning },
	free: { label: 'Livre', ...COLORS.free },
	/** Reported free, but long without a bike: see longEmptyDocks in $lib/server/gira-system/docks. */
	suspicious: { label: 'Suspeita', ...COLORS.serious },
	unavailable: { label: 'Indisponível', ...COLORS.critical },
	missing: { label: 'Desaparecida', light: COLORS.gray.light, dark: COLORS.grayDark.dark },
} satisfies Record<string, StatusDefinition>;

/** Why a docked bike can't be unlocked, by its most telling reason (see unavailableReason). */
const UNAVAILABLE_REASONS = {
	repair: 'Em reparação',
	low_battery: 'Bateria fraca',
	offline: 'Offline',
	other: 'Sem motivo indicado',
};

/** Where a bike out of the docks (and not on a trip) is. */
const OUTSIDE_PARTS = {
	/** Parked at a station but in none of its docks: beside a full station, or left there by the operator. */
	at_station: 'Numa estação, sem doca',
	elsewhere: 'Fora de estação',
};

export const BIKE_STATUSES = {
	available: { label: 'Disponível', ...COLORS.good },
	booked: { label: 'Reservada', ...COLORS.violet },
	unavailable: { label: 'Indisponível', ...COLORS.critical, parts: UNAVAILABLE_REASONS },
	in_trip: { label: 'Em viagem', ...COLORS.blue },
	outside: { label: 'Fora das docas', ...COLORS.gray, parts: OUTSIDE_PARTS },
	missing: { label: 'Desaparecida', ...COLORS.grayDark },
} satisfies Record<string, StatusDefinition>;

export type StationStatus = keyof typeof STATION_STATUSES;
export type OccupancyStatus = keyof typeof OCCUPANCY_STATUSES;
export type DockStatus = keyof typeof DOCK_STATUSES;
export type BikeStatus = keyof typeof BIKE_STATUSES;

export type SystemKind = 'stations' | 'occupancy' | 'docks' | 'bikes';

/**
 * One status over time, as served by /api/statistics/system; null where no poll fell in the bucket. `parts`
 * splits the count where the snapshots counted it in parts.
 */
export type StatusSeries = { status: string; data: { timestamp: string; count: number | null; parts?: Record<string, number> }[] };

export const SYSTEM_STATUSES: Record<SystemKind, Record<string, StatusDefinition>> = {
	stations: STATION_STATUSES,
	occupancy: OCCUPANCY_STATUSES,
	docks: DOCK_STATUSES,
	bikes: BIKE_STATUSES,
};

/**
 * The server's reasons for flagging a bike unavailable, from its `Comment` ("Has low battery; \tIs offline; \t").
 * "Bike is OK" is what available bikes carry, so it isn't a reason.
 */
export function bikeReasons(comment: string | null | undefined): string[] {
	return (comment ?? '').split(';').map(reason => reason.trim()).filter(reason => reason && reason !== 'Bike is OK');
}

/** Reasons under which VAIMOO refuses the unlock (Gira+'s field survey, September 2026) or never tried it. */
const REPAIR_REASONS = new Set(['Has repair', 'Has power issue']);

/** The most telling of an unavailable bike's reasons: nearly all of them come with "service status is not OK". */
export function unavailableReason(reasons: string[]): keyof typeof UNAVAILABLE_REASONS {
	if (reasons.some(reason => REPAIR_REASONS.has(reason))) return 'repair';
	if (reasons.includes('Has low battery')) return 'low_battery';
	if (reasons.includes('Is offline')) return 'offline';
	return 'other';
}

export const REASON_LABELS: Record<string, string> = {
	'Service status is not OK': 'Estado de serviço não OK',
	'Has low battery': 'Bateria fraca',
	'Is offline': 'Offline',
	'Has repair': 'Em reparação',
	'Has power issue': 'Problema de energia',
	'Has active trip': 'Em viagem',
	'Has attached user': 'Com utilizador associado',
	'Has booking ticket': 'Reservada',
};

export interface BikeState {
	available: boolean;
	booked: boolean;
	tripState: string | null;
	docked: boolean;
	reasons: string[];
}

/**
 * One status per bike, so the statuses add up to the fleet: a trip wins over a booking, which wins over the dock.
 * A docked bike the system won't let riders unlock is unavailable, whatever the reason.
 */
export function bikeStatus(bike: BikeState): BikeStatus {
	if (bike.tripState === 'RUNNING' || bike.tripState === 'WAITING_FOR_START' || bike.reasons.includes('Has active trip')) return 'in_trip';
	if (bike.booked || bike.reasons.includes('Has booking ticket')) return 'booked';
	if (!bike.docked) return 'outside';
	return bike.available ? 'available' : 'unavailable';
}

/** The station's status: its `ServiceStatus`, unless the station is switched off altogether. */
export function stationStatus(station: { active: boolean; serviceStatus?: string | null }): string {
	if (!station.active) return 'inactive';
	const status = (station.serviceStatus ?? '').toLowerCase();
	return status || 'unknown';
}

/** The statuses the official app treats as open; it shows every other one as "station not available". */
const IN_SERVICE = new Set(['available', 'in_use', 'limited_use']);

export function stationInService(status: string) {
	return IN_SERVICE.has(status);
}

/**
 * Whether a station in service has a bike to take (one flagged available, as the official app lists them) and a
 * dock to return one to (free and not suspicious). An idle station's counts can't be trusted, so it's only idle.
 */
export function stationOccupancy(status: string, availableBikes: number, usableFreeDocks: number, idle = false): OccupancyStatus {
	if (!stationInService(status)) return 'out_of_service';
	if (idle) return 'idle';
	if (availableBikes > 0) return usableFreeDocks > 0 ? 'ok' : 'full';
	return usableFreeDocks > 0 ? 'empty' : 'blocked';
}

/** A listed station's occupancy, from the bikes in its docks. */
export function listedStationOccupancy(station: SystemStation): OccupancyStatus {
	const availableBikes = station.bikes.filter(bike => bike.dock != null && bike.status === 'available').length;
	return stationOccupancy(station.status, availableBikes, station.freeDocks - station.suspiciousDocks, station.idleSince != null);
}

/**
 * The feed has no dock records: a station only says how many docks it has (`DockLimit`) and how many are free,
 * and each bike names the dock it sits in. Docks that are neither free nor holding a bike are unavailable.
 */
export function unavailableDocks(station: { dockLimit: number; freeDocks: number }, dockedBikes: number) {
	return Math.max(0, station.dockLimit - station.freeDocks - dockedBikes);
}

/** "3 dias" from 2 days on, "36 horas" before: how long something has lasted, rounded down. */
export function formatDuration(hours: number) {
	if (hours >= 48) return `${Math.floor(hours / 24)} dias`;
	const whole = Math.floor(hours);
	return `${whole} ${whole === 1 ? 'hora' : 'horas'}`;
}

/** "7 dias", "36 horas". */
export function formatHours(hours: number) {
	if (hours >= 48 && hours % 24 === 0) return `${hours / 24} dias`;
	const rounded = Math.round(hours * 10) / 10;
	return `${rounded.toLocaleString('pt-PT')} ${rounded === 1 ? 'hora' : 'horas'}`;
}

export function statusLabel(kind: SystemKind, status: string) {
	return SYSTEM_STATUSES[kind][status]?.label ?? status;
}

export function partLabel(kind: SystemKind, status: string, part: string) {
	return SYSTEM_STATUSES[kind][status]?.parts?.[part] ?? part;
}

/** A station's status as riders see it, and why, for those out of service. */
export function stationService(status: string): { status: 'available' | 'unavailable' | 'missing'; detail: string | null } {
	if (status === 'missing') return { status, detail: null };
	if (stationInService(status)) return { status: 'available', detail: status === 'available' ? null : statusLabel('stations', status) };
	return { status: 'unavailable', detail: CLOSURES[status as keyof typeof CLOSURES] ?? status };
}

/** A status's colour in the current mode; statuses the feed started using later get a neutral grey. */
export function statusColor(kind: SystemKind, status: string, dark: boolean) {
	const color = SYSTEM_STATUSES[kind][status] ?? COLORS.gray;
	return dark ? color.dark : color.light;
}

/** A station as served by /api/statistics/system/stations. */
export interface SystemStation {
	id: number;
	number: string | null;
	name: string;
	address: string | null;
	latitude: number | null;
	longitude: number | null;
	/** A station status, or 'missing' once the feed stopped returning it. */
	status: string;
	serviceStatus: string | null;
	dockLimit: number;
	freeDocks: number;
	unavailableDocks: number;
	/** How many of freeDocks are suspicious: reported free, but long without a bike. */
	suspiciousDocks: number;
	/** Empty docks that haven't held a bike for suspiciousAfterHours, with when they last did. */
	longEmptyDocks: { number: string; lastOccupiedAt: string }[];
	/** Docks never seen with a bike since tracking began, counted once that's longer than suspiciousAfterHours. */
	neverOccupiedDocks: number;
	availableBikes: number;
	/** When the station's record last changed, if that's longer ago than idleAfterHours; null otherwise. */
	idleSince: string | null;
	firstSeenAt: string;
	lastSeenAt: string;
	missingSince: string | null;
	bikes: { visualId: string; dock: string | null; battery: number | null; status: BikeStatus; reasons: string[] }[];
}

export interface MissingBike {
	visualId: string;
	stationId: number | null;
	stationName: string | null;
	dock: string | null;
	status: BikeStatus;
	firstSeenAt: string;
	lastSeenAt: string;
	missingSince: string;
}

export interface SystemCurrentState {
	polledAt: string | null;
	suspiciousAfterHours: number;
	idleAfterHours: number;
	docksSince: string | null;
	totals: Record<SystemKind, Record<string, number>> | null;
	stations: SystemStation[];
	missingBikes: MissingBike[];
}
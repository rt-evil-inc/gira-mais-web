/**
 * The uptime of the services behind GIRA, shared by the status endpoint and the statistics page. Each service is
 * judged hour by hour from two sources: the server's own requests to it (gira_checks), and the failures Gira+
 * users report (the errors table), as a share of the users active in that hour.
 */

export type HourStatus = 'operational' | 'degraded' | 'outage';

/**
 * User reports only flag an hour when enough users are affected: in the month after the new backend launched,
 * 90% of hours had under 7% of active users report a failure, and incidents ran from 10% to 70%.
 */
export const REPORT_THRESHOLDS = {
	/** With fewer active users than this (at night, or before a version spread), reports can't tell either way. */
	minActive: 20,
	/** Fewer affected users than this is noise, whatever the share. */
	minUsers: 8,
	degraded: 0.08,
	outage: 0.3,
};

export interface ServiceDefinition {
	label: string;
	/** For tabs. */
	short: string;
	description: string;
	host: string;
	/**
	 * Whether users' failure reports judge the service. The map's can't: the Firestore SDK retries lost
	 * connections and server errors silently, so an outage freezes the map without the app ever hearing of it.
	 */
	reported: boolean;
}

export const SERVICES = {
	feed: {
		label: 'Mapa de estações e bicicletas',
		short: 'Mapa',
		description: 'O estado das estações e bicicletas em tempo real, que a app mostra no mapa.',
		host: 'firestore.googleapis.com',
		reported: false,
	},
	login: {
		label: 'Início de sessão',
		short: 'Login',
		description: 'O login com a conta EMEL.',
		host: 'login.emel.pt',
		reported: true,
	},
	api: {
		label: 'API da GIRA',
		short: 'API',
		description: 'Desbloqueios, viagens, conta e passes: tudo o que passa pelo servidor da VAIMOO.',
		host: 'emel-consumerapp.vaimoo.com',
		reported: true,
	},
} satisfies Record<string, ServiceDefinition>;

export type ServiceId = keyof typeof SERVICES;

/** What made users' requests fail: no answer at all, or an answer that is the server's fault. */
export const FAILURE_KINDS = {
	timeout: 'Sem resposta (tempo esgotado)',
	dns: 'Servidor não encontrado (DNS)',
	tls: 'Falha na ligação segura (TLS)',
	network: 'Ligação interrompida',
	server: 'Erro do servidor (5xx)',
	rate_limited: 'Demasiados pedidos (429)',
} as const;

export type FailureKind = keyof typeof FAILURE_KINDS;

/** One hour of one service, as served by /api/statistics/status. */
export interface StatusHour {
	/** The hour's start, ISO. */
	hour: string;
	status: HourStatus;
	checks: { total: number; failed: number; latencyMs: number | null };
	/** Users active in the hour (on an app version that uses the new backend) and how many reported a failure. */
	reports: { active: number; affected: number; byKind: Partial<Record<FailureKind, number>> };
}

/** One day of one service: the worst of its hours. */
export interface StatusDay {
	/** The day, YYYY-MM-DD in the requested timezone. */
	day: string;
	status: HourStatus | 'no_data';
	degradedHours: number;
	outageHours: number;
	/** Hours with any data. */
	hours: number;
	checks: { total: number; failed: number };
	/** Most users affected in any one hour, and that hour's share of active users. */
	peak: { affected: number; active: number } | null;
}

export interface ServiceStatus {
	id: ServiceId;
	status: HourStatus | 'no_data';
	/** Share of hours with data that weren't an outage, over the whole window. */
	uptime: number | null;
	days: StatusDay[];
	/** The last 48 hours, for the detail chart. */
	hours: StatusHour[];
}

export interface StatusResponse {
	generatedAt: string;
	since: string;
	services: ServiceStatus[];
}

/**
 * How one hour went. The server's own checks (one every 5 minutes) mark an outage when every one failed, or at
 * least half and two or more did, and errors when two did; a single failure among successes is a blip. While the
 * feed fails the poller backs off to one try every 40 minutes, so an hour may hold a single, failed check: that
 * is still an outage. User reports mark the hour when enough of its users were affected, if it had enough users to tell.
 */
export function hourStatus(checks: { total: number; failed: number }, reports: { active: number; affected: number }): HourStatus {
	let status: HourStatus = 'operational';
	if (checks.failed && (checks.failed === checks.total || (checks.failed >= 2 && checks.failed >= checks.total / 2))) status = 'outage';
	else if (checks.failed >= 2) status = 'degraded';

	if (judgedByReports(reports) && reports.affected >= REPORT_THRESHOLDS.minUsers) {
		const share = reports.affected / reports.active;
		if (share >= REPORT_THRESHOLDS.outage) status = 'outage';
		else if (share >= REPORT_THRESHOLDS.degraded && status === 'operational') status = 'degraded';
	}
	return status;
}

/** Whether the hour had enough active users for their reports to tell either way. */
export function judgedByReports(reports: { active: number }) {
	return reports.active >= REPORT_THRESHOLDS.minActive;
}

const RANK: Record<HourStatus, number> = { operational: 0, degraded: 1, outage: 2 };

export function worst(statuses: HourStatus[]): HourStatus {
	return statuses.reduce<HourStatus>((current, status) => RANK[status] > RANK[current] ? status : current, 'operational');
}
import { checked, ServiceError } from './checks';

/*
 * Light probes of the GIRA services the poller doesn't already query (it records its feed requests itself).
 * Each is an unauthenticated GET of an endpoint that needs a user: a quick 401 means the service is up and
 * answering, and no account, token or side effect is involved. Endpoints that unlock bikes, rate trips or
 * consume one-time codes are never probed.
 */

const PROBE_INTERVAL_MS = 5 * 60_000;
/** Off the poller's slot (:37), so the probes don't add to its requests. */
const PROBE_OFFSET_MS = 52_000;
/** What the app allows a request before retrying. */
const PROBE_TIMEOUT_MS = 10_000;

const PROBES: { service: string; target: string; url: string; headers: Record<string, string> }[] = [
	{ service: 'login', target: 'GET /emel-api/user', url: 'https://login.emel.pt/emel-api/user', headers: {} },
	{
		service: 'api',
		target: 'GET /user/trip',
		url: 'https://emel-consumerapp.vaimoo.com/user/trip?userId=null&mainAppVersion=A1.0.0',
		// The official app's public id, which the API expects on every request.
		headers: { AppId: '8d75593b-83a1-4cce-862f-1671b59c5b0f' },
	},
];

async function probe({ url, headers }: (typeof PROBES)[number]) {
	// As the app sends them: Node's default "Accept-Language: *" makes VAIMOO answer 500.
	const response = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'en', ...headers }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
	// Read the body so the connection is released; it's a short "Unauthorized".
	const body = await response.text();
	// Any answer short of a server error or rate limiting means the service is there to take requests.
	if (response.status >= 500 || response.status === 429) throw new ServiceError(`HTTP ${response.status}: ${body.slice(0, 200)}`, response.status);
	return response.status;
}

interface Prober {
	stop: () => void;
}

// Vite re-runs the server hooks on every change in development; keep a single prober across reloads.
const globalProber = globalThis as typeof globalThis & { __giraStatusProber?: Prober };

export function startStatusProbes() {
	globalProber.__giraStatusProber?.stop();
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	function schedule() {
		// A round still running when this prober was replaced mustn't start a second loop.
		if (stopped) return;
		const now = Date.now();
		const next = (Math.floor((now - PROBE_OFFSET_MS) / PROBE_INTERVAL_MS) + 1) * PROBE_INTERVAL_MS + PROBE_OFFSET_MS;
		timer = setTimeout(run, next - now);
	}

	async function run() {
		// The outcome is what's recorded; a failure here is the data, not a problem to log.
		await Promise.all(PROBES.map(definition => checked(definition.service, definition.target, () => probe(definition), status => status).catch(() => {})));
		schedule();
	}

	schedule();
	console.log(`GIRA status probes started, every ${PROBE_INTERVAL_MS / 60_000} minutes`);
	globalProber.__giraStatusProber = {
		stop: () => {
			stopped = true;
			if (timer) clearTimeout(timer);
		},
	};
}
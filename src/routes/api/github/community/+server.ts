import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const REPO = 'rt-evil-inc/gira-mais';
const SPONSORS_URL = 'https://ghs.vercel.app/sponsors/rt-evil-inc';
const STARGAZERS_TO_SHOW = 23;

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const DEGRADED_CACHE_TTL = 60 * 1000; // 1 minute, when part of the data failed to load

// GitHub requires authentication to list stargazers, so without a token that section stays empty
if (!env.GITHUB_TOKEN) {
	console.warn('⚠️ WARNING: GITHUB_TOKEN environment variable is not set. The stargazers list will be empty.');
}

interface GitHubUser {
	login: string;
	avatar_url: string;
	html_url: string;
	contributions?: number | string;
}

interface Sponsor {
	handle: string;
	avatar: string;
	profile: string;
}

interface CommunityData {
	repo: { stars: number, forks: number };
	contributors: GitHubUser[];
	stargazers: GitHubUser[];
	sponsors: Sponsor[];
}

let cache: { data: CommunityData, expiresAt: number } | null = null;

async function github(path: string, authenticated = true) {
	const useToken = authenticated && !!env.GITHUB_TOKEN;

	const response = await fetch(`https://api.github.com${path}`, {
		headers: {
			'Accept': 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			...useToken ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {},
		},
	});

	// A rejected token (expired, revoked, or blocked by org policy) must not take down the
	// endpoints that work anonymously, so retry those without it
	if (useToken && (response.status === 401 || response.status === 403)) {
		console.warn(`GitHub rejected the token for ${path} (${response.status}), retrying unauthenticated`);
		return github(path, false);
	}

	if (!response.ok) {
		throw new Error(`GitHub responded ${response.status} for ${path}`);
	}

	return response.json();
}

// Only forward the fields the page actually renders, to keep the payload small
function pickUser({ login, avatar_url, html_url, contributions }: GitHubUser): GitHubUser {
	return { login, avatar_url, html_url, contributions };
}

// Stargazers are returned oldest first, so the most recent ones are at the end of the last page
async function fetchRecentStargazers(totalStars: number): Promise<GitHubUser[]> {
	if (!env.GITHUB_TOKEN || totalStars === 0) return [];

	const lastPage = Math.ceil(totalStars / 100);
	const onLastPage = totalStars % 100;
	// Reach back one page when the last one alone can't fill the row
	const pages = onLastPage > 0 && onLastPage < STARGAZERS_TO_SHOW && lastPage > 1 ? [lastPage - 1, lastPage] : [lastPage];

	const results = await Promise.all(pages.map(page => github(`/repos/${REPO}/stargazers?per_page=100&page=${page}`)));
	return results.flat().slice(-STARGAZERS_TO_SHOW).map(pickUser);
}

async function fetchSponsors(): Promise<Sponsor[]> {
	const response = await fetch(SPONSORS_URL);
	if (!response.ok) throw new Error(`Sponsors endpoint responded ${response.status}`);

	return (await response.json()).sponsors ?? [];
}

async function settle<T>(label: string, promise: Promise<T>, fallback: T) {
	try {
		return { value: await promise, ok: true };
	} catch (err) {
		console.error(`Error fetching ${label}:`, err);
		return { value: fallback, ok: false };
	}
}

export const GET: RequestHandler = async ({ setHeaders }) => {
	setHeaders({ 'Cache-Control': 'public, max-age=300' });

	if (cache && cache.expiresAt > Date.now()) {
		return json(cache.data);
	}

	try {
		const repoData = await github(`/repos/${REPO}`);
		const stars = repoData.stargazers_count;

		const [contributors, stargazers, sponsors] = await Promise.all([
			settle('contributors', github(`/repos/${REPO}/contributors?per_page=100`).then((users: GitHubUser[]) => users.map(pickUser)), []),
			settle('stargazers', fetchRecentStargazers(stars), []),
			settle('sponsors', fetchSponsors(), []),
		]);

		const data: CommunityData = {
			repo: { stars, forks: repoData.forks_count },
			contributors: contributors.value,
			stargazers: stargazers.value,
			sponsors: sponsors.value,
		};

		// Retry sooner if any of the sections came back empty because of an error
		const ttl = contributors.ok && stargazers.ok && sponsors.ok ? CACHE_TTL : DEGRADED_CACHE_TTL;
		cache = { data, expiresAt: Date.now() + ttl };

		return json(data);
	} catch (err) {
		console.error('Error fetching community data:', err);

		// Serve stale data rather than blanking the section on a transient failure
		if (cache) return json(cache.data);
		throw error(502, { message: 'Could not fetch community data from GitHub' });
	}
};
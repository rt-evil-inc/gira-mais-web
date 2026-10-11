const cache = new Map<string, { expires: number; value: Promise<unknown> }>;

/**
 * The value computed for the key in the last ttlMs, or a new one. Concurrent requests share one computation; a
 * failed one isn't kept. So several open tabs or visitors asking for the same figures cost the database one query.
 */
export function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
	const now = Date.now();
	const hit = cache.get(key);
	if (hit && hit.expires > now) return hit.value as Promise<T>;
	for (const [entryKey, entry] of cache) if (entry.expires <= now) cache.delete(entryKey);
	const value = compute();
	cache.set(key, { expires: now + ttlMs, value });
	value.catch(() => cache.delete(key));
	return value;
}

/** The request's URL as a cache key: the path and the given parameters (all of them by default), in a stable order. */
export function cacheKey(url: URL, names?: string[]) {
	const params = [...url.searchParams].filter(([name]) => !names || names.includes(name)).sort(([a], [b]) => a.localeCompare(b));
	return `${url.pathname}?${new URLSearchParams(params)}`;
}

/** A JSON endpoint's response, cached as for cached(): its body is computed once and served to every request in ttlMs. */
export async function cachedResponse(key: string, ttlMs: number, compute: () => Promise<Response>) {
	const { body, status, headers } = await cached(key, ttlMs, async () => {
		const response = await compute();
		return { body: await response.text(), status: response.status, headers: [...response.headers] };
	});
	return new Response(body, { status, headers });
}
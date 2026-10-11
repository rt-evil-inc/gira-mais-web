import { untrack } from 'svelte';

/**
 * JSON from an endpoint, for a part of a page that fetches its own data. Asking again for the same URL refreshes
 * it in place: what is on screen, and whatever the user picked around it, stays until the new data arrives.
 */
export class Loader<T> {
	data = $state<T | undefined>(undefined);

	error = $state<string | null>(null);

	/** Fetching a different URL: the data on screen, if any, is for something else. */
	loading = $state(false);

	/** Fetching the same URL again. */
	refreshing = $state(false);

	#url: string | null = null;

	#controller: AbortController | null = null;

	/** Fetch the URL, cancelling whatever was being fetched. Safe to call from an effect: it tracks nothing. */
	load(url: string) {
		return untrack(() => this.#load(url));
	}

	async #load(url: string) {
		const refresh = url === this.#url && this.data !== undefined;
		this.#controller?.abort();
		const controller = this.#controller = new AbortController;
		this.#url = url;
		if (refresh) this.refreshing = true;
		else this.loading = true;
		try {
			const response = await fetch(url, { signal: controller.signal });
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(body?.message ?? `HTTP ${response.status}`);
			}
			this.data = await response.json();
			this.error = null;
		} catch (err) {
			if (controller.signal.aborted) return;
			this.error = err instanceof Error ? err.message : 'Erro desconhecido';
			// A failed refresh keeps the data it would have replaced; a failed load has none to show.
			if (!refresh) this.data = undefined;
		} finally {
			if (this.#controller === controller) {
				this.loading = false;
				this.refreshing = false;
			}
		}
	}
}
<script lang="ts">
	/**
	 * The face the app shows for a trip rating, from 1 (angry) to 5 (happy): Tabler's mood icons (MIT), as in the
	 * app's TripRating.
	 */
	let { rating, class: className = 'h-5 w-5' }: { rating: number; class?: string } = $props();

	const FACE = 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0';
	const FEATURES: Record<number, string[]> = {
		1: ['M8 16l1 -1l1.5 1l1.5 -1l1.5 1l1.5 -1l1 1', 'M8.5 11.5l1.5 -1.5l-1.5 -1.5', 'M15.5 11.5l-1.5 -1.5l1.5 -1.5'],
		2: ['M9 10l.01 0', 'M15 10l.01 0', 'M9.5 16a10 10 0 0 1 6 -1.5'],
		3: ['M9 10l.01 0', 'M15 10l.01 0', 'M9 15l6 0'],
		4: ['M9 10l.01 0', 'M15 10l.01 0', 'M9.5 15a3.5 3.5 0 0 0 5 0'],
		5: ['M9 9l.01 0', 'M15 9l.01 0', 'M8 13a4 4 0 1 0 8 0h-8'],
	};
</script>

<svg class={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	<path d={FACE} />
	{#each FEATURES[rating] ?? [] as d (d)}
		<path {d} />
	{/each}
</svg>
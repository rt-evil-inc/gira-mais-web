<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { TrendingDown, TrendingUp, Minus } from '@lucide/svelte';
	import { formatPercent } from '$lib/admin';

	interface Props {
		title: string;
		value?: string;
		/** The figures to compare, for the change shown under the value. */
		current?: number | null;
		previous?: number | null;
		/** What the previous figure is for ("dia anterior"). */
		previousLabel?: string;
		/** A rise is bad news (errors). */
		invert?: boolean;
		/** Compare as a difference in points rather than a relative change (for rates). */
		points?: boolean;
		hint?: string;
		loading?: boolean;
	}

	let { title, value, current, previous, previousLabel, invert = false, points = false, hint, loading = false }: Props = $props();

	const change = $derived.by(() => {
		if (current == null || previous == null) return null;
		if (points) return current - previous;
		return previous ? current / previous - 1 : null;
	});
	const tone = $derived(change == null || Math.abs(change) < 0.005 ? 'flat' : (change > 0) !== invert ? 'good' : 'bad');
</script>

<Card.Root class="h-full">
	<Card.CardContent class="flex h-full flex-col gap-1 p-3 sm:p-4">
		<h3 class="text-xs font-medium text-muted-foreground sm:text-sm">{title}</h3>
		{#if loading}
			<div class="h-8 w-20 animate-pulse rounded bg-muted"></div>
			<div class="h-3 w-24 animate-pulse rounded bg-muted"></div>
		{:else}
			<div class="text-2xl font-bold tabular-nums sm:text-3xl">{value ?? '-'}</div>
			{#if change != null}
				<div class="flex flex-wrap items-center gap-x-1 text-xs {tone === 'good' ? 'text-green-600 dark:text-green-500' : tone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}">
					{#if tone === 'flat'}
						<Minus class="h-3 w-3" />
					{:else if change > 0}
						<TrendingUp class="h-3 w-3" />
					{:else}
						<TrendingDown class="h-3 w-3" />
					{/if}
					<span class="font-medium tabular-nums">
						{change > 0 ? '+' : ''}{points ? `${(change * 100).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} p.p.` : formatPercent(change, Math.abs(change) < 0.1 ? 1 : 0)}
					</span>
					{#if previousLabel}<span class="text-muted-foreground">vs {previousLabel}</span>{/if}
				</div>
			{/if}
			{#if hint}
				<p class="mt-auto pt-1 text-xs text-muted-foreground">{hint}</p>
			{/if}
		{/if}
	</Card.CardContent>
</Card.Root>
<script lang="ts" module>
	export interface BarListItem {
		key: string;
		label: string;
		/** Under the label, e.g. an id. */
		sublabel?: string;
		value: number;
		/** Shown instead of the value. */
		valueLabel?: string;
		/** Next to the value, e.g. the change from the previous period. */
		detail?: string;
		detailTone?: 'good' | 'bad' | 'muted';
		/** Parts of the bar, from the left; they add up to the value. Without them, the bar is one colour. */
		segments?: { value: number; color: string; label: string }[];
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		items: BarListItem[];
		/** The value of a full bar; the largest value by default. */
		max?: number;
		/** Picking an item. */
		onselect?: (key: string) => void;
		/** Keys of the items picked, to highlight them. */
		selected?: string[];
		empty?: string;
		/** Shown before an item's label, e.g. an icon. */
		leading?: Snippet<[BarListItem]>;
	}

	let { items, max, onselect, selected = [], empty = 'Sem dados para o período selecionado', leading }: Props = $props();
	const full = $derived(max ?? Math.max(...items.map(item => item.value), 0));
</script>

{#snippet row(item: BarListItem, width: number)}
	<div class="absolute inset-y-0.5 left-0 flex overflow-hidden rounded-md opacity-25 dark:opacity-30" style="width: {width}%">
		{#if item.segments}
			{#each item.segments as segment, index (index)}
				<div class="h-full" style="width: {item.value ? segment.value / item.value * 100 : 0}%; background: {segment.color}" title="{segment.label}: {segment.value}"></div>
			{/each}
		{:else}
			<div class="h-full w-full bg-primary"></div>
		{/if}
	</div>
	{#if leading}
		<div class="relative shrink-0">{@render leading(item)}</div>
	{/if}
	<div class="relative min-w-0 flex-1">
		<div class="truncate" title={item.label}>{item.label}</div>
		{#if item.sublabel}
			<div class="truncate text-xs text-muted-foreground">{item.sublabel}</div>
		{/if}
	</div>
	<div class="relative shrink-0 text-right tabular-nums">
		<div class="font-medium">{item.valueLabel ?? item.value.toLocaleString('pt-PT')}</div>
		{#if item.detail}
			<div class="text-xs {item.detailTone === 'good' ? 'text-green-600 dark:text-green-500' : item.detailTone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}">{item.detail}</div>
		{/if}
	</div>
{/snippet}

{#if items.length === 0}
	<p class="py-6 text-center text-sm text-muted-foreground">{empty}</p>
{:else}
	<ul class="space-y-1">
		{#each items as item (item.key)}
			{@const width = full ? Math.max(item.value / full, 0.005) * 100 : 0}
			{@const classes = `relative flex w-full items-center gap-3 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm ${selected.includes(item.key) ? 'ring-1 ring-primary' : ''}`}
			<li>
				{#if onselect}
					<button type="button" class="{classes} hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" onclick={() => onselect(item.key)}>
						{@render row(item, width)}
					</button>
				{:else}
					<div class={classes}>{@render row(item, width)}</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
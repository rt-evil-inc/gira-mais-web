<script lang="ts">
	import { formatNumber } from '$lib/admin';

	interface Props {
		/** Values by weekday (0 is Monday) and hour. */
		grid: number[][];
		/** What the values count, for the cells' titles ("aberturas"). */
		unit: string;
	}

	let { grid, unit }: Props = $props();

	const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
	const max = $derived(Math.max(...grid.flat(), 0));
	const hour = (value: number) => `${String(value).padStart(2, '0')}h`;
</script>

<div class="grid gap-[2px] text-[10px] text-muted-foreground sm:gap-1 sm:text-xs" style="grid-template-columns: auto repeat(24, minmax(0, 1fr))">
	{#each grid as hours, weekday (weekday)}
		<div class="pr-1 leading-none self-center">{WEEKDAYS[weekday]}</div>
		{#each hours as value, index (index)}
			<div
				class="aspect-square rounded-[2px] sm:rounded-sm"
				style="background: hsl(var(--primary) / {max ? (0.06 + value / max * 0.94).toFixed(3) : 0.06})"
				title="{WEEKDAYS[weekday]}, {hour(index)}-{hour((index + 1) % 24)}: {formatNumber(value, 1)} {unit} em média"
			></div>
		{/each}
	{/each}
	<div></div>
	{#each Array.from({ length: 24 }, (_, index) => index) as index (index)}
		<div class="text-center leading-none pt-1">{index % 3 === 0 ? hour(index) : ''}</div>
	{/each}
</div>
<script lang="ts">
	import { formatNumber, formatPercent, type RetentionResponse } from '$lib/admin';

	let { cohorts }: { cohorts: RetentionResponse['cohorts'] } = $props();

	const weeks = $derived(Math.max(...cohorts.map(cohort => cohort.retained.length), 0));
	const label = (week: string) => new Date(`${week}T12:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
	/** The week under way: its figures only count the days so far. */
	const currentWeek = $derived(cohorts.length ? cohorts[cohorts.length - 1].week : null);
</script>

<div class="overflow-x-auto">
	<table class="w-full border-separate border-spacing-[2px] text-xs tabular-nums">
		<thead>
			<tr class="text-muted-foreground">
				<th class="sticky left-0 bg-card px-1 text-left font-medium">Semana</th>
				<th class="px-1 text-right font-medium">Novos</th>
				{#each Array.from({ length: weeks }, (_, index) => index + 1) as week (week)}
					<th class="min-w-10 px-1 text-center font-medium">+{week}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each cohorts as cohort (cohort.week)}
				<tr>
					<td class="sticky left-0 whitespace-nowrap bg-card px-1 text-muted-foreground">{label(cohort.week)}</td>
					<td class="px-1 text-right font-medium">{formatNumber(cohort.devices)}</td>
					{#each Array.from({ length: weeks }, (_, index) => index) as index (index)}
						{@const retained = cohort.retained[index]}
						{@const share = retained == null || !cohort.devices ? null : retained / cohort.devices}
						{@const partial = index === cohort.retained.length - 1 && currentWeek !== null}
						<td
							class="rounded-sm px-1 py-1 text-center {share == null ? '' : share > 0.35 ? 'text-primary-foreground' : ''} {partial ? 'italic' : ''}"
							style={share == null ? '' : `background: hsl(var(--primary) / ${(0.08 + Math.min(share / 0.6, 1) * 0.92).toFixed(3)})`}
							title={share == null ? '' : `${formatNumber(retained)} de ${formatNumber(cohort.devices)} voltaram na semana ${index + 1} depois${partial ? ' (semana em curso)' : ''}`}
						>
							{share == null ? '' : formatPercent(share)}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
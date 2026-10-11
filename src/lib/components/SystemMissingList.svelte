<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { statusLabel, type MissingBike, type SystemStation } from '$lib/gira-system';
	import { CHART_CARD } from '$lib/charts';

	let { stations, bikes, since }: { stations: SystemStation[]; bikes: MissingBike[]; since: string | null } = $props();

	const PAGE_SIZE = 20;
	let shown = $state(PAGE_SIZE);

	const rows = $derived([
		...stations.map(station => ({
			kind: 'Estação',
			name: [station.number, station.name].filter(Boolean).join(' - '),
			where: station.address ?? '',
			missingSince: station.missingSince!,
			lastSeenAt: station.lastSeenAt,
		})),
		...bikes.map(bike => ({
			kind: 'Bicicleta',
			name: bike.visualId,
			where: bike.stationName ? `${bike.stationName}${bike.dock ? `, doca ${parseInt(bike.dock, 10) || bike.dock}` : ''}` : statusLabel('bikes', bike.status),
			missingSince: bike.missingSince,
			lastSeenAt: bike.lastSeenAt,
		})),
	].sort((a, b) => b.missingSince.localeCompare(a.missingSince)));

	function formatDate(value: string) {
		return new Date(value).toLocaleString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}
</script>

<Card.Root class={CHART_CARD.root}>
	<Card.CardHeader class={CHART_CARD.header}>
		<Card.CardTitle>Desaparecidas do sistema</Card.CardTitle>
		<Card.CardDescription>
			Estações e bicicletas que o sistema deixou de devolver, com o último sítio e momento em que foram vistas.
		</Card.CardDescription>
	</Card.CardHeader>
	<Card.CardContent class={CHART_CARD.content}>
		{#if !rows.length}
			<p class="py-4 text-center text-sm text-muted-foreground">
				Nenhuma estação ou bicicleta desapareceu{since ? ` desde ${formatDate(since)}` : ''}.
			</p>
		{:else}
			<!-- A table from md up; on a phone each row stacks, with the dates labelled, framed since the card isn't. -->
			<div class="rounded-lg border px-3 text-sm sm:rounded-none sm:border-0 sm:px-0" role="table">
				<div class="hidden grid-cols-[5rem_minmax(0,1fr)_minmax(0,1.5fr)_10rem_10rem] gap-x-4 border-b py-2 text-xs font-medium text-muted-foreground md:grid" role="row">
					<span role="columnheader">Tipo</span>
					<span role="columnheader">Nome</span>
					<span role="columnheader">Último local</span>
					<span role="columnheader">Visto pela última vez</span>
					<span role="columnheader">Desaparecida desde</span>
				</div>
				{#each rows.slice(0, shown) as row}
					<div class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 border-b py-2 last:border-0 md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1.5fr)_10rem_10rem]" role="row">
						<span class="col-start-2 row-start-1 text-xs text-muted-foreground md:col-start-auto md:row-start-auto md:text-sm" role="cell">{row.kind}</span>
						<span class="col-start-1 row-start-1 font-medium md:col-start-auto md:row-start-auto" role="cell">{row.name}</span>
						<span class="col-span-2 text-muted-foreground md:col-span-1" role="cell">{row.where}</span>
						<span class="col-span-2 text-xs tabular-nums md:col-span-1 md:text-sm" role="cell"><span class="text-muted-foreground md:hidden">Visto pela última vez: </span>{formatDate(row.lastSeenAt)}</span>
						<span class="col-span-2 text-xs tabular-nums md:col-span-1 md:text-sm" role="cell"><span class="text-muted-foreground md:hidden">Desaparecida desde: </span>{formatDate(row.missingSince)}</span>
					</div>
				{/each}
			</div>
			{#if rows.length > shown}
				<div class="mt-4 flex justify-center">
					<Button variant="outline" size="sm" onclick={() => { shown += PAGE_SIZE; }}>Mostrar mais ({rows.length - shown} restantes)</Button>
				</div>
			{/if}
		{/if}
	</Card.CardContent>
</Card.Root>
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { statusLabel, type MissingBike, type SystemStation } from '$lib/gira-system';

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

<Card.Root>
	<Card.CardHeader>
		<Card.CardTitle>Desaparecidas do sistema</Card.CardTitle>
		<Card.CardDescription>
			Estações e bicicletas que o sistema deixou de devolver, com o último sítio e momento em que foram vistas.
		</Card.CardDescription>
	</Card.CardHeader>
	<Card.CardContent>
		{#if !rows.length}
			<p class="py-4 text-center text-sm text-muted-foreground">
				Nenhuma estação ou bicicleta desapareceu{since ? ` desde ${formatDate(since)}` : ''}.
			</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b text-left text-xs text-muted-foreground">
							<th class="py-2 pr-4 font-medium">Tipo</th>
							<th class="py-2 pr-4 font-medium">Nome</th>
							<th class="py-2 pr-4 font-medium">Último local</th>
							<th class="py-2 pr-4 font-medium">Visto pela última vez</th>
							<th class="py-2 font-medium">Desaparecida desde</th>
						</tr>
					</thead>
					<tbody>
						{#each rows.slice(0, shown) as row}
							<tr class="border-b last:border-0">
								<td class="py-2 pr-4 text-muted-foreground">{row.kind}</td>
								<td class="py-2 pr-4 font-medium">{row.name}</td>
								<td class="py-2 pr-4 text-muted-foreground">{row.where}</td>
								<td class="py-2 pr-4 tabular-nums">{formatDate(row.lastSeenAt)}</td>
								<td class="py-2 tabular-nums">{formatDate(row.missingSince)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if rows.length > shown}
				<div class="mt-4 flex justify-center">
					<Button variant="outline" size="sm" onclick={() => { shown += PAGE_SIZE; }}>Mostrar mais ({rows.length - shown} restantes)</Button>
				</div>
			{/if}
		{/if}
	</Card.CardContent>
</Card.Root>
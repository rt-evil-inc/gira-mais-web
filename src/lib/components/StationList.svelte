<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Search } from '@lucide/svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import StationRow from '$lib/components/StationRow.svelte';
	import { listedStationOccupancy, type SystemStation } from '$lib/gira-system';

	let { stations, loading, error, suspiciousAfterHours }: { stations: SystemStation[]; loading: boolean; error: string | null; suspiciousAfterHours: number } = $props();

	const PAGE_SIZE = 25;

	let query = $state('');
	let filter = $state('all');
	let sort = $state('number');
	let shown = $state(PAGE_SIZE);

	function normalize(text: string) {
		return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
	}

	const needle = $derived(normalize(query));
	/** A search for a bike number (E566, e0566) finds the station it's docked at. */
	const bikeQuery = $derived(/^e\d{1,4}$/.test(needle) ? `e${needle.slice(1).padStart(4, '0')}` : null);

	const availableBikes = (station: SystemStation) => station.bikes.filter(bike => bike.dock != null && bike.status === 'available').length;
	const sorters: Record<string, (a: SystemStation, b: SystemStation) => number> = {
		number: () => 0,
		available: (a, b) => availableBikes(b) - availableBikes(a),
		free: (a, b) => b.freeDocks - b.suspiciousDocks - (a.freeDocks - a.suspiciousDocks),
		unavailable: (a, b) => b.unavailableDocks / Math.max(1, b.dockLimit) - a.unavailableDocks / Math.max(1, a.dockLimit),
		suspicious: (a, b) => b.suspiciousDocks - a.suspiciousDocks,
	};

	const filtered = $derived(stations.filter(station => {
		const occupancy = listedStationOccupancy(station);
		if (filter === 'empty' && occupancy !== 'empty' && occupancy !== 'blocked') return false;
		if (filter === 'full' && occupancy !== 'full' && occupancy !== 'blocked') return false;
		if (filter === 'out_of_service' && occupancy !== 'out_of_service') return false;
		if (filter === 'idle' && occupancy !== 'idle') return false;
		if (!needle) return true;
		if (bikeQuery) return station.bikes.some(bike => bike.visualId.toLowerCase() === bikeQuery);
		return station.number === needle ||
			normalize(`${station.number ?? ''} ${station.name} ${station.address ?? ''}`).includes(needle) ||
			station.bikes.some(bike => bike.visualId.toLowerCase() === needle);
	}).sort(sorters[sort]));

	$effect(() => {
		// Back to the first page whenever the search changes.
		void [needle, filter, sort];
		shown = PAGE_SIZE;
	});
</script>

<Card.Root id="estacoes" class="scroll-mt-20">
	<Card.CardHeader>
		<Card.CardTitle>Estações</Card.CardTitle>
		<Card.CardDescription>
			Estado atual das docas de cada estação; abre uma estação para ver as bicicletas que lá estão. O sistema só indica o
			número das docas que têm uma bicicleta; das restantes indica quantas estão livres, e as que sobram estão indisponíveis.
		</Card.CardDescription>
	</Card.CardHeader>
	<Card.CardContent>
		<div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
			<div class="relative flex-1">
				<Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input bind:value={query} placeholder="Procurar por estação, morada ou bicicleta (ex: 253, Saldanha, E0566)" class="pl-8" aria-label="Procurar estações" />
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Tabs.Root value={filter} onValueChange={value => { filter = value; }}>
					<Tabs.TabsList>
						<Tabs.TabsTrigger value="all">Todas</Tabs.TabsTrigger>
						<Tabs.TabsTrigger value="empty">Vazias</Tabs.TabsTrigger>
						<Tabs.TabsTrigger value="full">Cheias</Tabs.TabsTrigger>
						<Tabs.TabsTrigger value="idle">Suspeitas</Tabs.TabsTrigger>
						<Tabs.TabsTrigger value="out_of_service">Indisponíveis</Tabs.TabsTrigger>
					</Tabs.TabsList>
				</Tabs.Root>
				<select bind:value={sort} aria-label="Ordenar estações" class="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
					<option value="number">Por número</option>
					<option value="available">Mais bicicletas disponíveis</option>
					<option value="free">Mais docas livres</option>
					<option value="unavailable">Mais docas indisponíveis</option>
					<option value="suspicious">Mais docas suspeitas</option>
				</select>
			</div>
		</div>

		{#if loading}
			<div class="flex h-40 items-center justify-center"><Spinner /></div>
		{:else if error}
			<p class="py-8 text-center text-destructive">Erro: {error}</p>
		{:else if !filtered.length}
			<p class="py-8 text-center text-muted-foreground">
				{stations.length ? 'Nenhuma estação corresponde à pesquisa' : 'Ainda não há dados do sistema'}
			</p>
		{:else}
			<p class="mb-3 text-xs text-muted-foreground">{filtered.length} de {stations.length} estações</p>
			<div class="rounded-lg border">
				<div class="hidden grid-cols-[minmax(0,1fr)_17rem_10.5rem_1rem] gap-x-4 border-b px-2 py-2 text-xs font-medium text-muted-foreground md:grid">
					<span>Estação</span>
					<span>Docas</span>
					<span>Estado</span>
				</div>
				{#each filtered.slice(0, shown) as station (station.id)}
					<StationRow {station} highlight={bikeQuery ?? (needle || null)} {suspiciousAfterHours} />
				{/each}
			</div>
			{#if filtered.length > shown}
				<div class="mt-4 flex justify-center">
					<Button variant="outline" size="sm" onclick={() => { shown += PAGE_SIZE; }}>
						Mostrar mais ({filtered.length - shown} restantes)
					</Button>
				</div>
			{/if}
		{/if}
	</Card.CardContent>
</Card.Root>
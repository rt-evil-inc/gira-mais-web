<script lang="ts">
	import { getLocalTimeZone } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';
	import { Bike, Lock, MapPin } from '@lucide/svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import StatisticsControls from '$lib/components/StatisticsControls.svelte';
	import SystemStatusChart from '$lib/components/SystemStatusChart.svelte';
	import StationList from '$lib/components/StationList.svelte';
	import SystemMissingList from '$lib/components/SystemMissingList.svelte';
	import { formatHours, stationInService, type StatusSeries, type SystemCurrentState, type SystemKind } from '$lib/gira-system';

	let { interval = $bindable(), groupBy = $bindable(), chartType = $bindable() }: { interval: DateRange; groupBy: string; chartType: string } = $props();

	let history = $state<{ data: Record<SystemKind, StatusSeries[]>; firstSnapshot: string | null } | null>(null);
	let historyLoading = $state(true);
	let historyError = $state<string | null>(null);

	let current = $state<SystemCurrentState | null>(null);
	let currentLoading = $state(true);
	let currentError = $state<string | null>(null);

	$effect(() => {
		if (interval?.start && interval?.end && groupBy) fetchHistory(interval, groupBy);
	});

	$effect(() => {
		fetchCurrent();
	});

	async function fetchHistory(range: DateRange, grouping: string) {
		historyLoading = true;
		historyError = null;
		try {
			const params = new URLSearchParams({
				start: range.start!.toDate(getLocalTimeZone()).toISOString(),
				end: range.end!.add({ days: 1 }).toDate(getLocalTimeZone()).toISOString(),
				groupBy: grouping,
				timezone: getLocalTimeZone(),
			});
			const response = await fetch(`/api/statistics/system?${params}`);
			if (!response.ok) throw new Error('Não foi possível obter o histórico do sistema');
			const result = await response.json();
			history = { data: result.data, firstSnapshot: result.meta.firstSnapshot };
		} catch (err) {
			historyError = err instanceof Error ? err.message : 'Erro desconhecido';
		} finally {
			historyLoading = false;
		}
	}

	async function fetchCurrent() {
		currentLoading = true;
		currentError = null;
		try {
			const response = await fetch('/api/statistics/system/stations');
			if (!response.ok) throw new Error('Não foi possível obter o estado das estações');
			current = await response.json();
		} catch (err) {
			currentError = err instanceof Error ? err.message : 'Erro desconhecido';
		} finally {
			currentLoading = false;
		}
	}

	const totals = $derived(current?.totals);
	const sum = (counts: Record<string, number> | undefined, exclude: string[] = []) => Object.entries(counts ?? {}).reduce((total, [status, count]) => exclude.includes(status) ? total : total + count, 0);
	/** A status's count, with its parts ("unavailable:repair") added up; snapshots leave out statuses at 0. */
	const countOf = (counts: Record<string, number>, status: string) => Object.entries(counts).reduce((total, [key, count]) => key === status || key.startsWith(`${status}:`) ? total + count : total, 0);

	/** Docks that work: free, or holding a bike (the dock registered it). */
	const workingDocks = $derived(totals ? (totals.docks.free ?? 0) + (totals.docks.available_bike ?? 0) + (totals.docks.unavailable_bike ?? 0) : undefined);
	/**
	 * Bikes that work: on a trip, or in a dock and available (or booked). Bikes the system flags unavailable don't
	 * count, even though Gira+ can unlock most of them: the official app hides them.
	 */
	const workingBikes = $derived(totals ? (totals.bikes.available ?? 0) + (totals.bikes.booked ?? 0) + (totals.bikes.in_trip ?? 0) : undefined);
	const stationsInService = $derived(totals ? Object.entries(totals.stations).filter(([status]) => stationInService(status)).reduce((total, [, count]) => total + count, 0) : undefined);
	const plural = (count: number, one: string, many: string) => `${count.toLocaleString('pt-PT')} ${count === 1 ? one : many}`;

	const polledAt = $derived(current?.polledAt ? new Date(current.polledAt).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);
	const missingStations = $derived(current?.stations.filter(station => station.status === 'missing') ?? []);

	const suspiciousAfterHours = $derived(current?.suspiciousAfterHours ?? 7 * 24);
	const idleAfterHours = $derived(current?.idleAfterHours ?? 48);
	/** In service as far as the system says, minus the idle ones: their counts can't be trusted. */
	const stationsWorking = $derived(stationsInService === undefined || !totals ? undefined : stationsInService - countOf(totals.occupancy, 'idle'));

	const charts: { kind: SystemKind; title: string; description: string; unit: string }[] = $derived([
		{
			kind: 'occupancy',
			title: 'Estações',
			description: `Estações com bicicletas disponíveis para levantar e docas livres para entregar; as docas suspeitas não contam como livres. Suspeitas: em serviço, mas sem nenhuma bicicleta a chegar ou a sair há mais de ${formatHours(idleAfterHours)}. Nas indisponíveis não é possível levantar nem entregar bicicletas.`,
			unit: 'estações',
		},
		{
			kind: 'docks',
			title: 'Docas',
			description: `Estado das docas ao longo do tempo. Suspeitas: indicadas como livres pelo sistema, mas sem bicicletas há mais de ${formatHours(suspiciousAfterHours)}.`,
			unit: 'docas',
		},
		{
			kind: 'bikes',
			title: 'Bicicletas',
			description: 'Estado das bicicletas ao longo do tempo. Indisponíveis: nas docas, mas o sistema não as deixa desbloquear. Fora das docas: estacionadas junto a uma estação ou fora de qualquer estação.',
			unit: 'bicicletas',
		},
	]);
</script>

<section id="sistema" class="mt-16 scroll-mt-20">
	<header class="mb-6">
		<h2 class="text-2xl font-bold">Estado do Sistema GIRA</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Estado das estações, docas e bicicletas da GIRA, recolhido do sistema da EMEL a cada 5 minutos{polledAt ? ` (última atualização: ${polledAt})` : ''}.
			Cada período mostra a média das recolhas feitas nele.
		</p>
	</header>

	<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
		<StatCard
			title="Estações em serviço"
			value={stationsWorking}
			total={totals ? sum(totals.stations, ['missing']) : undefined}
			loading={currentLoading}
			error={currentError ?? undefined}
			icon={MapPin}
			description={totals && Object.keys(totals.occupancy).length ? `${plural(countOf(totals.occupancy, 'empty') + countOf(totals.occupancy, 'blocked'), 'vazia', 'vazias')} (sem bicicletas disponíveis) e ${plural(countOf(totals.occupancy, 'full') + countOf(totals.occupancy, 'blocked'), 'cheia', 'cheias')} (sem docas livres)${countOf(totals.occupancy, 'idle') ? `; ${plural(countOf(totals.occupancy, 'idle'), 'suspeita não conta', 'suspeitas não contam')}` : ''}` : undefined}
		/>
		<StatCard
			title="Docas a funcionar"
			value={workingDocks}
			total={totals ? sum(totals.docks, ['missing']) : undefined}
			loading={currentLoading}
			error={currentError ?? undefined}
			icon={Lock}
			description={totals ? `${plural(totals.docks.free ?? 0, 'livre', 'livres')} e ${(totals.docks.available_bike ?? 0) + (totals.docks.unavailable_bike ?? 0)} com bicicleta${totals.docks.suspicious ? `; ${plural(totals.docks.suspicious, 'suspeita não conta', 'suspeitas não contam')}` : ''}` : undefined}
		/>
		<StatCard
			title="Bicicletas a funcionar"
			value={workingBikes}
			total={totals ? sum(totals.bikes, ['missing']) : undefined}
			loading={currentLoading}
			error={currentError ?? undefined}
			icon={Bike}
			description={totals ? `${(totals.bikes.available ?? 0) + (totals.bikes.booked ?? 0)} disponíveis nas docas e ${totals.bikes.in_trip ?? 0} em viagem; não contam ${plural(countOf(totals.bikes, 'unavailable'), 'indisponível', 'indisponíveis')}` : undefined}
		/>
	</div>

	<!-- The page's chart controls again, so the charts below can be changed without scrolling back up. -->
	<div class="mb-4">
		<StatisticsControls bind:interval bind:groupBy bind:chartType />
	</div>

	<div class="flex flex-col gap-4">
		{#each charts as chart (chart.kind)}
			<SystemStatusChart
				kind={chart.kind}
				series={history?.data[chart.kind] ?? []}
				{groupBy}
				{chartType}
				loading={historyLoading}
				error={historyError}
				title={chart.title}
				description={chart.description}
				unit={chart.unit}
			/>
		{/each}

		<StationList stations={current?.stations ?? []} loading={currentLoading} error={currentError} {suspiciousAfterHours} />

		{#if current}
			<SystemMissingList stations={missingStations} bikes={current.missingBikes} since={history?.firstSnapshot ?? null} />
		{/if}
	</div>
</section>
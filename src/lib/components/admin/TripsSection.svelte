<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import Spinner from '$lib/components/Spinner.svelte';
	import TimeSeriesChart, { type ChartSeries } from '$lib/components/admin/TimeSeriesChart.svelte';
	import BarList from '$lib/components/admin/BarList.svelte';
	import { Loader } from '$lib/loader.svelte';
	import { CHART_CARD } from '$lib/charts';
	import { COLORS } from '$lib/gira-system';
	import { formatChange, formatNumber, formatPercent, rangeQuery, RATING_LABELS, type TripsResponse } from '$lib/admin';
	import RatingFace from '$lib/components/RatingFace.svelte';
	import type { DateRange } from 'bits-ui';
	import { mode } from 'mode-watcher';

	let { interval, groupBy, chartType, tick }: { interval: DateRange; groupBy: string; chartType: string; tick: number } = $props();

	const trips = new Loader<TripsResponse>;
	$effect(() => {
		void tick;
		trips.load(`/api/admin/trips?${rangeQuery(interval, groupBy)}`);
	});

	const series = $derived<ChartSeries[]>(trips.data ? [
		{ ...trips.data.series[0], label: 'Viagens', color: COLORS.good },
		{ ...trips.data.series[1], label: 'Utilizadores com viagens', color: COLORS.blue, overlay: true },
	] : []);

	/** Trips over the devices that opened the app in the same bucket; nothing where none did. */
	const perActive = $derived.by(() => {
		if (!trips.data) return null;
		const { series: [tripSeries], activeDevices } = trips.data;
		const active = activeDevices.data.reduce((total, point) => total + point.count, 0);
		return {
			series: [{
				key: 'perActive',
				label: 'Viagens por utilizador ativo',
				color: COLORS.good,
				data: tripSeries.data.map((point, index) => ({ timestamp: point.timestamp, count: activeDevices.data[index].count ? point.count / activeDevices.data[index].count : 0 })),
			}] satisfies ChartSeries[],
			average: active ? tripSeries.data.reduce((total, point) => total + point.count, 0) / active : null,
		};
	});

	const totals = $derived.by(() => {
		if (!trips.data) return null;
		const sum = (index: number) => trips.data!.series[index].data.reduce((total, point) => total + point.count, 0);
		return { trips: sum(0) };
	});

	const stationItems = $derived((trips.data?.stations ?? []).map(station => {
		const change = station.previous ? station.trips / station.previous - 1 : null;
		return {
			key: station.id,
			label: station.name ?? `Estação ${station.id}`,
			value: station.trips,
			detail: change == null ? 'nova' : formatChange(change),
			detailTone: change == null || Math.abs(change) < 0.05 ? 'muted' as const : change > 0 ? 'good' as const : 'bad' as const,
		};
	}));

	const RATING_COLORS = [COLORS.critical, COLORS.serious, COLORS.warning, COLORS.free, COLORS.good];
	const ratings = $derived.by(() => {
		if (!trips.data) return null;
		const summarize = (rows: TripsResponse['ratings']) => {
			const count = rows.reduce((sum, row) => sum + row.count, 0);
			return { count, average: count ? rows.reduce((sum, row) => sum + row.rating * row.count, 0) / count : null };
		};
		const current = summarize(trips.data.ratings);
		return {
			...current,
			previous: summarize(trips.data.previousRatings),
			items: [5, 4, 3, 2, 1].map(rating => {
				const count = trips.data!.ratings.find(row => row.rating === rating)?.count ?? 0;
				return {
					key: String(rating),
					label: RATING_LABELS[rating],
					value: count,
					detail: current.count ? formatPercent(count / current.count, 1) : undefined,
					detailTone: 'muted' as const,
					segments: [{ value: count, color: $mode === 'dark' ? RATING_COLORS[rating - 1].dark : RATING_COLORS[rating - 1].light, label: RATING_LABELS[rating] }],
				};
			}),
		};
	});
</script>

<div class="space-y-10 sm:space-y-4">
	<TimeSeriesChart
		title="Viagens"
		description={totals ? `${formatNumber(totals.trips)} viagens no período, e os dispositivos que as fizeram` : 'Viagens começadas na app, e os dispositivos que as fizeram'}
		{series}
		{groupBy}
		{chartType}
		stacked={false}
		unit="viagens"
		releases
		loading={trips.loading}
		error={trips.error}
	/>

	<TimeSeriesChart
		title="Viagens por utilizador ativo"
		description={`As viagens de cada ${groupBy === 'hour' ? 'hora' : 'dia'} a dividir pelos dispositivos que abriram a app ${groupBy === 'hour' ? 'nessa hora' : 'nesse dia'}${perActive?.average != null ? `: ${formatNumber(perActive.average, 2)} em média no período` : ''}`}
		series={perActive?.series ?? []}
		{groupBy}
		{chartType}
		stacked={false}
		unit="viagens por utilizador"
		decimals={2}
		releases
		loading={trips.loading}
		error={trips.error}
	/>

	<div class="grid grid-cols-1 gap-10 sm:gap-4 lg:grid-cols-2">
		<Card.Root class={CHART_CARD.root}>
			<Card.CardHeader class={CHART_CARD.header}>
				<Card.CardTitle>Estações de partida</Card.CardTitle>
				<Card.CardDescription class="mt-1.5">As estações onde começam mais viagens, e a variação face ao período anterior</Card.CardDescription>
			</Card.CardHeader>
			<Card.CardContent class={CHART_CARD.content}>
				{#if trips.data}
					<BarList items={stationItems} />
				{:else}
					<div class="flex h-40 items-center justify-center">
						{#if trips.error}<p class="text-sm text-destructive">Erro: {trips.error}</p>{:else}<Spinner />{/if}
					</div>
				{/if}
			</Card.CardContent>
		</Card.Root>

		<Card.Root class={CHART_CARD.root}>
			<Card.CardHeader class={CHART_CARD.header}>
				<Card.CardTitle>Avaliações das bicicletas</Card.CardTitle>
				<Card.CardDescription class="mt-1.5">
					{#if ratings?.average != null}
						Média de {formatNumber(ratings.average, 2)} em 5, em {formatNumber(ratings.count)} avaliações{#if ratings.previous.average != null}, contra {formatNumber(ratings.previous.average, 2)} no período anterior{/if}
					{:else}
						Distribuição das avaliações no período
					{/if}
				</Card.CardDescription>
			</Card.CardHeader>
			<Card.CardContent class={CHART_CARD.content}>
				{#if ratings}
					<BarList items={ratings.count ? ratings.items : []}>
						{#snippet leading(item)}
							<RatingFace rating={Number(item.key)} class="h-5 w-5 text-primary" />
						{/snippet}
					</BarList>
				{:else}
					<div class="flex h-40 items-center justify-center">
						{#if trips.error}<p class="text-sm text-destructive">Erro: {trips.error}</p>{:else}<Spinner />{/if}
					</div>
				{/if}
			</Card.CardContent>
		</Card.Root>
	</div>
</div>
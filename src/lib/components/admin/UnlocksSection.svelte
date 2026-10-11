<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Label from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import Spinner from '$lib/components/Spinner.svelte';
	import TimeSeriesChart, { type ChartSeries } from '$lib/components/admin/TimeSeriesChart.svelte';
	import BarList, { type BarListItem } from '$lib/components/admin/BarList.svelte';
	import { Loader } from '$lib/loader.svelte';
	import { CHART_CARD } from '$lib/charts';
	import {
		color,
		formatDuration,
		formatNumber,
		formatPercent,
		HIDDEN_REASONS,
		rangeQuery,
		timeAgo,
		UNLOCK_RESULTS,
		UNLOCK_SOURCES,
		type UnlockResult,
		type UnlocksResponse,
	} from '$lib/admin';
	import { mode } from 'mode-watcher';
	import type { DateRange } from 'bits-ui';

	let { interval, groupBy, chartType, tick }: { interval: DateRange; groupBy: string; chartType: string; tick: number } = $props();

	const unlocks = new Loader<UnlocksResponse>;
	let survey = $state('exclude');
	let showAllRecent = $state(false);
	const RECENT_SHOWN = 8;
	$effect(() => {
		void tick;
		unlocks.load(`/api/admin/unlocks?${rangeQuery(interval, groupBy, { survey })}`);
	});

	const data = $derived(unlocks.data);
	const results = Object.entries(UNLOCK_RESULTS) as [UnlockResult, (typeof UNLOCK_RESULTS)[UnlockResult]][];

	const series = $derived<ChartSeries[]>((data?.series ?? []).map(entry => ({
		...entry,
		label: UNLOCK_RESULTS[entry.key as UnlockResult].label,
		color: UNLOCK_RESULTS[entry.key as UnlockResult],
	})));

	const summary = $derived.by(() => {
		if (!data) return null;
		const total = data.series.reduce((sum, entry) => sum + entry.data.reduce((entrySum, point) => entrySum + point.count, 0), 0);
		const confirmed = data.series.find(entry => entry.key === 'confirmed')?.data.reduce((sum, point) => sum + point.count, 0) ?? 0;
		const accepted = data.series.filter(entry => !['refused', 'network_error'].includes(entry.key)).reduce((sum, entry) => sum + entry.data.reduce((entrySum, point) => entrySum + point.count, 0), 0);
		return { total, confirmed, accepted };
	});

	/** A group's attempts as a bar split by result, with the share that released the bike. */
	function resultItems(groups: UnlocksResponse['bySource'], labels: Record<string, string>): BarListItem[] {
		return groups.map(group => {
			const total = Object.values(group.results).reduce((sum, count) => sum + count, 0);
			const confirmed = group.results.confirmed ?? 0;
			return {
				key: group.key,
				label: labels[group.key] ?? group.key,
				value: total,
				valueLabel: `${formatNumber(total)} tentativas`,
				detail: total ? `${formatPercent(confirmed / total)} desbloqueadas` : undefined,
				detailTone: 'muted',
				segments: results.filter(([result]) => group.results[result]).map(([result, definition]) => ({
					value: group.results[result] ?? 0,
					color: color(definition, $mode === 'dark'),
					label: definition.label,
				})),
			};
		});
	}

	const sourceItems = $derived(data ? resultItems(data.bySource, UNLOCK_SOURCES) : []);
	const reasonItems = $derived(data ? resultItems(data.byReason, HIDDEN_REASONS) : []);
	const stationItems = $derived<BarListItem[]>((data?.stations ?? []).map(station => ({
		key: station.id,
		label: station.name ?? `Estação ${station.id}`,
		value: station.attempts,
		detail: `${formatNumber(station.confirmed)} desbloqueadas`,
		detailTone: 'muted',
	})));

	/** VAIMOO's exception names, split into words ("BikeIsBroken" is "Bike is broken"). */
	function reasonLabel(reason: string | null) {
		if (!reason) return 'Sem motivo indicado';
		const words = reason.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
		return words.charAt(0).toUpperCase() + words.slice(1);
	}
</script>

<div class="space-y-10 sm:space-y-4">
	<div class="flex flex-wrap items-end justify-between gap-4">
		{#if summary}
			<div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
				<div><span class="text-2xl font-bold tabular-nums">{formatNumber(summary.total)}</span> <span class="text-muted-foreground">tentativas</span></div>
				<div><span class="text-2xl font-bold tabular-nums">{summary.total ? formatPercent(summary.confirmed / summary.total) : '-'}</span> <span class="text-muted-foreground">desbloqueadas</span></div>
				<div><span class="text-2xl font-bold tabular-nums">{summary.accepted ? formatPercent(summary.confirmed / summary.accepted) : '-'}</span> <span class="text-muted-foreground">das aceites</span></div>
				{#if data?.elapsed.p50 != null}
					<div title="Do pedido até a bicicleta sair, nos desbloqueios confirmados ({formatNumber(data.elapsed.count)})">
						<span class="text-2xl font-bold tabular-nums">{formatDuration(data.elapsed.p50)}</span>
						<span class="text-muted-foreground">mediana{#if data.elapsed.p90 != null}, {formatDuration(data.elapsed.p90)} no percentil 90{/if}</span>
					</div>
				{/if}
			</div>
		{:else}
			<div></div>
		{/if}
		<div class="flex flex-col gap-1">
			<Label.Root class="text-xs">Versão de levantamento</Label.Root>
			<Tabs.Root bind:value={survey}>
				<Tabs.TabsList class="h-8">
					<Tabs.TabsTrigger value="exclude" class="text-xs px-2">Excluir</Tabs.TabsTrigger>
					<Tabs.TabsTrigger value="include" class="text-xs px-2">Incluir</Tabs.TabsTrigger>
					<Tabs.TabsTrigger value="only" class="text-xs px-2">Só esta</Tabs.TabsTrigger>
				</Tabs.TabsList>
			</Tabs.Root>
		</div>
	</div>

	<TimeSeriesChart
		title="Tentativas de desbloqueio"
		description="Pedidos de desbloqueio feitos na app, pelo resultado"
		{series}
		{groupBy}
		chartType={chartType}
		normalizable
		unit="tentativas"
		releases
		loading={unlocks.loading}
		error={unlocks.error}
	/>

	<div class="grid grid-cols-1 gap-10 sm:gap-4 lg:grid-cols-2">
		<Card.Root class={CHART_CARD.root}>
			<Card.CardHeader class={CHART_CARD.header}>
				<Card.CardTitle>Por origem da bicicleta</Card.CardTitle>
				<Card.CardDescription class="mt-1.5">Como a bicicleta foi escolhida na app</Card.CardDescription>
			</Card.CardHeader>
			<Card.CardContent class={CHART_CARD.content}>
				{#if data}<BarList items={sourceItems} />{:else}<div class="flex h-24 items-center justify-center"><Spinner /></div>{/if}
			</Card.CardContent>
		</Card.Root>

		<Card.Root class={CHART_CARD.root}>
			<Card.CardHeader class={CHART_CARD.header}>
				<Card.CardTitle>Bicicletas escondidas, por motivo</Card.CardTitle>
				<Card.CardDescription class="mt-1.5">Porque é que o sistema indicava a bicicleta como indisponível (uma bicicleta pode ter vários motivos)</Card.CardDescription>
			</Card.CardHeader>
			<Card.CardContent class={CHART_CARD.content}>
				{#if data}<BarList items={reasonItems} />{:else}<div class="flex h-24 items-center justify-center"><Spinner /></div>{/if}
			</Card.CardContent>
		</Card.Root>

		<Card.Root class={CHART_CARD.root}>
			<Card.CardHeader class={CHART_CARD.header}>
				<Card.CardTitle>Recusas da VAIMOO</Card.CardTitle>
				<Card.CardDescription class="mt-1.5">Os motivos dados pela VAIMOO para recusar o desbloqueio</Card.CardDescription>
			</Card.CardHeader>
			<Card.CardContent class={CHART_CARD.content}>
				{#if data}
					<BarList items={data.refusals.map(refusal => ({
						key: `${refusal.code}-${refusal.reason}`,
						label: reasonLabel(refusal.reason),
						sublabel: refusal.code == null ? 'sem código' : `código ${refusal.code}`,
						value: refusal.count,
						detail: `${formatNumber(refusal.bikes)} bicicletas`,
						detailTone: 'muted',
					}))} empty="Nenhuma recusa no período" />
				{:else}
					<div class="flex h-24 items-center justify-center"><Spinner /></div>
				{/if}
			</Card.CardContent>
		</Card.Root>

		<Card.Root class={CHART_CARD.root}>
			<Card.CardHeader class={CHART_CARD.header}>
				<Card.CardTitle>Estações com mais tentativas</Card.CardTitle>
				<Card.CardDescription class="mt-1.5">Onde os utilizadores mais tentam desbloquear bicicletas</Card.CardDescription>
			</Card.CardHeader>
			<Card.CardContent class={CHART_CARD.content}>
				{#if data}<BarList items={stationItems} />{:else}<div class="flex h-24 items-center justify-center"><Spinner /></div>{/if}
			</Card.CardContent>
		</Card.Root>
	</div>

	<Card.Root class={CHART_CARD.root}>
		<Card.CardHeader class={CHART_CARD.header}>
			<Card.CardTitle>Tentativas recentes</Card.CardTitle>
			<Card.CardDescription class="mt-1.5">As últimas tentativas no período selecionado</Card.CardDescription>
		</Card.CardHeader>
		<Card.CardContent class={CHART_CARD.content}>
			{#if !data}
				<div class="flex h-24 items-center justify-center">
					{#if unlocks.error}<p class="text-sm text-destructive">Erro: {unlocks.error}</p>{:else}<Spinner />{/if}
				</div>
			{:else if data.recent.length === 0}
				<p class="py-6 text-center text-sm text-muted-foreground">Nenhuma tentativa no período</p>
			{:else}
				<ul class="divide-y">
					{#each showAllRecent ? data.recent : data.recent.slice(0, RECENT_SHOWN) as attempt (`${attempt.createdAt}-${attempt.bike}`)}
						{@const result = UNLOCK_RESULTS[attempt.result]}
						<li class="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:gap-3">
							<div class="flex items-center gap-2 sm:w-44 sm:shrink-0">
								<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background: {color(result, $mode === 'dark')}"></span>
								<span class="font-medium">{result.label}</span>
								{#if attempt.vaimooCode != null}<span class="text-xs text-muted-foreground">({attempt.vaimooCode})</span>{/if}
							</div>
							<div class="min-w-0 flex-1">
								<span class="font-mono font-medium">{attempt.bike}</span>
								<span class="text-muted-foreground"> · {attempt.stationName ?? (attempt.station ? `Estação ${attempt.station}` : 'Sem estação')}</span>
								<div class="mt-0.5 flex flex-wrap gap-1">
									<Badge variant="outline" class="text-[10px] font-normal">{UNLOCK_SOURCES[attempt.source] ?? attempt.source}</Badge>
									{#each attempt.hiddenReasons ?? [] as reason (reason)}
										<Badge variant="secondary" class="text-[10px] font-normal">{HIDDEN_REASONS[reason] ?? reason}</Badge>
									{/each}
									{#if attempt.survey}<Badge variant="secondary" class="text-[10px] font-normal">Levantamento</Badge>{/if}
								</div>
							</div>
							<div class="shrink-0 text-xs text-muted-foreground sm:text-right" title={new Date(attempt.createdAt).toLocaleString('pt-PT')}>
								{timeAgo(attempt.createdAt)}
								{#if attempt.elapsedMs != null}<span> · {formatDuration(attempt.elapsedMs)}</span>{/if}
							</div>
						</li>
					{/each}
				</ul>
				{#if data.recent.length > RECENT_SHOWN}
					<div class="pt-2 text-center">
						<Button variant="ghost" size="sm" onclick={() => showAllRecent = !showAllRecent}>
							{showAllRecent ? 'Mostrar menos' : `Mostrar as ${data.recent.length} mais recentes`}
						</Button>
					</div>
				{/if}
			{/if}
		</Card.CardContent>
	</Card.Root>
</div>
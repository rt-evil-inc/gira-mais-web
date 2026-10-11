<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Label from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import Spinner from '$lib/components/Spinner.svelte';
	import TimeSeriesChart, { type ChartSeries } from '$lib/components/admin/TimeSeriesChart.svelte';
	import BarList from '$lib/components/admin/BarList.svelte';
	import Heatmap from '$lib/components/admin/Heatmap.svelte';
	import RetentionTable from '$lib/components/admin/RetentionTable.svelte';
	import { Loader } from '$lib/loader.svelte';
	import { CHART_CARD } from '$lib/charts';
	import { COLORS } from '$lib/gira-system';
	import {
		compareVersions,
		formatNumber,
		formatPercent,
		PALETTE,
		PLATFORMS,
		rangeQuery,
		type ActivityResponse,
		type RetentionResponse,
		type UsersResponse,
		type VersionsResponse,
	} from '$lib/admin';
	import type { DateRange } from 'bits-ui';

	let { interval, groupBy, chartType, tick }: { interval: DateRange; groupBy: string; chartType: string; tick: number } = $props();

	const users = new Loader<UsersResponse>;
	const versions = new Loader<VersionsResponse>;
	const activity = new Loader<ActivityResponse>;
	const retention = new Loader<RetentionResponse>;

	let versionWindow = $state(7);
	let versionPlatform = $state('all');
	let versionsNormalized = $state(true);
	let osPlatform = $state('ios');
	let activityKind = $state<'opens' | 'trips'>('opens');

	$effect(() => {
		void tick;
		users.load(`/api/admin/users?${rangeQuery(interval, groupBy)}`);
		activity.load(`/api/admin/activity?${rangeQuery(interval, groupBy)}`);
		retention.load('/api/admin/retention');
	});
	$effect(() => {
		void tick;
		const window = Math.min(Math.max(Math.round(versionWindow) || 7, 1), 90);
		versions.load(`/api/admin/versions?${rangeQuery(interval, groupBy, { window: String(window), platform: versionPlatform === 'all' ? undefined : versionPlatform })}`);
	});

	const platformSeries = $derived<ChartSeries[]>((users.data?.platforms ?? [])
		.toSorted((a, b) => Object.keys(PLATFORMS).indexOf(a.key) - Object.keys(PLATFORMS).indexOf(b.key))
		.map(series => ({ ...series, label: PLATFORMS[series.key]?.label ?? series.key, color: PLATFORMS[series.key] ?? COLORS.gray })));

	const newSeries = $derived<ChartSeries[]>(users.data ? [{ ...users.data.newUsers, label: 'Novos', color: COLORS.blue }] : []);

	/**
	 * The versions that ever reached 2% of the devices get a series each, newest on top; the rest are summed as
	 * "Outras", so the old and the test builds don't crowd the legend.
	 */
	const versionSeries = $derived.by<ChartSeries[]>(() => {
		const series = versions.data?.series ?? [];
		if (!series.length) return [];
		const totals = series[0].data.map((_, index) => series.reduce((sum, entry) => sum + entry.data[index].count, 0));
		const major = (entry: (typeof series)[number]) => entry.data.some((point, index) => totals[index] && point.count / totals[index] >= 0.02);
		const shown = series.filter(major).toSorted((a, b) => compareVersions(a.key, b.key));
		const others = series.filter(entry => !major(entry));
		const result: ChartSeries[] = [];
		if (others.length) {
			result.push({
				key: 'others',
				label: 'Outras',
				color: COLORS.gray,
				data: series[0].data.map((point, index) => ({ timestamp: point.timestamp, count: others.reduce((sum, entry) => sum + entry.data[index].count, 0) })),
			});
		}
		shown.forEach((entry, index) => result.push({ ...entry, label: `v${entry.key}`, color: PALETTE[(shown.length - 1 - index) % PALETTE.length] }));
		return result;
	});

	const osItems = $derived.by(() => {
		const entries = (users.data?.osVersions ?? []).filter(entry => entry.os === osPlatform);
		const total = entries.reduce((sum, entry) => sum + entry.devices, 0);
		return entries.slice(0, 12).map(entry => ({
			key: entry.version,
			label: `${PLATFORMS[osPlatform]?.label ?? osPlatform} ${entry.version}`,
			value: entry.devices,
			detail: total ? formatPercent(entry.devices / total, 1) : undefined,
			detailTone: 'muted' as const,
		}));
	});

	const peak = $derived.by(() => {
		const grid = activity.data?.[activityKind];
		if (!grid) return null;
		let best = { weekday: 0, hour: 0, value: -1 };
		grid.forEach((hours, weekday) => hours.forEach((value, hour) => {
			if (value > best.value) best = { weekday, hour, value };
		}));
		return best;
	});
	const WEEKDAY_NAMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
</script>

<div class="space-y-10 sm:space-y-4">
	<TimeSeriesChart
		title="Utilizadores ativos"
		description="Dispositivos que abriram a app, por plataforma"
		series={platformSeries}
		{groupBy}
		{chartType}
		normalizable
		unit="utilizadores"
		loading={users.loading}
		error={users.error}
	/>

	<TimeSeriesChart
		title="Versões da app"
		description="Dispositivos vistos na janela até cada {groupBy === 'hour' ? 'hora' : 'dia'}, pela versão mais recente que usaram"
		series={versionSeries}
		{groupBy}
		chartType="area"
		normalizable
		bind:normalized={versionsNormalized}
		unit="dispositivos"
		releases
		loading={versions.loading}
		error={versions.error}
	>
		{#snippet controls()}
			<div class="flex flex-col gap-1">
				<Label.Root class="text-xs" for="version-window">Janela (dias)</Label.Root>
				<Input id="version-window" type="number" min="1" max="90" bind:value={versionWindow} class="h-8 w-16 text-xs" />
			</div>
			<div class="flex flex-col gap-1">
				<Label.Root class="text-xs">Plataforma</Label.Root>
				<Tabs.Root bind:value={versionPlatform}>
					<Tabs.TabsList class="h-8">
						<Tabs.TabsTrigger value="all" class="text-xs px-2">Todas</Tabs.TabsTrigger>
						<Tabs.TabsTrigger value="ios" class="text-xs px-2">iOS</Tabs.TabsTrigger>
						<Tabs.TabsTrigger value="android" class="text-xs px-2">Android</Tabs.TabsTrigger>
					</Tabs.TabsList>
				</Tabs.Root>
			</div>
		{/snippet}
	</TimeSeriesChart>

	<div class="grid grid-cols-1 gap-10 sm:gap-4 lg:grid-cols-2">
		<TimeSeriesChart
			title="Novos utilizadores"
			description="Dispositivos vistos pela primeira vez"
			series={newSeries}
			{groupBy}
			chartType="bar"
			unit="dispositivos"
			loading={users.loading}
			error={users.error}
		/>

		<Card.Root class={CHART_CARD.root}>
			<Card.CardHeader class={CHART_CARD.header}>
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<Card.CardTitle>Sistemas operativos</Card.CardTitle>
						<Card.CardDescription class="mt-1.5">Dispositivos ativos no período, por versão do sistema</Card.CardDescription>
					</div>
					<Tabs.Root bind:value={osPlatform}>
						<Tabs.TabsList class="h-8">
							<Tabs.TabsTrigger value="ios" class="text-xs px-2">iOS</Tabs.TabsTrigger>
							<Tabs.TabsTrigger value="android" class="text-xs px-2">Android</Tabs.TabsTrigger>
						</Tabs.TabsList>
					</Tabs.Root>
				</div>
			</Card.CardHeader>
			<Card.CardContent class={CHART_CARD.content}>
				{#if !users.data}
					<div class="flex h-40 items-center justify-center">
						{#if users.error}<p class="text-sm text-destructive">Erro: {users.error}</p>{:else}<Spinner />{/if}
					</div>
				{:else}
					<BarList items={osItems} />
				{/if}
			</Card.CardContent>
		</Card.Root>
	</div>

	<Card.Root class={CHART_CARD.root}>
		<Card.CardHeader class={CHART_CARD.header}>
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<Card.CardTitle>Atividade ao longo da semana</Card.CardTitle>
					<Card.CardDescription class="mt-1.5">
						Média por hora no período selecionado{#if peak && peak.value > 0}; o pico é {WEEKDAY_NAMES[peak.weekday]} às {peak.hour}h, com {formatNumber(peak.value, 0)}{/if}
					</Card.CardDescription>
				</div>
				<Tabs.Root value={activityKind} onValueChange={value => activityKind = value as 'opens' | 'trips'}>
					<Tabs.TabsList class="h-8">
						<Tabs.TabsTrigger value="opens" class="text-xs px-2">Aberturas da app</Tabs.TabsTrigger>
						<Tabs.TabsTrigger value="trips" class="text-xs px-2">Viagens</Tabs.TabsTrigger>
					</Tabs.TabsList>
				</Tabs.Root>
			</div>
		</Card.CardHeader>
		<Card.CardContent class={CHART_CARD.content}>
			{#if activity.data}
				<Heatmap grid={activity.data[activityKind]} unit={activityKind === 'opens' ? 'aberturas' : 'viagens'} />
			{:else}
				<div class="flex h-40 items-center justify-center">
					{#if activity.error}<p class="text-sm text-destructive">Erro: {activity.error}</p>{:else}<Spinner />{/if}
				</div>
			{/if}
		</Card.CardContent>
	</Card.Root>

	<Card.Root class={CHART_CARD.root}>
		<Card.CardHeader class={CHART_CARD.header}>
			<Card.CardTitle>Retenção semanal</Card.CardTitle>
			<Card.CardDescription class="mt-1.5">
				Dos dispositivos vistos pela primeira vez em cada semana, quantos voltaram a abrir a app nas semanas seguintes (a última coluna de cada linha é a semana em curso)
			</Card.CardDescription>
		</Card.CardHeader>
		<Card.CardContent class={CHART_CARD.content}>
			{#if retention.data}
				<RetentionTable cohorts={retention.data.cohorts} />
			{:else}
				<div class="flex h-40 items-center justify-center">
					{#if retention.error}<p class="text-sm text-destructive">Erro: {retention.error}</p>{:else}<Spinner />{/if}
				</div>
			{/if}
		</Card.CardContent>
	</Card.Root>
</div>
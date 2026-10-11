<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Popover from '$lib/components/ui/popover';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import Spinner from '$lib/components/Spinner.svelte';
	import TimeSeriesChart, { type ChartSeries } from '$lib/components/admin/TimeSeriesChart.svelte';
	import BarList, { type BarListItem } from '$lib/components/admin/BarList.svelte';
	import ErrorList from '$lib/components/admin/ErrorList.svelte';
	import { Loader } from '$lib/loader.svelte';
	import { CHART_CARD } from '$lib/charts';
	import { COLORS } from '$lib/gira-system';
	import { color, compareVersions, formatChange, formatNumber, formatPercent, OTHER_ERRORS, PALETTE, rangeQuery, timeAgo, type ErrorsResponse } from '$lib/admin';
	import { ChevronDown, ChevronRight, Search, Smartphone, X } from '@lucide/svelte';
	import { mode } from 'mode-watcher';
	import { browser } from '$app/environment';
	import type { DateRange } from 'bits-ui';

	let { interval, groupBy, chartType, tick }: { interval: DateRange; groupBy: string; chartType: string; tick: number } = $props();

	interface Filters {
		/** Codes left out; new codes show up on their own. */
		hiddenCodes: string[];
		/** Versions kept; all of them when empty. */
		versions: string[];
		device: string;
		search: string;
	}

	const STORAGE_KEY = 'admin-error-filters';
	const EMPTY: Filters = { hiddenCodes: [], versions: [], device: '', search: '' };
	function storedFilters(): Filters {
		if (!browser) return EMPTY;
		try {
			return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
		} catch {
			return EMPTY;
		}
	}

	// The filters outlive refreshes and visits: they're only changed by the user.
	const initialFilters = storedFilters();
	let filters = $state<Filters>(initialFilters);
	let searchInput = $state(initialFilters.search);
	$effect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
	});
	$effect(() => {
		const value = searchInput.trim();
		const timeout = setTimeout(() => filters.search = value, 350);
		return () => clearTimeout(timeout);
	});

	const filterParams = $derived({
		excludeCodes: filters.hiddenCodes,
		versions: filters.versions,
		device: filters.device || undefined,
		q: filters.search || undefined,
	});
	const query = $derived(rangeQuery(interval, groupBy, filterParams));

	const errors = new Loader<ErrorsResponse>;
	$effect(() => {
		void tick;
		errors.load(`/api/admin/errors?${query}`);
	});
	const data = $derived(errors.data);

	/** Each charted code keeps its colour in the chart and the lists, by its rank in the range. */
	const codeColors = $derived.by(() => {
		const colors = new Map<string, { light: string; dark: string }>;
		(data?.series ?? []).forEach((series, index) => colors.set(series.key, series.key === OTHER_ERRORS ? COLORS.gray : PALETTE[index % PALETTE.length]));
		return colors;
	});

	const series = $derived<ChartSeries[]>((data?.series ?? []).map(entry => ({
		...entry,
		label: entry.key === OTHER_ERRORS ? 'Outros' : entry.key,
		color: codeColors.get(entry.key) ?? COLORS.gray,
	})));

	const hasFilters = $derived(filters.hiddenCodes.length > 0 || filters.versions.length > 0 || !!filters.device || !!filters.search);

	function toggle(list: string[], value: string) {
		return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
	}

	/** Show only this code, or every code again if it's the only one showing. */
	function focusCode(code: string) {
		const all = data?.codes.map(entry => entry.code) ?? [];
		const alone = all.every(other => other === code ? !filters.hiddenCodes.includes(other) : filters.hiddenCodes.includes(other));
		filters.hiddenCodes = alone ? [] : all.filter(other => other !== code);
	}

	const visibleCodes = $derived((data?.codes ?? []).filter(entry => !filters.hiddenCodes.includes(entry.code)).map(entry => entry.code));

	const codeItems = $derived<BarListItem[]>((data?.codes ?? []).filter(entry => !filters.hiddenCodes.includes(entry.code)).map(entry => {
		const change = entry.previousDevices ? entry.devices / entry.previousDevices - 1 : null;
		return {
			key: entry.code,
			label: entry.code,
			sublabel: `${formatNumber(entry.devices)} dispositivos${data?.activeDevices ? ` (${formatPercent(entry.devices / data.activeDevices, 1)} dos ativos)` : ''} · último ${timeAgo(entry.lastSeen)}`,
			value: entry.count,
			detail: change == null ? 'novo' : `${formatChange(change)} disp.`,
			detailTone: change == null ? 'bad' : Math.abs(change) < 0.1 ? 'muted' : change > 0 ? 'bad' : 'good',
			segments: [{ value: entry.count, color: color(codeColors.get(entry.code) ?? codeColors.get(OTHER_ERRORS) ?? COLORS.gray, $mode === 'dark'), label: entry.code }],
		};
	}));

	const versionItems = $derived<BarListItem[]>((data?.versions ?? [])
		.toSorted((a, b) => compareVersions(b.version, a.version))
		.map(entry => {
			const rate = entry.activeDevices ? Math.min(entry.devices / entry.activeDevices, 1) : null;
			return {
				key: entry.version,
				label: entry.version === '?' ? 'Versão desconhecida' : `v${entry.version}`,
				sublabel: `${formatNumber(entry.count)} erros · ${formatNumber(entry.devices)} de ${formatNumber(entry.activeDevices)} dispositivos`,
				value: rate ?? 0,
				valueLabel: rate == null ? '-' : formatPercent(rate, 1),
				detail: 'com erros',
				detailTone: 'muted',
			};
		}));

	let expandedSignature = $state<string | null>(null);

	function pretty(message: string | null) {
		if (!message) return '';
		try {
			return JSON.stringify(JSON.parse(message), null, 2);
		} catch {
			return message;
		}
	}
</script>

<div class="space-y-10 sm:space-y-4">
	<!-- Filters -->
	<div class="flex flex-col gap-3 rounded-lg sm:border sm:bg-muted/30 sm:p-4">
		<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
			<div class="relative sm:w-72">
				<Search class="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input bind:value={searchInput} placeholder="Procurar na mensagem ou dispositivo" class="h-9 pl-8" />
			</div>
			<div class="grid grid-cols-2 gap-2 sm:flex">
				<Popover.Root>
					<Popover.PopoverTrigger class={buttonVariants({ variant: 'outline', size: 'sm', class: 'justify-between' })}>
						{#if !filters.hiddenCodes.length}Todos os códigos{:else}{formatNumber(visibleCodes.length)} de {formatNumber(data?.codes.length ?? 0)} códigos{/if}
						<ChevronDown class="h-4 w-4" />
					</Popover.PopoverTrigger>
					<Popover.PopoverContent class="w-80 p-3" align="start">
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm font-medium">Códigos de erro</span>
							<div class="flex gap-1">
								<Button variant="ghost" size="sm" class="h-7 px-2 text-xs" onclick={() => filters.hiddenCodes = []}>Todos</Button>
								<Button variant="ghost" size="sm" class="h-7 px-2 text-xs" onclick={() => filters.hiddenCodes = data?.codes.map(entry => entry.code) ?? []}>Nenhum</Button>
							</div>
						</div>
						<div class="max-h-72 space-y-1 overflow-y-auto">
							{#each data?.codes ?? [] as entry (entry.code)}
								<label class="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
									<Checkbox checked={!filters.hiddenCodes.includes(entry.code)} onCheckedChange={() => filters.hiddenCodes = toggle(filters.hiddenCodes, entry.code)} />
									<span class="min-w-0 flex-1 truncate">{entry.code}</span>
									<span class="text-xs tabular-nums text-muted-foreground">{formatNumber(entry.count)}</span>
								</label>
							{:else}
								<p class="text-sm text-muted-foreground">Nenhum erro no período</p>
							{/each}
						</div>
					</Popover.PopoverContent>
				</Popover.Root>

				<Popover.Root>
					<Popover.PopoverTrigger class={buttonVariants({ variant: 'outline', size: 'sm', class: 'justify-between' })}>
						{#if !filters.versions.length}Todas as versões{:else if filters.versions.length === 1}v{filters.versions[0]}{:else}{filters.versions.length} versões{/if}
						<ChevronDown class="h-4 w-4" />
					</Popover.PopoverTrigger>
					<Popover.PopoverContent class="w-64 p-3" align="start">
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm font-medium">Versões da app</span>
							{#if filters.versions.length}
								<Button variant="ghost" size="sm" class="h-7 px-2 text-xs" onclick={() => filters.versions = []}>Todas</Button>
							{/if}
						</div>
						<div class="max-h-72 space-y-1 overflow-y-auto">
							{#each (data?.versions ?? []).toSorted((a, b) => compareVersions(b.version, a.version)) as entry (entry.version)}
								<label class="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
									<Checkbox checked={filters.versions.includes(entry.version)} onCheckedChange={() => filters.versions = toggle(filters.versions, entry.version)} />
									<span class="min-w-0 flex-1 truncate">{entry.version === '?' ? 'Desconhecida' : `v${entry.version}`}</span>
									<span class="text-xs tabular-nums text-muted-foreground">{formatNumber(entry.count)}</span>
								</label>
							{/each}
						</div>
					</Popover.PopoverContent>
				</Popover.Root>
			</div>
			{#if hasFilters}
				<Button variant="ghost" size="sm" class="self-start sm:self-auto" onclick={() => { filters = { ...EMPTY }; searchInput = ''; }}>
					<X class="h-4 w-4" />
					Limpar filtros
				</Button>
			{/if}
		</div>
		{#if hasFilters}
			<div class="flex flex-wrap gap-1">
				{#if filters.device}
					<Badge variant="secondary" class="gap-1 font-normal">
						<Smartphone class="h-3 w-3" /><span class="max-w-40 truncate font-mono">{filters.device}</span>
						<button type="button" aria-label="Remover filtro" onclick={() => filters.device = ''}><X class="h-3 w-3" /></button>
					</Badge>
				{/if}
				{#each filters.hiddenCodes.length <= 5 ? filters.hiddenCodes : [] as code (code)}
					<Badge variant="secondary" class="gap-1 font-normal line-through decoration-muted-foreground">
						{code}
						<button type="button" aria-label="Mostrar {code}" onclick={() => filters.hiddenCodes = toggle(filters.hiddenCodes, code)}><X class="h-3 w-3" /></button>
					</Badge>
				{/each}
				{#if filters.hiddenCodes.length > 5}
					<Badge variant="secondary" class="gap-1 font-normal">
						só {visibleCodes.join(', ') || 'nenhum código'}
						<button type="button" aria-label="Mostrar todos os códigos" onclick={() => filters.hiddenCodes = []}><X class="h-3 w-3" /></button>
					</Badge>
				{/if}
				{#each filters.versions as version (version)}
					<Badge variant="secondary" class="gap-1 font-normal">
						v{version}
						<button type="button" aria-label="Remover v{version}" onclick={() => filters.versions = toggle(filters.versions, version)}><X class="h-3 w-3" /></button>
					</Badge>
				{/each}
			</div>
		{/if}
		{#if data}
			<p class="text-sm text-muted-foreground">
				<span class="font-semibold text-foreground">{formatNumber(data.total.count)}</span> erros de
				<span class="font-semibold text-foreground">{formatNumber(data.total.devices)}</span> dispositivos{#if data.activeDevices}, {formatPercent(data.total.devices / data.activeDevices, 1)} dos {formatNumber(data.activeDevices)} ativos no período{/if}
			</p>
		{/if}
	</div>

	<TimeSeriesChart
		title="Erros"
		description="Erros reportados pela app, pelos códigos mais frequentes"
		{series}
		{groupBy}
		{chartType}
		normalizable
		unit="erros"
		releases
		loading={errors.loading}
		error={errors.error}
	/>

	<div class="grid grid-cols-1 gap-10 sm:gap-4 lg:grid-cols-2">
		<Card.Root class={CHART_CARD.root}>
			<Card.CardHeader class={CHART_CARD.header}>
				<Card.CardTitle>Códigos de erro</Card.CardTitle>
				<Card.CardDescription class="mt-1.5">A variação é a dos dispositivos afetados face ao período anterior. Toque num código para ver só esse.</Card.CardDescription>
			</Card.CardHeader>
			<Card.CardContent class={CHART_CARD.content}>
				{#if data}
					<BarList items={codeItems} onselect={focusCode} empty="Nenhum erro no período" />
				{:else}
					<div class="flex h-24 items-center justify-center">{#if errors.error}<p class="text-sm text-destructive">Erro: {errors.error}</p>{:else}<Spinner />{/if}</div>
				{/if}
			</Card.CardContent>
		</Card.Root>

		<Card.Root class={CHART_CARD.root}>
			<Card.CardHeader class={CHART_CARD.header}>
				<Card.CardTitle>Por versão da app</Card.CardTitle>
				<Card.CardDescription class="mt-1.5">Parte dos dispositivos ativos em cada versão que reportaram erros. Toque numa versão para a filtrar.</Card.CardDescription>
			</Card.CardHeader>
			<Card.CardContent class={CHART_CARD.content}>
				{#if data}
					<BarList items={versionItems} max={1} selected={filters.versions} onselect={version => filters.versions = toggle(filters.versions, version)} empty="Nenhum erro no período" />
				{:else}
					<div class="flex h-24 items-center justify-center"><Spinner /></div>
				{/if}
			</Card.CardContent>
		</Card.Root>
	</div>

	<Card.Root class={CHART_CARD.root}>
		<Card.CardHeader class={CHART_CARD.header}>
			<Card.CardTitle>Mensagens mais frequentes</Card.CardTitle>
			<Card.CardDescription class="mt-1.5">Erros agrupados pelo que dizem, sem a bicicleta, estação ou avaliação de cada um</Card.CardDescription>
		</Card.CardHeader>
		<Card.CardContent class={CHART_CARD.content}>
			{#if !data}
				<div class="flex h-24 items-center justify-center"><Spinner /></div>
			{:else if data.signatures.length === 0}
				<p class="py-6 text-center text-sm text-muted-foreground">Nenhum erro no período</p>
			{:else}
				<ul class="divide-y">
					{#each data.signatures as signature (`${signature.code}:${signature.signature}`)}
						{@const key = `${signature.code}:${signature.signature}`}
						<li>
							<button type="button" class="flex w-full items-start gap-2 py-2 text-left text-sm hover:bg-muted/40" onclick={() => expandedSignature = expandedSignature === key ? null : key}>
								{#if expandedSignature === key}<ChevronDown class="mt-0.5 h-4 w-4 shrink-0" />{:else}<ChevronRight class="mt-0.5 h-4 w-4 shrink-0" />{/if}
								<div class="min-w-0 flex-1">
									<p class="break-words {expandedSignature === key ? '' : 'line-clamp-2'}">{signature.signature}</p>
									<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
										<Badge variant="outline" class="text-[10px] font-normal">{signature.code}</Badge>
										<span>{formatNumber(signature.devices)} dispositivos</span>
										<span>último {timeAgo(signature.lastSeen)}</span>
									</div>
								</div>
								<span class="shrink-0 font-medium tabular-nums">{formatNumber(signature.count)}</span>
							</button>
							{#if expandedSignature === key && signature.example}
								<pre class="mb-2 ml-6 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">{pretty(signature.example)}</pre>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</Card.CardContent>
	</Card.Root>

	<ErrorList {query} {tick} onDevice={device => filters.device = device} />
</div>
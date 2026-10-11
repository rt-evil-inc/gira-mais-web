<script lang="ts" module>
	import type { CountSeries } from '$lib/admin';

	export interface ChartSeries extends CountSeries {
		label: string;
		color: { light: string; dark: string };
		/** Drawn as a line over the others rather than stacked with them. */
		overlay?: boolean;
	}
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { Chart, type ChartDataset } from 'chart.js/auto';
	import annotationPlugin from 'chartjs-plugin-annotation';
	import 'chartjs-adapter-date-fns';
	import { mode } from 'mode-watcher';
	import * as Card from '$lib/components/ui/card';
	import * as Label from '$lib/components/ui/label';
	import * as Tabs from '$lib/components/ui/tabs';
	import Spinner from '$lib/components/Spinner.svelte';
	import { CHART_CARD, NARROW_CHART_WIDTH, NARROW_LEGEND_LABELS } from '$lib/charts';
	import { color, formatNumber, formatPercent } from '$lib/admin';
	import { getReleases } from '$lib/releases';

	Chart.register(annotationPlugin);

	interface Props {
		title: string;
		description?: string;
		series: ChartSeries[];
		groupBy: string;
		/** 'area' or 'bar'. */
		chartType?: string;
		/** Stack the series that aren't overlays. */
		stacked?: boolean;
		/** Offer to show each series as a share of the stack. */
		normalizable?: boolean;
		normalized?: boolean;
		loading?: boolean;
		error?: string | null;
		/** What is counted ("utilizadores"), for the axis and the tooltip's total. */
		unit: string;
		/** Mark the app's releases. */
		releases?: boolean;
		/** Extra controls in the card's header. */
		controls?: Snippet;
	}

	let {
		title,
		description,
		series,
		groupBy,
		chartType = 'area',
		stacked = true,
		normalizable = false,
		normalized = $bindable(false),
		loading = false,
		error = null,
		unit,
		releases = false,
		controls,
	}: Props = $props();

	type Point = { x: number; y: number };
	let chart: Chart<'bar' | 'line', Point[]> | null = null;
	let canvas = $state<HTMLCanvasElement | null>(null);
	let width = $state(0);
	const narrow = $derived(width > 0 && width < NARROW_CHART_WIDTH);
	/** Series hidden from the legend, kept by key so they stay hidden when the data refreshes. */
	let hidden = $state<string[]>([]);
	let releaseList = $state<{ tag_name: string; published_at: string }[]>([]);
	const hasData = $derived(series.some(entry => entry.data.some(point => point.count > 0)));

	onMount(() => {
		if (releases) getReleases().then(list => releaseList = list);
		return () => chart?.destroy();
	});

	$effect(() => {
		void [series, groupBy, chartType, normalized, narrow, hidden, releaseList, $mode];
		if (canvas && hasData) draw(canvas);
	});

	const HOUR = 3_600_000;
	function bucketEnd(start: number) {
		if (groupBy === 'hour') return start + HOUR;
		const date = new Date(start);
		date.setDate(date.getDate() + 1);
		return date.getTime();
	}

	function formatBucket(start: number, long: boolean) {
		const date = new Date(start);
		if (groupBy === 'hour') {
			const hours = `${date.toLocaleString('pt-PT', { hour: 'numeric', minute: '2-digit' })} - ${new Date(start + HOUR).toLocaleString('pt-PT', { hour: 'numeric', minute: '2-digit' })}`;
			return long ? `${date.toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}, ${hours}` : hours;
		}
		return date.toLocaleString('pt-PT', long ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
	}

	function draw(target: HTMLCanvasElement) {
		const dark = $mode === 'dark';
		const style = getComputedStyle(document.body);
		const surface = `hsl(${style.getPropertyValue('--card')})`;
		const area = chartType === 'area';
		const now = Date.now();
		const stackedSeries = series.filter(entry => !entry.overlay && !hidden.includes(entry.key));
		const totals = series[0]?.data.map((_, index) => stackedSeries.reduce((sum, entry) => sum + entry.data[index].count, 0)) ?? [];
		const share = normalizable && normalized;

		const datasets = series.map((entry, index): ChartDataset<'bar' | 'line', Point[]> => {
			const hex = color(entry.color, dark);
			const data = entry.data.map((point, pointIndex) => ({
				x: new Date(point.timestamp).getTime(),
				y: share && !entry.overlay ? totals[pointIndex] ? point.count / totals[pointIndex] : 0 : point.count,
			}));
			// The bucket still under way is drawn dashed or faded: its count is going to grow.
			const ongoing = (pointIndex: number) => data[pointIndex] && bucketEnd(data[pointIndex].x) > now;
			const common = { label: entry.label, data, hidden: hidden.includes(entry.key) };
			if (entry.overlay) {
				return {
					...common,
					type: 'line',
					borderColor: hex,
					backgroundColor: hex,
					borderWidth: 2,
					pointRadius: 0,
					pointHoverRadius: 4,
					cubicInterpolationMode: 'monotone',
					segment: { borderDash: context => ongoing(context.p1DataIndex) ? [4, 4] : undefined },
					order: -1,
				};
			}
			if (area) {
				return {
					...common,
					type: 'line',
					backgroundColor: stacked ? `${hex}bf` : `${hex}40`,
					borderColor: hex,
					borderWidth: stacked ? 1.5 : 2,
					fill: stacked ? index === 0 ? 'origin' : '-1' : 'origin',
					cubicInterpolationMode: 'monotone',
					pointRadius: data.length <= 2 ? 3 : 0,
					pointBackgroundColor: hex,
					pointHoverRadius: 4,
					stack: stacked ? 'stack' : undefined,
					segment: { borderDash: context => ongoing(context.p1DataIndex) ? [4, 4] : undefined },
				};
			}
			return {
				...common,
				type: 'bar',
				backgroundColor: data.map((_, pointIndex) => ongoing(pointIndex) ? `${hex}80` : hex),
				hoverBackgroundColor: hex,
				borderColor: surface,
				borderWidth: stacked ? { top: 1 } : 0,
				borderSkipped: 'bottom',
				borderRadius: 2,
				stack: stacked ? 'stack' : `${index}`,
			};
		});

		const annotations = releaseList
			.map(release => new Date(release.published_at).getTime())
			.map((time, index) => ({ time, tag: releaseList[index].tag_name }))
			.filter(({ time }) => series[0]?.data.length && time >= new Date(series[0].data[0].timestamp).getTime() && time <= now)
			.map(({ time, tag }) => ({
				type: 'line' as const,
				scaleID: 'x',
				value: time,
				borderColor: `hsl(${style.getPropertyValue('--muted-foreground')} / 0.6)`,
				borderWidth: 1,
				borderDash: [3, 3],
				label: {
					display: true,
					content: tag,
					position: 'start' as const,
					backgroundColor: `hsl(${style.getPropertyValue('--secondary-foreground')})`,
					color: `hsl(${style.getPropertyValue('--secondary')})`,
					font: { family: 'Inter', size: narrow ? 9 : 11, weight: 'bold' as const },
					padding: narrow ? 2 : 3,
				},
			}));

		Chart.defaults.borderColor = `hsl(${style.getPropertyValue('--border')})`;
		Chart.defaults.color = `hsl(${style.getPropertyValue('--muted-foreground')})`;
		chart?.destroy();
		chart = new Chart<'bar' | 'line', Point[]>(target, {
			type: area ? 'line' : 'bar',
			data: { datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: {
						display: series.length > 1,
						position: 'top',
						labels: {
							font: { family: 'Inter' },
							usePointStyle: true,
							pointStyle: 'rectRounded',
							padding: 16,
							...narrow ? NARROW_LEGEND_LABELS : {},
						},
						onClick: (_, item) => {
							const key = series[item.datasetIndex ?? -1]?.key;
							if (key) hidden = hidden.includes(key) ? hidden.filter(other => other !== key) : [...hidden, key];
						},
					},
					tooltip: {
						itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
						filter: item => item.parsed.y != null && item.parsed.y > 0,
						bodyFont: { family: 'Inter' },
						titleFont: { family: 'Inter', weight: 'bold' },
						footerFont: { family: 'Inter', weight: 'normal' },
						callbacks: {
							title: items => items.length ? formatBucket(items[0].parsed.x, true) + (bucketEnd(items[0].parsed.x) > now ? ' (em curso)' : '') : '',
							label: context => {
								const value = context.parsed.y ?? 0;
								const entry = series[context.datasetIndex];
								if (share && !entry.overlay) {
									const count = entry.data[context.dataIndex].count;
									return ` ${entry.label}: ${formatPercent(value, 1)} (${formatNumber(count)})`;
								}
								const total = totals[context.dataIndex];
								const part = stacked && !entry.overlay && stackedSeries.length > 1 && total ? ` (${formatPercent(value / total, 1)})` : '';
								return ` ${entry.label}: ${formatNumber(value, value < 10 ? 1 : 0)}${part}`;
							},
							footer: items => {
								if (!stacked || stackedSeries.length < 2 || !items.length) return '';
								return `Total: ${formatNumber(totals[items[0].dataIndex])} ${unit}`;
							},
						},
					},
					annotation: { annotations },
				},
				scales: {
					x: {
						type: 'time',
						stacked: stacked && !area,
						offset: !area,
						time: { unit: groupBy === 'hour' ? 'hour' : 'day' },
						grid: { display: false },
						ticks: {
							font: { family: 'Inter' },
							maxRotation: narrow ? 0 : 50,
							autoSkipPadding: narrow ? 12 : 3,
							callback: value => {
								const date = new Date(Number(value));
								// Hourly ticks name the day at midnight, so a range of several days can be told apart.
								if (groupBy === 'hour' && date.getHours() !== 0) return date.toLocaleString('pt-PT', { hour: 'numeric', minute: '2-digit' });
								return date.toLocaleString('pt-PT', { day: 'numeric', month: 'short' });
							},
						},
					},
					y: {
						stacked,
						beginAtZero: true,
						max: share ? 1 : undefined,
						ticks: {
							precision: 0,
							font: { family: 'Inter' },
							callback: value => share ? formatPercent(Number(value)) : formatNumber(Number(value)),
						},
						title: { display: !narrow, text: share ? `Proporção de ${unit}` : `Número de ${unit}`, font: { family: 'Inter' } },
					},
				},
			},
		});
	}
</script>

<Card.Root class="h-full {CHART_CARD.root}">
	<Card.CardHeader class={CHART_CARD.header}>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="min-w-0 flex-1">
				<Card.CardTitle>{title}</Card.CardTitle>
				{#if description}
					<Card.CardDescription class="mt-1.5">{description}</Card.CardDescription>
				{/if}
			</div>
			{#if controls || normalizable}
				<div class="flex flex-wrap items-end gap-4">
					{@render controls?.()}
					{#if normalizable}
						<div class="flex flex-col gap-1">
							<Label.Root class="text-xs">Visualização</Label.Root>
							<Tabs.Root value={normalized ? 'normalized' : 'absolute'} onValueChange={value => { normalized = value === 'normalized'; }}>
								<Tabs.TabsList class="h-8">
									<Tabs.TabsTrigger value="absolute" class="text-xs px-2">Absoluto</Tabs.TabsTrigger>
									<Tabs.TabsTrigger value="normalized" class="text-xs px-2">Proporção</Tabs.TabsTrigger>
								</Tabs.TabsList>
							</Tabs.Root>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</Card.CardHeader>

	<Card.CardContent class={CHART_CARD.content}>
		<div class="h-64 sm:h-80 relative" bind:clientWidth={width}>
			{#if loading && !hasData}
				<div class="absolute inset-0 flex items-center justify-center">
					<Spinner />
				</div>
			{:else if error && !hasData}
				<div class="absolute inset-0 flex items-center justify-center">
					<p class="text-destructive text-sm">Erro: {error}</p>
				</div>
			{:else if !hasData}
				<div class="absolute inset-0 flex items-center justify-center">
					<p class="text-muted-foreground text-sm">Sem dados para o período selecionado</p>
				</div>
			{:else}
				<canvas bind:this={canvas} class="transition-opacity {loading ? 'opacity-40' : ''}"></canvas>
				{#if loading}
					<div class="absolute inset-0 flex items-center justify-center">
						<Spinner />
					</div>
				{/if}
			{/if}
		</div>
	</Card.CardContent>
</Card.Root>
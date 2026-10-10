<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, type ChartDataset } from 'chart.js/auto';
	import * as Card from '$lib/components/ui/card';
	import * as Label from '$lib/components/ui/label';
	import * as Tabs from '$lib/components/ui/tabs';
	import { TimeScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend } from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import { mode } from 'mode-watcher';
	import Spinner from '$lib/components/Spinner.svelte';
	import { partLabel, statusColor, statusLabel, type StatusSeries, type SystemKind } from '$lib/gira-system';

	Chart.register(TimeScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend);

	interface Props {
		kind: SystemKind;
		series: StatusSeries[];
		groupBy: string;
		/** 'area' for stacked areas, 'bar' for stacked bars. */
		chartType: string;
		loading: boolean;
		error: string | null;
		title: string;
		description: string;
		/** What is being counted, for the axis and the tooltip ("bicicletas"). */
		unit: string;
	}

	let { kind, series, groupBy, chartType, loading, error, title, description, unit }: Props = $props();

	type Point = { x: Date; y: number | null };
	let chartInstance: Chart<'bar' | 'line', Point[]> | null = null;
	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let normalized = $state(false);
	const hasData = $derived(series.some(status => status.data.some(point => point.count != null)));

	$effect(() => {
		// Redraw on new data, a new grouping or the view toggle.
		void [series, groupBy, chartType, normalized];
		if (chartCanvas && !loading && hasData) createOrUpdateChart();
	});

	mode.subscribe(() => createOrUpdateChart());

	function formatCount(value: number) {
		return value.toLocaleString('pt-PT', { maximumFractionDigits: value < 10 ? 1 : 0 });
	}

	function createOrUpdateChart() {
		if (!chartCanvas || !hasData) return;
		const style = getComputedStyle(document.body);
		const surface = `hsl(${style.getPropertyValue('--card')})`;

		const totals = new Map<string, number>;
		for (const status of series) {
			for (const point of status.data) totals.set(point.timestamp, (totals.get(point.timestamp) ?? 0) + (point.count ?? 0));
		}

		const area = chartType === 'area';
		// A lone bucket (polling just started) would draw no line at all, so mark the points.
		const fewPoints = (series[0]?.data.length ?? 0) <= 2;
		const datasets = series.map((status, index): ChartDataset<'bar' | 'line', Point[]> => {
			const color = statusColor(kind, status.status, $mode === 'dark');
			const data = status.data.map(point => {
				const total = totals.get(point.timestamp) ?? 0;
				if (point.count == null || !normalized) return { x: new Date(point.timestamp), y: point.count };
				return { x: new Date(point.timestamp), y: total ? point.count / total : 0 };
			});
			if (area) {
				return {
					type: 'line',
					label: statusLabel(kind, status.status),
					data,
					backgroundColor: `${color}bf`,
					borderColor: color,
					borderWidth: 1.5,
					// Each area fills down to the one below it.
					fill: index === 0 ? 'origin' : '-1',
					cubicInterpolationMode: 'monotone',
					pointRadius: fewPoints ? 3 : 0,
					pointBackgroundColor: color,
					pointHoverRadius: 4,
					// Leave a gap where no poll fell in the bucket rather than drawing through it.
					spanGaps: false,
				};
			}
			return {
				type: 'bar',
				label: statusLabel(kind, status.status),
				data,
				backgroundColor: color,
				hoverBackgroundColor: color,
				// A thin gap in the card's colour between stacked segments.
				borderColor: surface,
				borderWidth: { top: 2 },
				borderSkipped: 'bottom',
				borderRadius: 2,
				stack: 'status',
			};
		});

		Chart.defaults.backgroundColor = '#00000000';
		Chart.defaults.borderColor = `hsl(${style.getPropertyValue('--border')})`;
		Chart.defaults.color = `hsl(${style.getPropertyValue('--muted-foreground')})`;

		if (chartInstance) chartInstance.destroy();

		chartInstance = new Chart<'bar' | 'line', Point[]>(chartCanvas, {
			type: area ? 'line' : 'bar',
			data: { datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				plugins: {
					legend: {
						display: true,
						position: 'top',
						labels: {
							font: { family: 'Inter' },
							usePointStyle: true,
							pointStyle: 'rectRounded',
							padding: 16,
						},
					},
					tooltip: {
						mode: 'index',
						intersect: false,
						// Top of the stack first, as the bars read.
						itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
						filter: item => item.parsed.y != null && item.parsed.y > 0,
						bodyFont: { family: 'Inter' },
						titleFont: { family: 'Inter', weight: 'bold' },
						footerFont: { family: 'Inter', weight: 'normal' },
						callbacks: {
							title: items => {
								const date = new Date(items[0].parsed.x);
								if (groupBy === 'hour') {
									return date.toLocaleString('pt-PT', { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' }) +
										' - ' + new Date(items[0].parsed.x + 3600000).toLocaleString('pt-PT', { hour: 'numeric', minute: '2-digit' });
								}
								return date.toLocaleString('pt-PT', { year: 'numeric', month: 'short', day: '2-digit' });
							},
							label: context => {
								const value = context.parsed.y ?? 0;
								return ` ${context.dataset.label}: ${normalized ? `${(value * 100).toFixed(1)}%` : formatCount(value)}`;
							},
							// What the status is made of, largest first ("Em reparação: 454").
							afterLabel: context => {
								const status = series[context.datasetIndex];
								const point = status.data[context.dataIndex];
								if (!point.parts) return [];
								const total = totals.get(point.timestamp) ?? 0;
								return Object.entries(point.parts)
									.filter(([, count]) => count > 0)
									.sort(([, a], [, b]) => b - a)
									.map(([part, count]) => `     ${partLabel(kind, status.status, part)}: ${normalized ? `${(total ? count / total * 100 : 0).toFixed(1)}%` : formatCount(count)}`);
							},
							footer: items => {
								if (!items.length) return '';
								const total = totals.get(series[0].data[items[0].dataIndex].timestamp) ?? 0;
								return `Total: ${formatCount(total)} ${unit} (média)`;
							},
						},
					},
				},
				scales: {
					x: {
						type: 'time',
						stacked: true,
						offset: !area,
						time: { unit: groupBy === 'hour' ? 'hour' : 'day' },
						grid: { display: false },
						ticks: {
							font: { family: 'Inter' },
							callback: value => {
								const date = new Date(value);
								if (groupBy === 'hour') return date.toLocaleString('pt-PT', { hour: 'numeric', minute: '2-digit' });
								return date.toLocaleString('pt-PT', { month: 'short', day: 'numeric' });
							},
						},
					},
					y: {
						stacked: true,
						beginAtZero: true,
						max: normalized ? 1 : undefined,
						ticks: {
							precision: 0,
							font: { family: 'Inter' },
							callback: value => normalized ? `${(Number(value) * 100).toFixed(0)}%` : Number(value).toLocaleString('pt-PT'),
						},
						title: {
							display: true,
							text: normalized ? `Proporção de ${unit}` : `Número de ${unit}`,
							font: { family: 'Inter' },
						},
					},
				},
				interaction: { mode: 'index', intersect: false },
			},
		});
	}

	onMount(() => () => chartInstance?.destroy());
</script>

<Card.Root class="h-full">
	<Card.CardHeader>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="min-w-0 flex-1">
				<Card.CardTitle>{title}</Card.CardTitle>
				<Card.CardDescription>{description}</Card.CardDescription>
			</div>
			<div class="flex flex-col gap-1">
				<Label.Root class="text-xs">Visualização</Label.Root>
				<Tabs.Root value={normalized ? 'normalized' : 'absolute'} onValueChange={value => { normalized = value === 'normalized'; }}>
					<Tabs.TabsList class="h-8">
						<Tabs.TabsTrigger value="absolute" class="text-xs px-2">Absoluto</Tabs.TabsTrigger>
						<Tabs.TabsTrigger value="normalized" class="text-xs px-2">Normalizado</Tabs.TabsTrigger>
					</Tabs.TabsList>
				</Tabs.Root>
			</div>
		</div>
	</Card.CardHeader>

	<Card.CardContent>
		<div class="h-80 relative">
			{#if loading}
				<div class="absolute inset-0 flex items-center justify-center">
					<Spinner />
				</div>
			{:else if error}
				<div class="absolute inset-0 flex items-center justify-center">
					<p class="text-destructive">Erro: {error}</p>
				</div>
			{:else if !hasData}
				<div class="absolute inset-0 flex items-center justify-center">
					<p class="text-muted-foreground">Sem dados disponíveis para o período selecionado</p>
				</div>
			{:else}
				<canvas bind:this={chartCanvas} height="400"></canvas>
			{/if}
		</div>
	</Card.CardContent>
</Card.Root>
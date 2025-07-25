<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalTimeZone } from '@internationalized/date';
	import { Chart, type ChartDataset } from 'chart.js/auto';
	import colors from 'tailwindcss/colors';
	import * as Card from '$lib/components/ui/card';
	import * as Label from '$lib/components/ui/label';
	import * as Tabs from '$lib/components/ui/tabs';
	import { TimeScale, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, type ChartTypeRegistry } from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import { mode } from 'mode-watcher';
	import Spinner from '$lib/components/Spinner.svelte';

	Chart.register(TimeScale, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

	let { interval, groupBy, title, description } = $props();
	let chartInstance: Chart<keyof ChartTypeRegistry, { x: Date; y: number }[]> | null = null;
	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let normalized = $state(false);
	let chartData = $state<Array<{
		label: string;
		data: Array<{ timestamp: string; count: number }>;
	}>>([]);

	$effect(() => {
		if (interval?.start && interval?.end && groupBy) {
			fetchChartData();
		}
	});

	$effect(() => {
		if (chartData.length > 0 && chartCanvas && !loading) {
			createOrUpdateChart();
		}
	});

	mode.subscribe(createOrUpdateChart);

	async function fetchChartData() {
		if (!interval?.start || !interval?.end || !groupBy) return;

		loading = true;
		error = null;

		try {
			const formattedStartDate = interval.start.toDate(getLocalTimeZone()).toISOString();
			const formattedEndDate = interval.end.add({ days: 1 }).toDate(getLocalTimeZone()).toISOString();
			const userTimezone = getLocalTimeZone();
			const url = `/api/statistics/ratings?start=${formattedStartDate}&end=${formattedEndDate}&groupBy=${groupBy}&timezone=${userTimezone}`;

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error('Failed to fetch bike ratings data');
			}

			const result = await response.json();
			chartData = result.data;
		} catch (err) {
			console.error('Error fetching bike ratings data:', err);
			error = err instanceof Error ? err.message : 'An unknown error occurred';
		} finally {
			loading = false;
		}
	}

	// Create or update the chart based on current data
	function createOrUpdateChart() {
		if (!chartCanvas) return;

		const style = getComputedStyle(document.body);

		// Colors for each rating (1-5 stars) - using a gradient from red to green
		const ratingColors = [
			colors.red[500], // 1 star
			colors.orange[500], // 2 stars
			colors.yellow[500], // 3 stars
			colors.lime[500], // 4 stars
			colors.green[500], // 5 stars
		];

		const datasets: ChartDataset<'line', { x: Date; y: number }[]>[] = chartData.map((ratingData, index) => {
			const color = ratingColors[index % ratingColors.length];
			let data: { x: Date; y: number }[];

			if (normalized) {
				// Calculate totals for each time point to normalize
				const totals = new Map<string, number>;

				// First pass: calculate totals for each timestamp
				chartData.forEach(series => {
					series.data.forEach(point => {
						const existing = totals.get(point.timestamp) || 0;
						totals.set(point.timestamp, existing + point.count);
					});
				});

				// Second pass: normalize this series data
				data = ratingData.data.map(point => {
					const total = totals.get(point.timestamp) || 0;
					const normalizedValue = total > 0 ? point.count / total : 0;
					return {
						x: new Date(point.timestamp),
						y: normalizedValue,
					};
				});
			} else {
				// Use raw counts
				data = ratingData.data.map(point => ({
					x: new Date(point.timestamp),
					y: point.count,
				}));
			}

			return {
				label: ratingData.label,
				data: data,
				backgroundColor: `${color}B3`, // 70% opacity (B3 in hex)
				borderColor: color,
				borderWidth: 1,
				tension: 0.4,
				fill: true,
				pointRadius: 0,
				pointHoverRadius: 4,
			};
		});

		Chart.defaults.backgroundColor = '#00000000';
		Chart.defaults.borderColor = `hsl(${style.getPropertyValue('--border')})`;
		Chart.defaults.color = `hsl(${style.getPropertyValue('--muted-foreground')})`;

		// If chart already exists, destroy it before creating a new one
		if (chartInstance) chartInstance.destroy();

		// Create a new chart with time axis
		chartInstance = new Chart(chartCanvas, {
			type: 'line',
			data: {
				datasets,
			},
			options: {
				locale: undefined,
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'top',
						labels: {
							font: {
								family: 'Inter',
							},
							usePointStyle: true,
							padding: 20,
						},
					},
					tooltip: {
						mode: 'index',
						intersect: false,
						bodyFont: {
							family: 'Inter',
						},
						titleFont: {
							family: 'Inter',
							weight: 'bold',
						},
						callbacks: {
							title: tooltipItems => {
								const date = new Date(tooltipItems[0].parsed.x);
								if (groupBy === 'hour') {
									return date.toLocaleString('pt-PT', { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' }) +
										' - ' + new Date(tooltipItems[0].parsed.x + 3600000).toLocaleString('pt-PT', { hour: 'numeric', minute: '2-digit' });
								} else {
									return date.toLocaleString('pt-PT', { year: 'numeric', month: 'short', day: '2-digit' });
								}
							},
							label: context => {
								const label = context.dataset.label || '';
								const value = context.parsed.y;
								if (normalized) {
									return `${label}: ${(value * 100).toFixed(1)}%`;
								} else {
									return `${label}: ${value} avaliações`;
								}
							},
						},
					},
				},
				scales: {
					x: {
						type: 'time',
						time: {
							unit: groupBy === 'hour' ? 'hour' : 'day',
						},
						title: {
							display: true,
							text: 'Tempo',
							font: {
								family: 'Inter',
							},
						},
						ticks: {
							font: {
								family: 'Inter',
							},
							callback: value => {
								const date = new Date(value);
								if (groupBy === 'hour') {
									return date.toLocaleString('pt-PT', { hour: 'numeric', minute: '2-digit' }) + ' - ' + new Date(date.getTime() + 3600000).toLocaleString('pt-PT', { hour: 'numeric', minute: '2-digit' });
								} else {
									return date.toLocaleString('pt-PT', { month: 'short', day: 'numeric' });
								}
							},
						},
					},
					y: {
						beginAtZero: true,
						stacked: true,
						max: normalized ? 1 : undefined,
						ticks: {
							precision: 0,
							font: {
								family: 'Inter',
							},
							callback: function (value) {
								if (normalized) {
									return `${(Number(value) * 100).toFixed(0)}%`;
								} else {
									return value;
								}
							},
						},
						title: {
							display: true,
							text: normalized ? 'Proporção de Avaliações' : 'Número de Avaliações',
							font: {
								family: 'Inter',
							},
						},
					},
				},
				interaction: {
					mode: 'index',
					intersect: false,
				},
				elements: {
					point: {
						radius: 0,
						hoverRadius: 4,
					},
				},
			},
		});

		setTimeout(() => chartInstance?.update(), 10);
	}

	onMount(() => {
		return () => {
			chartInstance?.destroy();
		};
	});
</script>

<Card.Root class="h-full">
	<Card.CardHeader>
		<div class="flex items-center justify-between">
			<div>
				<Card.CardTitle>{title}</Card.CardTitle>
				<Card.CardDescription>
					{description}
				</Card.CardDescription>
			</div>
			<div class="flex gap-4 items-center">
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
					<p class="text-destructive">Error: {error}</p>
				</div>
			{:else if chartData.length === 0}
				<div class="absolute inset-0 flex items-center justify-center">
					<p class="text-muted-foreground">Sem dados disponíveis para o período selecionado</p>
				</div>
			{:else}
				<canvas bind:this={chartCanvas} height="400"></canvas>
			{/if}
		</div>
	</Card.CardContent>
</Card.Root>
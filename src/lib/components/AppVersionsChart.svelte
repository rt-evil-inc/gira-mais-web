<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalTimeZone } from '@internationalized/date';
	import { Chart, type ChartDataset } from 'chart.js/auto';
	import * as Card from '$lib/components/ui/card';
	import { TimeScale, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, type ChartTypeRegistry } from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import { mode } from 'mode-watcher';
	import Spinner from '$lib/components/Spinner.svelte';

	Chart.register(TimeScale, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

	let { interval, groupBy, title, description } = $props();

	let isSmallInterval = $derived(interval?.start?.add({ days: 1 }) >= interval?.end);
	let chartInstance: Chart<keyof ChartTypeRegistry, { x: Date; y: number }[]> | null = null;
	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
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
			const url = `/api/admin/versions?start=${formattedStartDate}&end=${formattedEndDate}&groupBy=${groupBy}&timezone=${userTimezone}`;

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error('Failed to fetch app versions data');
			}

			const result = await response.json();
			chartData = result.data;
		} catch (err) {
			console.error('Error fetching app versions data:', err);
			error = err instanceof Error ? err.message : 'An unknown error occurred';
		} finally {
			loading = false;
		}
	}

	// Create or update the chart based on current data
	function createOrUpdateChart() {
		if (!chartCanvas) return;

		const style = getComputedStyle(document.body);

		// Color palette for different app versions
		const colors = [
			'--primary',
			'--secondary-foreground',
			'--destructive',
			'--muted-foreground',
			'--accent-foreground',
			'--border',
		];

		const datasets: ChartDataset<'line', { x: Date; y: number }[]>[] = chartData.map((versionData, index) => {
			const colorProperty = colors[index % colors.length];
			const data = versionData.data.map(point => ({
				x: new Date(point.timestamp),
				y: point.count,
			}));

			return {
				label: `v${versionData.label}`,
				data: data,
				backgroundColor: `hsl(${style.getPropertyValue(colorProperty)} / 0.7)`,
				borderColor: `hsl(${style.getPropertyValue(colorProperty)})`,
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
								return `${label}: ${value} dispositivos únicos`;
							},
						},
					},
				},
				scales: {
					x: {
						type: 'time',
						time: {
							unit: isSmallInterval ? 'hour' : 'day',
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
								if (isSmallInterval) {
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
						ticks: {
							precision: 0,
							font: {
								family: 'Inter',
							},
						},
						title: {
							display: true,
							text: 'Dispositivos Únicos',
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
		<Card.CardTitle>{title}</Card.CardTitle>
		<Card.CardDescription>
			{description}
		</Card.CardDescription>
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
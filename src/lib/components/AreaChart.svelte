<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { getLocalTimeZone } from '@internationalized/date';
	import { Chart, type ChartDataset } from 'chart.js/auto';
	import { TimeScale, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import { mode } from 'mode-watcher';
	import Spinner from '$lib/components/Spinner.svelte';

	Chart.register(TimeScale, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

	let { endpoint, interval, groupBy, title, description } = $props();

	let isSmallInterval = $derived(interval?.start?.add({ days: 1 }) >= interval?.end);
	let isLargeInterval = $derived(interval?.start?.add({ weeks: 2 }) < interval?.end);
	let chartInstance: any = null;
	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let chartData = $state<{timestamp: string; count: number}[]>([]);

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
			const url = `/api/statistics/${endpoint}?start=${formattedStartDate}&end=${formattedEndDate}&groupBy=${groupBy}`;

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error('Failed to fetch chart data');
			}

			const result = await response.json();
			chartData = result.data;
		} catch (err) {
			console.error('Error fetching chart data:', err);
			error = err instanceof Error ? err.message : 'An unknown error occurred';
		} finally {
			loading = false;
		}
	}

	// Create or update the chart based on current data and chart type
	function createOrUpdateChart() {
		if (!chartCanvas) return;

		// Format the data for the chart - use proper time-based data points
		const data = chartData.map(point => ({
			x: new Date(point.timestamp),
			y: point.count,
		}));

		const style = getComputedStyle(document.body);

		const datasets: ChartDataset<'line', { x: Date; y: number }[]>[] = [{
			label: title,
			data: data,
			backgroundColor: `hsl(${style.getPropertyValue('--primary')} / 0.3)`,
			borderColor: `hsl(${style.getPropertyValue('--primary')})`,
			borderWidth: 2,
			tension: 0.4,
			fill: true,
			pointRadius: 0,
		}];

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
						display: false,
					},
					tooltip: {
						mode: 'index',
						intersect: false,
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
						},
						ticks: {
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
						ticks: {
							precision: 0,
						},
						title: {
							display: true,
							text: title,
						},
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
			{:else}
				<canvas bind:this={chartCanvas} height="400"></canvas>
			{/if}
		</div>
	</Card.CardContent>
</Card.Root>
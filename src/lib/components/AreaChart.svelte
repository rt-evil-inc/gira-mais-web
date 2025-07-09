<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalTimeZone } from '@internationalized/date';
	import { Chart, type ChartDataset } from 'chart.js/auto';
	import * as Card from '$lib/components/ui/card';
	import { TimeScale, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, type ChartTypeRegistry } from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import { mode } from 'mode-watcher';
	import Spinner from '$lib/components/Spinner.svelte';
	import annotationPlugin from 'chartjs-plugin-annotation';

	Chart.register(TimeScale, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, annotationPlugin);

	let { endpoint, interval, groupBy, title, description, colorProperty = '--primary', tension = 0.4 } = $props();

	let isSmallInterval = $derived(interval?.start?.add({ days: 1 }) >= interval?.end);
	let chartInstance: Chart<keyof ChartTypeRegistry, { x: Date; y: number }[]> | null = null;
	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let chartData = $state<{timestamp: string; count: number}[]>([]);
	let releasesData = $state<{tag_name: string; published_at: string}[] | undefined>(undefined);

	$effect(() => {
		if (interval?.start && interval?.end && groupBy && releasesData !== undefined) {
			fetchChartData();
		}
	});

	$effect(() => {
		if (chartData.length > 0 && chartCanvas && !loading && releasesData !== undefined) {
			createOrUpdateChart();
		}
	});

	mode.subscribe(createOrUpdateChart);

	async function fetchReleases() {
		try {
			const response = await fetch('https://api.github.com/repos/rt-evil-inc/gira-mais/releases');
			if (!response.ok) {
				throw new Error('Failed to fetch GitHub releases');
			}
			releasesData = await response.json();
		} catch (err) {
			console.error('Error fetching GitHub releases:', err);
			releasesData = [];
		}
	}

	async function fetchChartData() {
		if (!interval?.start || !interval?.end || !groupBy) return;

		loading = true;
		error = null;

		try {
			const formattedStartDate = interval.start.toDate(getLocalTimeZone()).toISOString();
			const formattedEndDate = interval.end.add({ days: 1 }).toDate(getLocalTimeZone()).toISOString();
			const userTimezone = getLocalTimeZone();
			const [path, query] = endpoint.split('?');
			let url = `/api/statistics/${path}?start=${formattedStartDate}&end=${formattedEndDate}&groupBy=${groupBy}&timezone=${userTimezone}&${query}`;

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
			backgroundColor: `hsl(${style.getPropertyValue(colorProperty)} / 0.3)`,
			borderColor: `hsl(${style.getPropertyValue(colorProperty)})`,
			borderWidth: 2,
			tension: tension,
			fill: true,
			pointRadius: 0,
		}];

		Chart.defaults.backgroundColor = '#00000000';
		Chart.defaults.borderColor = `hsl(${style.getPropertyValue('--border')})`;
		Chart.defaults.color = `hsl(${style.getPropertyValue('--muted-foreground')})`;

		// If chart already exists, destroy it before creating a new one
		if (chartInstance) chartInstance.destroy();

		// Create annotations for GitHub releases
		const annotations: {
			type: 'line';
			scaleID: 'x';
			value: string;
			borderColor: string;
			borderWidth: number;
			label: {
				display: boolean;
				content: string;
				position: 'start';
				backgroundColor: string;
				color: string;
				font: {
					weight: 'bold';
					family: string;
				};
				padding: number;
			};
		}[] = [];

		if (chartData.length > 0) {
			const firstDataDate = new Date(chartData[0].timestamp);
			const lastDataDate = new Date(chartData[chartData.length - 1].timestamp);

			releasesData?.forEach(release => {
				const releaseDate = new Date(release.published_at);
				// Only add annotation if within the chart timeframe
				if (releaseDate >= firstDataDate && releaseDate <= lastDataDate) {
					annotations.push({
						type: 'line',
						scaleID: 'x',
						value: releaseDate.toISOString(),
						borderColor: `hsl(${style.getPropertyValue('--secondary-foreground')})`,
						borderWidth: 2,
						label: {
							display: true,
							content: release.tag_name,
							position: 'start',
							backgroundColor: `hsl(${style.getPropertyValue('--secondary-foreground')})`,
							color: `hsl(${style.getPropertyValue('--secondary')})`,
							font: {
								weight: 'bold',
								family: 'Inter',
							},
							padding: 4,
						},
					});
				}
			});
		}

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
						},
					},
					annotation: {
						annotations,
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
						ticks: {
							precision: 0,
							font: {
								family: 'Inter',
							},
						},
						title: {
							display: true,
							text: title,
							font: {
								family: 'Inter',
							},
						},
					},
				},
			},
		});

		setTimeout(() => chartInstance?.update(), 10);
	}

	onMount(() => {
		fetchReleases();

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
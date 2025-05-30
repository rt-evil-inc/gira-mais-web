<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalTimeZone } from '@internationalized/date';
	import { Chart, type ChartDataset } from 'chart.js/auto';
	import { TimeScale, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, type ChartTypeRegistry } from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import { mode } from 'mode-watcher';
	import Spinner from '$lib/components/Spinner.svelte';
	import annotationPlugin from 'chartjs-plugin-annotation';

	Chart.register(TimeScale, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, annotationPlugin);

	let { endpoint, interval, title, colorProperty = '--primary', tension = 0.0 } = $props();

	let chartInstance: Chart<keyof ChartTypeRegistry, { x: Date; y: number }[]> | null = null;
	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let chartData = $state<{timestamp: string; available_tokens: number; event_type: string; token_id: number}[]>([]);
	let releasesData = $state<{tag_name: string; published_at: string}[] | undefined>(undefined);

	$effect(() => {
		if (interval?.start && interval?.end && releasesData !== undefined) {
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
		if (!interval?.start || !interval?.end) return;

		loading = true;
		error = null;

		try {
			const formattedStartDate = interval.start.toDate(getLocalTimeZone()).toISOString();
			const formattedEndDate = interval.end.add({ days: 1 }).toDate(getLocalTimeZone()).toISOString();
			const url = `/api/statistics/${endpoint}?start=${formattedStartDate}&end=${formattedEndDate}`;

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

		// Format the data for the chart - use event timestamps as exact points
		const data = chartData.map(point => ({
			x: new Date(point.timestamp),
			y: point.available_tokens,
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
			pointRadius: 2,
			pointHoverRadius: 4,
			stepped: true, // Make it a step chart since tokens change instantly at events
		}];

		Chart.defaults.backgroundColor = '#00000000';
		Chart.defaults.borderColor = `hsl(${style.getPropertyValue('--border')})`;
		Chart.defaults.color = `hsl(${style.getPropertyValue('--muted-foreground')})`;

		// If chart already exists, destroy it before creating a new one
		if (chartInstance) chartInstance.destroy();

		// Create annotations for GitHub releases and day changes
		const annotations: {
			type: 'line';
			scaleID: 'x';
			value: string;
			borderColor: string;
			borderWidth: number;
			borderDash?: number[];
			label: {
				display: boolean;
				content: string;
				position: 'start';
				backgroundColor: string;
				color: string;
				font: {
					weight?: 'bold';
					size?: number;
					family: string;
				};
				padding: number;
			};
		}[] = [];

		if (chartData.length > 0) {
			const firstDataDate = new Date(chartData[0].timestamp);
			const lastDataDate = new Date(chartData[chartData.length - 1].timestamp);

			// Add GitHub release annotations
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
								return date.toLocaleString('pt-PT', {
									year: 'numeric',
									month: 'short',
									day: '2-digit',
									hour: 'numeric',
									minute: '2-digit',
									second: '2-digit',
								});
							},
							afterTitle: tooltipItems => {
								const dataIndex = chartData.findIndex(d => new Date(d.timestamp).getTime() === tooltipItems[0].parsed.x);
								if (dataIndex >= 0) {
									const event = chartData[dataIndex];
									const eventTypeTranslations: Record<string, string> = {
										'created': 'Token criado',
										'assigned': 'Token atribuído',
										'expired': 'Token expirado',
									};
									return `Evento: ${eventTypeTranslations[event.event_type] || event.event_type} (ID: ${event.token_id})`;
								}
								return '';
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
							unit: 'minute',
							displayFormats: {
								minute: 'HH:mm',
								hour: 'HH:mm',
							},
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
								return date.toLocaleString('pt-PT', {
									hour: 'numeric',
									minute: '2-digit',
								});
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
			<p class="text-muted-foreground">Nenhum evento encontrado no período selecionado</p>
		</div>
	{:else}
		<canvas bind:this={chartCanvas} height="400"></canvas>
	{/if}
</div>
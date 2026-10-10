<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import 'chartjs-adapter-date-fns';
	import { mode } from 'mode-watcher';
	import { COLORS } from '$lib/gira-system';
	import { FAILURE_KINDS, REPORT_THRESHOLDS, judgedByReports, type FailureKind, type StatusHour } from '$lib/gira-status';

	/** `reported`: whether users' failure reports judge the service; if not, only its checks are charted. */
	let { hours, reported }: { hours: StatusHour[]; reported: boolean } = $props();

	let failuresCanvas = $state<HTMLCanvasElement | null>(null);
	let latencyCanvas = $state<HTMLCanvasElement | null>(null);
	type Point = { x: number; y: number | null };
	let failuresChart: Chart<'bar' | 'line', Point[]> | null = null;
	let latencyChart: Chart<'line', Point[]> | null = null;

	const hasLatency = $derived(hours.some(hour => hour.checks.latencyMs != null));
	const judged = (hour: StatusHour) => judgedByReports(hour.reports);

	$effect(() => {
		void [hours, failuresCanvas, latencyCanvas, $mode];
		draw();
	});

	function hourLabel(hour: string) {
		const start = new Date(hour);
		const end = new Date(start.getTime() + 3_600_000);
		return `${start.toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
	}

	const percent = (value: number) => `${(value * 100).toLocaleString('pt-PT', { maximumFractionDigits: 1 })}%`;

	function draw() {
		const dark = $mode === 'dark';
		const style = getComputedStyle(document.body);
		const muted = `hsl(${style.getPropertyValue('--muted-foreground')})`;
		const border = `hsl(${style.getPropertyValue('--border')})`;
		const color = (status: StatusHour['status']) => (status === 'outage' ? COLORS.critical : status === 'degraded' ? COLORS.warning : COLORS.good)[dark ? 'dark' : 'light'];
		const byHour = new Map(hours.map(hour => [new Date(hour.hour).getTime(), hour]));
		const x = {
			type: 'time' as const,
			time: { unit: 'day' as const },
			// Bars sit at the middle of their hour; no extra padding, so the threshold lines span the chart.
			offset: false,
			grid: { display: false },
			ticks: {
				color: muted,
				font: { family: 'Inter' },
				maxRotation: 0,
				callback: (value: string | number) => new Date(value).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' }),
			},
			min: Date.parse(hours[0]?.hour ?? ''),
			max: Date.parse(hours.at(-1)?.hour ?? '') + 3_600_000,
		};

		failuresChart?.destroy();
		latencyChart?.destroy();
		if (failuresCanvas) {
			const threshold = (value: number, label: string) => ({
				type: 'line' as const,
				label,
				data: [{ x: x.min, y: value * 100 }, { x: x.max, y: value * 100 }],
				borderColor: muted,
				borderWidth: 1,
				borderDash: [4, 4],
				pointRadius: 0,
			});
			failuresChart = new Chart<'bar' | 'line', Point[]>(failuresCanvas, {
				data: {
					datasets: [
						{
							type: 'bar',
							label: 'Utilizadores com falhas',
							// Hours with too few users to judge are left out rather than drawn as zero.
							data: hours.map(hour => ({ x: Date.parse(hour.hour) + 1_800_000, y: judged(hour) ? hour.reports.affected / hour.reports.active * 100 : null })),
							backgroundColor: hours.map(hour => color(hour.status)),
							barPercentage: 1,
							categoryPercentage: 0.9,
							borderRadius: 2,
						},
						threshold(REPORT_THRESHOLDS.degraded, `Erros elevados (${REPORT_THRESHOLDS.degraded * 100}%)`),
						threshold(REPORT_THRESHOLDS.outage, `Falha (${REPORT_THRESHOLDS.outage * 100}%)`),
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					animation: false,
					interaction: { mode: 'nearest', axis: 'x', intersect: false },
					plugins: {
						legend: { display: false },
						tooltip: {
							filter: item => item.datasetIndex === 0,
							bodyFont: { family: 'Inter' },
							titleFont: { family: 'Inter', weight: 'bold' },
							callbacks: {
								title: items => hourLabel(new Date((items[0].parsed.x ?? 0) - 1_800_000).toISOString()),
								label: item => {
									const hour = byHour.get((item.parsed.x ?? 0) - 1_800_000);
									if (!hour) return '';
									return ` ${hour.reports.affected} de ${hour.reports.active} utilizadores com falhas (${percent(hour.reports.affected / hour.reports.active)})`;
								},
								afterLabel: item => {
									const hour = byHour.get((item.parsed.x ?? 0) - 1_800_000);
									if (!hour) return [];
									const kinds = Object.entries(hour.reports.byKind) as [FailureKind, number][];
									const lines = kinds.sort(([, a], [, b]) => b - a).map(([kind, count]) => `     ${FAILURE_KINDS[kind]}: ${count}`);
									if (hour.checks.total) lines.push(` Verificações: ${hour.checks.total - hour.checks.failed} de ${hour.checks.total} com resposta`);
									return lines;
								},
							},
						},
					},
					scales: {
						x,
						y: {
							beginAtZero: true,
							suggestedMax: REPORT_THRESHOLDS.outage * 100 + 5,
							grid: { color: border },
							ticks: { color: muted, font: { family: 'Inter' }, callback: value => `${value}%` },
							title: { display: true, text: 'Utilizadores com falhas', color: muted, font: { family: 'Inter' } },
						},
					},
				},
			});
		}

		if (latencyCanvas && hasLatency) {
			latencyChart = new Chart<'line', Point[]>(latencyCanvas, {
				type: 'line',
				data: {
					datasets: [{
						label: 'Tempo de resposta (mediana)',
						data: hours.map(hour => ({ x: Date.parse(hour.hour) + 1_800_000, y: hour.checks.latencyMs })),
						borderColor: dark ? COLORS.blue.dark : COLORS.blue.light,
						backgroundColor: dark ? COLORS.blue.dark : COLORS.blue.light,
						borderWidth: 2,
						pointRadius: hours.filter(hour => hour.checks.latencyMs != null).length <= 3 ? 3 : 0,
						spanGaps: false,
						tension: 0.3,
					}],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					animation: false,
					interaction: { mode: 'nearest', axis: 'x', intersect: false },
					plugins: {
						legend: { display: false },
						tooltip: {
							bodyFont: { family: 'Inter' },
							titleFont: { family: 'Inter', weight: 'bold' },
							callbacks: {
								title: items => hourLabel(new Date((items[0].parsed.x ?? 0) - 1_800_000).toISOString()),
								label: item => {
									const hour = byHour.get((item.parsed.x ?? 0) - 1_800_000);
									const failed = hour?.checks.failed ? `, ${hour.checks.failed} sem resposta` : '';
									return ` Mediana: ${item.parsed.y} ms (${hour?.checks.total ?? 0} pedidos${failed})`;
								},
							},
						},
					},
					scales: {
						x,
						y: {
							beginAtZero: true,
							grid: { color: border },
							ticks: { color: muted, font: { family: 'Inter' }, callback: value => `${value} ms` },
							title: { display: true, text: 'Tempo de resposta', color: muted, font: { family: 'Inter' } },
						},
					},
				},
			});
		}
	}

	onMount(() => () => {
		failuresChart?.destroy();
		latencyChart?.destroy();
	});
</script>

{#if reported}
	<div class="h-64"><canvas bind:this={failuresCanvas}></canvas></div>
	<p class="mt-2 text-xs text-muted-foreground">
		As barras faltam nas horas com menos de {REPORT_THRESHOLDS.minActive} utilizadores; as linhas tracejadas marcam erros elevados ({REPORT_THRESHOLDS.degraded * 100}%) e falha ({REPORT_THRESHOLDS.outage * 100}%).
	</p>
{:else}
	<p class="text-sm text-muted-foreground">
		Quando o mapa deixa de receber dados, a app volta a tentar sem dar erro e o mapa fica apenas desatualizado, por isso aqui não há
		falhas reportadas pelos utilizadores: o estado do mapa vem só das verificações.
	</p>
{/if}
<div class="mt-6 h-40">
	{#if hasLatency}
		<canvas bind:this={latencyCanvas}></canvas>
	{:else}
		<p class="flex h-full items-center justify-center text-sm text-muted-foreground">Ainda sem medições do tempo de resposta neste período</p>
	{/if}
</div>
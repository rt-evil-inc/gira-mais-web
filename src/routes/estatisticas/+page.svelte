<script lang="ts">
	import StatisticsChart from '$lib/components/AreaChart.svelte';
	import StatisticsControls from '$lib/components/StatisticsControls.svelte';
	import { ChartLine } from 'lucide-svelte';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import LightSwitch from '$lib/components/LightSwitch.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let interval = $state({
		start: today(getLocalTimeZone()).add({ days: -7 }),
		end: today(getLocalTimeZone()),
	});
	let groupBy = $state('hour');
</script>

<div class="absolute right-0 top-0 m-4 flex items-center gap-2">
	<LightSwitch />
</div>

<div class="container min-h-screen mx-auto py-12 px-4 max-w-6xl">
	<header class="mb-10">
		<div class="flex items-center mb-4">
			<ChartLine class="min-h-10 min-w-10 text-primary" />
			<h1 class="text-3xl font-bold ml-2">Estatísticas de Utilização da Gira+</h1>
		</div>
	</header>

	<!-- Chart Controls -->
	<div class="mt-8 mb-4">
		<StatisticsControls bind:interval bind:groupBy />
	</div>

	<!-- Statistics Charts -->
	<div>
		<StatisticsChart endpoint="usage" {interval} {groupBy}
			title="Utilizadores"
			description="Número de utilizadores únicos ao longo do tempo"
		/>
	</div>
	<div class="mt-4">
		<StatisticsChart endpoint="trips" {interval} {groupBy}
			title="Viagens"
			description="Número de viagens ao longo do tempo"
		/>
	</div>
</div>

<Footer class="bg-muted/40" />
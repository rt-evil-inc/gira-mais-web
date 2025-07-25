<script lang="ts">
	import StatisticsChart from '$lib/components/AreaChart.svelte';
	import BikeRatingsChart from '$lib/components/BikeRatingsChart.svelte';
	import StatisticsControls from '$lib/components/StatisticsControls.svelte';
	import { ChartLine } from 'lucide-svelte';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import LightSwitch from '$lib/components/LightSwitch.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { browser } from '$app/environment';

	let interval = $state({
		start: today(getLocalTimeZone()).add({ days: -7 }),
		end: today(getLocalTimeZone()),
	});
	let groupBy = $state('hour');
	let admin = $state(false);
	if (browser) {
		admin = localStorage.getItem('admin') === 'true';
	}
</script>

<svelte:head>
	<title>Gira+ | Estatísticas</title>
	<meta name="description" content="Estatísticas de utilização da aplicação Gira+" />
	<meta property="og:title" content="Gira+ | Estatísticas" />
	<meta property="og:description" content="Estatísticas de utilização da aplicação Gira+" />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://gira-mais.app/card.png" />
	<meta property="og:url" content="https://gira-mais.app/estatisticas" />
	<meta property="og:site_name" content="Gira+" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Gira+ | Estatísticas" />
	<meta name="twitter:description" content="Estatísticas de utilização da aplicação Gira+" />
	<meta name="twitter:image" content="https://gira-mais.app/card.png" />
</svelte:head>

<div class="absolute right-0 top-0 m-4 flex items-center gap-2">
	{#if admin}
		<Button variant="ghost" size="sm" href="/admin" data-sveltekit-preload-data="tap">Admin</Button>
	{/if}
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
	<div class="mt-4">
		<BikeRatingsChart {interval} {groupBy}
			title="Avaliações de Bicicletas"
			description="Avaliações das bicicletas distribuídas por classificação (1-5 estrelas)"
		/>
	</div>
</div>

<Footer class="bg-muted/40" />
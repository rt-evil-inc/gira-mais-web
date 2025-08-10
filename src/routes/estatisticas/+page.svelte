<script lang="ts">
	import AreaChart from '$lib/components/AreaChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import StatisticsControls from '$lib/components/StatisticsControls.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import { ChartLine, Users, Route } from 'lucide-svelte';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import Footer from '$lib/components/Footer.svelte';
	import BikeRatingsChart from '$lib/components/BikeRatingsChart.svelte';

	let interval = $state({
		start: today(getLocalTimeZone()).add({ months: -1 }),
		end: today(getLocalTimeZone()),
	});
	let groupBy = $state('day');
	let chartType = $state('area');

	// Summary statistics state
	let totalUsers = $state<{value?: number, loading: boolean, error?: string}>({ loading: true });
	let totalTrips = $state<{value?: number, loading: boolean, error?: string}>({ loading: true });

	// Fetch monthly unique users (last month)
	async function fetchTotalUsers() {
		totalUsers.loading = true;
		totalUsers.error = undefined;

		try {
			const params = new URLSearchParams({
				groupBy: 'total',
			});

			const response = await fetch(`/api/statistics/usage?${params}`);
			if (!response.ok) throw new Error('Failed to fetch monthly users');

			const data = await response.json();
			totalUsers.value = data.data;
		} catch (error) {
			totalUsers.error = error instanceof Error ? error.message : 'Erro desconhecido';
		} finally {
			totalUsers.loading = false;
		}
	}

	// Fetch total trips (all time)
	async function fetchTotalTrips() {
		totalTrips.loading = true;
		totalTrips.error = undefined;

		try {
			const params = new URLSearchParams({
				groupBy: 'total',
			});

			const response = await fetch(`/api/statistics/trips?${params}`);
			if (!response.ok) throw new Error('Failed to fetch total trips');

			const data = await response.json();
			totalTrips.value = data.data;
		} catch (error) {
			totalTrips.error = error instanceof Error ? error.message : 'Erro desconhecido';
		} finally {
			totalTrips.loading = false;
		}
	}

	// Fetch data on mount
	$effect(() => {
		fetchTotalUsers();
		fetchTotalTrips();
	});
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

<div class="container min-h-screen mx-auto py-12 px-4 max-w-6xl">
	<header class="mb-10">
		<div class="flex items-center mb-4">
			<ChartLine class="min-h-10 min-w-10 text-primary" />
			<h1 class="text-3xl font-bold ml-2">Estatísticas de Utilização da Gira+</h1>
		</div>
	</header>

	<!-- Summary Cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
		<StatCard
			title="Utilizadores"
			value={totalUsers.value}
			loading={totalUsers.loading}
			error={totalUsers.error}
			icon={Users}
			description="Número total de dispositivos em que a aplicação foi utilizada"
		/>
		<StatCard
			title="Viagens"
			value={totalTrips.value}
			loading={totalTrips.loading}
			error={totalTrips.error}
			icon={Route}
			description="Número total de viagens registadas"
		/>
	</div>

	<!-- Chart Controls -->
	<div class="mt-8 mb-4">
		<StatisticsControls bind:interval bind:groupBy bind:chartType />
	</div>

	<!-- Statistics Charts -->
	<div>
		{#if chartType === 'area'}
			<AreaChart endpoint="usage" {interval} {groupBy}
				title="Utilizadores"
				description="Número de utilizadores únicos ao longo do tempo"
			/>
		{:else}
			<BarChart endpoint="usage" {interval} {groupBy}
				title="Utilizadores"
				description="Número de utilizadores únicos ao longo do tempo"
			/>
		{/if}
	</div>
	<div class="mt-4">
		{#if chartType === 'area'}
			<AreaChart endpoint="trips" {interval} {groupBy}
				title="Viagens"
				description="Número de viagens ao longo do tempo"
			/>
		{:else}
			<BarChart endpoint="trips" {interval} {groupBy}
				title="Viagens"
				description="Número de viagens ao longo do tempo"
			/>
		{/if}
	</div>
	<div class="mt-4">
		<BikeRatingsChart {interval} {groupBy}
			title="Avaliações de Bicicletas"
			description="Avaliações das bicicletas distribuídas por classificação"
		/>
	</div>
</div>

<Footer class="bg-muted/40" />
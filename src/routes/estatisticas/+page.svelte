<script lang="ts">
	import AreaChart from '$lib/components/AreaChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import StatisticsControls from '$lib/components/StatisticsControls.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import { ChartLine, Users, Route, UserPlus } from '@lucide/svelte';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import Footer from '$lib/components/Footer.svelte';
	import GiraSystemStatus from '$lib/components/GiraSystemStatus.svelte';
	import GiraServiceStatus from '$lib/components/GiraServiceStatus.svelte';

	let interval = $state({
		start: today(getLocalTimeZone()).add({ months: -1 }),
		end: today(getLocalTimeZone()),
	});
	let groupBy = $state('day');
	let chartType = $state('area');

	// Summary statistics state
	let totalUsers = $state<{value?: number, loading: boolean, error?: string}>({ loading: true });
	let totalTrips = $state<{value?: number, loading: boolean, error?: string}>({ loading: true });
	let recent = $state<{value?: {users: number, newUsers: number, trips: number}, loading: boolean, error?: string}>({ loading: true });

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

	// Fetch the last 7 days' users, new users and trips
	async function fetchRecent() {
		recent.loading = true;
		recent.error = undefined;

		try {
			const response = await fetch('/api/statistics/recent');
			if (!response.ok) throw new Error('Failed to fetch recent statistics');

			recent.value = await response.json();
		} catch (error) {
			recent.error = error instanceof Error ? error.message : 'Erro desconhecido';
		} finally {
			recent.loading = false;
		}
	}

	// Fetch data on mount
	$effect(() => {
		fetchTotalUsers();
		fetchTotalTrips();
		fetchRecent();
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

<div class="container min-h-screen mx-auto py-8 sm:py-12 px-4 max-w-6xl">
	<header class="mb-8 sm:mb-10">
		<div class="flex items-center mb-4">
			<ChartLine class="h-8 w-8 shrink-0 text-primary sm:h-10 sm:w-10" />
			<h1 class="text-2xl font-bold ml-2 sm:text-3xl">Estatísticas de Utilização da Gira+</h1>
		</div>
	</header>

	<!-- Summary Cards -->
	<div id="utilizacao" class="grid grid-cols-2 gap-2 sm:gap-6 mb-2 sm:mb-6 scroll-mt-20">
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
	<div class="grid grid-cols-3 gap-2 sm:gap-6 mb-8">
		<StatCard
			title="Utilizadores (7&nbsp;dias)"
			value={recent.value?.users}
			loading={recent.loading}
			error={recent.error}
			compact
			icon={Users}
			description="Dispositivos em que a aplicação foi utilizada"
		/>
		<StatCard
			title="Novos utilizadores (7&nbsp;dias)"
			value={recent.value?.newUsers}
			loading={recent.loading}
			error={recent.error}
			compact
			icon={UserPlus}
			description="Dispositivos em que a aplicação foi utilizada pela primeira vez"
		/>
		<StatCard
			title="Viagens (7&nbsp;dias)"
			value={recent.value?.trips}
			loading={recent.loading}
			error={recent.error}
			compact
			icon={Route}
			description="Viagens registadas"
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
	<div class="mt-10 sm:mt-4">
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

	<GiraServiceStatus />
	<GiraSystemStatus bind:interval bind:groupBy bind:chartType />
</div>

<Footer class="bg-muted/40" />
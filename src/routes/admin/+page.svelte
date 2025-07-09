<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ChartLine } from 'lucide-svelte';
	import TokenMonitor from '$lib/components/TokenMonitor.svelte';
	import ErrorDashboard from '$lib/components/ErrorDashboard.svelte';
	import AppVersionsChart from '$lib/components/AppVersionsChart.svelte';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import type { PageProps } from './$types';
	import LightSwitch from '$lib/components/LightSwitch.svelte';

	let { data }: PageProps = $props();

	let interval = $state({
		start: today(getLocalTimeZone()).add({ days: -7 }),
		end: today(getLocalTimeZone()),
	});
</script>

<svelte:head>
	<title>Gira+ | Admin</title>
</svelte:head>

<div class="absolute right-0 top-0 m-4 flex items-center gap-2">
	<Button variant="ghost" size="sm" href="/admin/config">Configurações</Button>
	<Button variant="ghost" size="sm" href="/estatisticas">Estatísticas</Button>
	<LightSwitch />
</div>

<div class="container mx-auto py-12 px-4 max-w-6xl">
	<header class="mb-10">
		<div class="flex items-center mb-4">
			<ChartLine class="min-h-10 min-w-10 text-primary" />
			<h1 class="text-3xl font-bold ml-2">Monitorização</h1>
		</div>
	</header>

	<!-- App Versions Chart -->
	<div class="mt-4">
		<AppVersionsChart
			interval={{ start: today(getLocalTimeZone()).add({ months: -1 }), end: today(getLocalTimeZone()) }}
			groupBy="day"
			title="Versões da App"
			description="Número de dispositivos únicos por versão da aplicação ao longo do tempo"
		/>
	</div>

	<!-- Statistics Charts -->
	<div class="mt-4">
		<ErrorDashboard errorData={data.errorData} />
	</div>

	<!-- Token Monitoring Section -->
	<div class="mt-12">
		<TokenMonitor tokenSources={data.tokenSources} tokenStats={data.tokenStats} {interval}/>
	</div>
</div>
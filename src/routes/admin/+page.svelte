<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { ChartLine, RefreshCw, Settings } from '@lucide/svelte';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import StatisticsControls from '$lib/components/StatisticsControls.svelte';
	import OverviewSection from '$lib/components/admin/OverviewSection.svelte';
	import UsersSection from '$lib/components/admin/UsersSection.svelte';
	import TripsSection from '$lib/components/admin/TripsSection.svelte';
	import UnlocksSection from '$lib/components/admin/UnlocksSection.svelte';
	import ErrorsSection from '$lib/components/admin/ErrorsSection.svelte';
	import { ADMIN_SECTIONS } from '$lib/admin';
	import { browser } from '$app/environment';

	/** How often the dashboard refreshes itself while it's on screen. */
	const REFRESH_MS = 60_000;

	let interval = $state({
		start: today(getLocalTimeZone()).add({ weeks: -1 }),
		end: today(getLocalTimeZone()),
	});
	let groupBy = $state('day');
	let chartType = $state('bar');

	/**
	 * Bumped to refresh every section. Each one refetches its data in place, so the filters, the open lists and the
	 * pages loaded all stay.
	 */
	let tick = $state(0);
	let refreshedAt = $state(new Date);
	let autoRefresh = $state(browser ? localStorage.getItem('admin-auto-refresh') !== 'false' : true);
	let now = $state(new Date);

	function refresh() {
		tick++;
		refreshedAt = new Date;
	}

	$effect(() => {
		localStorage.setItem('admin-auto-refresh', String(autoRefresh));
		if (!autoRefresh) return;
		const timer = setInterval(() => {
			if (!document.hidden) refresh();
		}, REFRESH_MS);
		return () => clearInterval(timer);
	});

	onMount(() => {
		// Coming back to a tab that missed a refresh catches up at once.
		const onVisible = () => {
			if (!document.hidden && autoRefresh && Date.now() - refreshedAt.getTime() > REFRESH_MS) refresh();
		};
		document.addEventListener('visibilitychange', onVisible);
		const clock = setInterval(() => now = new Date, 15_000);
		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			clearInterval(clock);
		};
	});

	const sinceRefresh = $derived(Math.max(0, Math.round((now.getTime() - refreshedAt.getTime()) / 60_000)));
</script>

<svelte:head>
	<title>Gira+ | Admin</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
	<header class="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-center">
			<ChartLine class="h-8 w-8 shrink-0 text-primary sm:h-10 sm:w-10" />
			<h1 class="ml-2 text-2xl font-bold sm:text-3xl">Monitorização</h1>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<span class="mr-1 text-xs text-muted-foreground">
				Atualizado {sinceRefresh === 0 ? 'agora' : `há ${sinceRefresh} min`}
			</span>
			<Button variant="outline" size="sm" onclick={refresh}>
				<RefreshCw class="h-4 w-4" />
				Atualizar
			</Button>
			<Button variant={autoRefresh ? 'secondary' : 'outline'} size="sm" onclick={() => autoRefresh = !autoRefresh} aria-pressed={autoRefresh}
				title="Atualizar sozinho a cada minuto, enquanto a página está visível">
				Auto: {autoRefresh ? 'ligado' : 'desligado'}
			</Button>
			<Button variant="outline" size="sm" href="/admin/config">
				<Settings class="h-4 w-4" />
				Configurações
			</Button>
		</div>
	</header>

	<section id={ADMIN_SECTIONS[0].id} class="scroll-mt-20">
		<OverviewSection {tick} />
	</section>

	<div class="mt-8 mb-6 sm:mt-10">
		<StatisticsControls bind:interval bind:groupBy bind:chartType />
		<p class="mt-2 text-xs text-muted-foreground">O período escolhido aplica-se a todos os gráficos abaixo; o resumo acima é sempre das últimas 24 horas, 7 e 30 dias.</p>
	</div>

	<section id={ADMIN_SECTIONS[1].id} class="scroll-mt-20">
		<h2 class="mb-4 text-xl font-bold sm:text-2xl">Utilizadores</h2>
		<UsersSection {interval} {groupBy} {chartType} {tick} />
	</section>

	<section id={ADMIN_SECTIONS[2].id} class="mt-12 scroll-mt-20 sm:mt-14">
		<h2 class="mb-4 text-xl font-bold sm:text-2xl">Viagens</h2>
		<TripsSection {interval} {groupBy} {chartType} {tick} />
	</section>

	<section id={ADMIN_SECTIONS[3].id} class="mt-12 scroll-mt-20 sm:mt-14">
		<h2 class="mb-4 text-xl font-bold sm:text-2xl">Desbloqueios</h2>
		<UnlocksSection {interval} {groupBy} {chartType} {tick} />
	</section>

	<section id={ADMIN_SECTIONS[4].id} class="mt-12 scroll-mt-20 sm:mt-14">
		<h2 class="mb-4 text-xl font-bold sm:text-2xl">Erros</h2>
		<ErrorsSection {interval} {groupBy} {chartType} {tick} />
	</section>
</div>
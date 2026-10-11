<script lang="ts">
	import KpiCard from '$lib/components/admin/KpiCard.svelte';
	import { Loader } from '$lib/loader.svelte';
	import { compareVersions, formatNumber, formatPercent, PLATFORMS, type Overview } from '$lib/admin';

	let { tick }: { tick: number } = $props();

	const overview = new Loader<Overview>;
	$effect(() => {
		void tick;
		overview.load('/api/admin/overview');
	});

	const data = $derived(overview.data);
	const loading = $derived(!data && !overview.error);

	/** The newest release (development builds aside) and its share of last week's devices, overall and by platform. */
	const latest = $derived.by(() => {
		if (!data?.versions.length) return null;
		const releases = data.versions.filter(entry => /^\d+\.\d+\.\d+$/.test(entry.version));
		const version = releases.map(entry => entry.version).sort(compareVersions).at(-1);
		if (!version) return null;
		const share = (os?: string) => {
			const entries = data.versions.filter(entry => !os || entry.os === os);
			const total = entries.reduce((sum, entry) => sum + entry.devices, 0);
			return total ? entries.filter(entry => entry.version === version).reduce((sum, entry) => sum + entry.devices, 0) / total : null;
		};
		return { version, share: share(), ios: share('ios'), android: share('android') };
	});

	const platforms = $derived.by(() => {
		if (!data) return '';
		const total = data.versions.reduce((sum, entry) => sum + entry.devices, 0);
		const byOs = (os: string) => data.versions.filter(entry => entry.os === os).reduce((sum, entry) => sum + entry.devices, 0);
		return total ? ['ios', 'android'].map(os => `${PLATFORMS[os].label} ${formatPercent(byOs(os) / total)}`).join(' · ') : '';
	});

	const rate = (part: number, whole: number) => whole ? part / whole : null;
	const unlockRate = $derived(data ? { current: rate(data.unlocks.confirmed.current, data.unlocks.attempts.current), previous: rate(data.unlocks.confirmed.previous, data.unlocks.attempts.previous) } : null);
	const errorShare = $derived(data ? rate(data.errors.devices.current, data.activeUsers.day.current) : null);
</script>

{#if overview.error && !data}
	<p class="text-sm text-destructive">Não foi possível carregar o resumo: {overview.error}</p>
{:else}
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
		<KpiCard title="Ativos (24 h)" {loading} value={data && formatNumber(data.activeUsers.day.current)}
			current={data?.activeUsers.day.current} previous={data?.activeUsers.day.previous} previousLabel="24 h anteriores"
			hint="Dispositivos que abriram a app" />
		<KpiCard title="Ativos (7 dias)" {loading} value={data && formatNumber(data.activeUsers.week.current)}
			current={data?.activeUsers.week.current} previous={data?.activeUsers.week.previous} previousLabel="semana anterior"
			hint={platforms} />
		<KpiCard title="Ativos (30 dias)" {loading} value={data && formatNumber(data.activeUsers.month.current)}
			current={data?.activeUsers.month.current} previous={data?.activeUsers.month.previous} previousLabel="30 dias anteriores" />
		<KpiCard title="Novos (7 dias)" {loading} value={data && formatNumber(data.newUsers.current)}
			current={data?.newUsers.current} previous={data?.newUsers.previous} previousLabel="semana anterior"
			hint="Dispositivos vistos pela primeira vez" />
		<KpiCard title="Versão {latest ? `v${latest.version}` : 'mais recente'}" {loading} value={latest?.share == null ? '-' : formatPercent(latest.share)}
			hint={latest ? `dos ativos (7 dias) · iOS ${latest.ios == null ? '-' : formatPercent(latest.ios)} · Android ${latest.android == null ? '-' : formatPercent(latest.android)}` : undefined} />
		<KpiCard title="Viagens (24 h)" {loading} value={data && formatNumber(data.trips.day.current)}
			current={data?.trips.day.current} previous={data?.trips.day.previous} previousLabel="24 h anteriores" />
		<KpiCard title="Viagens (7 dias)" {loading} value={data && formatNumber(data.trips.week.current)}
			current={data?.trips.week.current} previous={data?.trips.week.previous} previousLabel="semana anterior"
			hint={data?.activeUsers.week.current ? `${formatNumber(data.trips.week.current / data.activeUsers.week.current, 1)} por utilizador ativo` : undefined} />
		<KpiCard title="Com erros (24 h)" {loading} value={data && formatNumber(data.errors.devices.current)} invert
			current={data?.errors.devices.current} previous={data?.errors.devices.previous} previousLabel="24 h anteriores"
			hint={data ? `${formatNumber(data.errors.count.current)} erros${errorShare == null ? '' : ` · ${formatPercent(errorShare)} dos ativos`}` : undefined} />
		<KpiCard title="Desbloqueios (7 dias)" {loading} value={data && formatNumber(data.unlocks.confirmed.current)}
			current={data?.unlocks.confirmed.current} previous={data?.unlocks.confirmed.previous} previousLabel="semana anterior"
			hint={data ? `${unlockRate?.current == null ? '-' : formatPercent(unlockRate.current)} das ${formatNumber(data.unlocks.attempts.current)} tentativas` : undefined} />
		<KpiCard title="Avaliações (7 dias)" {loading} value={data?.ratings.average.current == null ? '-' : `${formatNumber(data.ratings.average.current, 2)} / 5`}
			current={data?.ratings.average.current} previous={data?.ratings.average.previous} previousLabel="semana anterior"
			hint={data ? `média de ${formatNumber(data.ratings.count.current)} avaliações` : undefined} />
	</div>
{/if}
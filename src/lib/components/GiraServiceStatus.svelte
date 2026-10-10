<script lang="ts">
	import { mode } from 'mode-watcher';
	import { CircleCheck, CircleX, TriangleAlert, CircleQuestionMark } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import Spinner from '$lib/components/Spinner.svelte';
	import ServiceHoursChart from '$lib/components/ServiceHoursChart.svelte';
	import { COLORS } from '$lib/gira-system';
	import { REPORT_THRESHOLDS, SERVICES, type ServiceStatus, type StatusDay, type StatusResponse } from '$lib/gira-status';

	const DAYS = 90;
	/** On narrow screens the bar keeps the last 30 days, so each day stays wide enough to point at. */
	const NARROW_DAYS = 30;

	let data = $state<StatusResponse | null>(null);
	let loading = $state(true);
	let failure = $state<string | null>(null);
	let detail = $state<string>('api');

	$effect(() => {
		load();
	});

	async function load() {
		loading = true;
		failure = null;
		try {
			const response = await fetch('/api/statistics/status');
			if (!response.ok) throw new Error('Não foi possível obter o estado dos serviços');
			data = await response.json();
		} catch (err) {
			failure = err instanceof Error ? err.message : 'Erro desconhecido';
		} finally {
			loading = false;
		}
	}

	const dark = $derived($mode === 'dark');
	const STATUS = {
		operational: { label: 'A funcionar', color: COLORS.good, icon: CircleCheck },
		degraded: { label: 'Erros elevados', color: COLORS.warning, icon: TriangleAlert },
		outage: { label: 'Falha', color: COLORS.critical, icon: CircleX },
		no_data: { label: 'Sem dados', color: COLORS.grayLight, icon: CircleQuestionMark },
	};
	const colorOf = (status: keyof typeof STATUS) => dark ? STATUS[status].color.dark : STATUS[status].color.light;

	/** The last DAYS days up to the newest one served, with the days before the data as empty ones. */
	function paddedDays(service: ServiceStatus): StatusDay[] {
		const byDay = new Map(service.days.map(day => [day.day, day]));
		const last = service.days.at(-1)?.day;
		if (!last) return [];
		const end = Date.parse(`${last}T12:00:00Z`);
		return Array.from({ length: DAYS }, (_, index) => {
			const day = new Date(end - (DAYS - 1 - index) * 86_400_000).toISOString().slice(0, 10);
			return byDay.get(day) ?? { day, status: 'no_data', degradedHours: 0, outageHours: 0, hours: 0, checks: { total: 0, failed: 0 }, peak: null };
		});
	}

	const affected = $derived(data?.services.filter(service => service.status === 'degraded' || service.status === 'outage') ?? []);
	const overall = $derived(affected.some(service => service.status === 'outage') ? 'outage' : affected.length ? 'degraded' : 'operational');
	const generatedAt = $derived(data ? new Date(data.generatedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : null);
	const since = $derived(data ? new Date(data.since).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' }) : null);

	function formatDay(day: string) {
		return new Date(`${day}T12:00:00Z`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	const hours = (count: number) => `${count} ${count === 1 ? 'hora' : 'horas'}`;
	const percent = (value: number) => `${(value * 100).toLocaleString('pt-PT', { maximumFractionDigits: value >= 0.995 && value < 1 ? 2 : 1 })}%`;

	function dayLines(day: StatusDay, reported: boolean): string[] {
		if (day.status === 'no_data') {
			if (data && day.day < data.since.slice(0, 10)) return ['Antes do novo sistema da GIRA'];
			return [reported ? 'Sem utilizadores suficientes nem verificações para avaliar' : 'Sem verificações neste dia'];
		}
		const lines: string[] = [];
		if (day.outageHours) lines.push(`Falha durante ${hours(day.outageHours)}`);
		if (day.degradedHours) lines.push(`Erros elevados durante ${hours(day.degradedHours)}`);
		if (!lines.length) lines.push('Sem problemas registados');
		if (day.peak) {
			const share = day.peak.active ? day.peak.affected / day.peak.active : 0;
			lines.push(`Pior hora: ${day.peak.affected} de ${day.peak.active} utilizadores com falhas (${percent(share)})`);
		}
		if (day.checks.total) {
			const ok = day.checks.total - day.checks.failed;
			lines.push(`Verificações: ${ok} de ${day.checks.total} com resposta`);
		}
		return lines;
	}

	/** The day pointed at, for the tooltip, with its centre in the bar; set by hover and by tap. */
	let pointed = $state<{ service: string; index: number; x: number } | null>(null);

	function point(service: string, index: number, event: PointerEvent) {
		const tick = event.currentTarget as HTMLElement;
		pointed = { service, index, x: tick.offsetLeft + tick.offsetWidth / 2 };
	}
</script>

<!-- A tap anywhere but on a day closes its tooltip on touch screens. -->
<svelte:window onpointerdown={event => { if (!(event.target instanceof Element && event.target.closest('[data-day]'))) pointed = null; }} />

<section id="servicos" class="mt-16 scroll-mt-20">
	<header class="mb-6">
		<h2 class="text-2xl font-bold">Estado dos serviços GIRA</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Disponibilidade dos servidores de que a GIRA depende, desde o novo sistema{since ? ` (${since})` : ''}, a partir das falhas que a app Gira+
			encontra e de verificações próprias. Uma hora conta com erros elevados quando pelo menos {REPORT_THRESHOLDS.degraded * 100}% dos utilizadores
			ativos (e no mínimo {REPORT_THRESHOLDS.minUsers}) tiveram falhas de ligação ou erros do servidor, e como falha a partir de
			{REPORT_THRESHOLDS.outage * 100}% ou quando o servidor deixa de responder.
		</p>
	</header>

	{#if loading && !data}
		<Card.Root><Card.CardContent class="flex h-40 items-center justify-center"><Spinner /></Card.CardContent></Card.Root>
	{:else if failure && !data}
		<Card.Root><Card.CardContent class="py-8 text-center text-destructive">Erro: {failure}</Card.CardContent></Card.Root>
	{:else if data}
		{@const Banner = STATUS[overall].icon}
		<Card.Root>
			<Card.CardContent class="p-0">
				<div class="flex items-center gap-3 border-b px-6 py-4">
					<Banner class="h-6 w-6 shrink-0" style="color: {colorOf(overall)}" />
					<div class="min-w-0 flex-1">
						<p class="font-semibold">
							{#if overall === 'operational'}
								Todos os serviços a funcionar
							{:else}
								{STATUS[overall].label}: {affected.map(service => SERVICES[service.id].label).join(', ')}
							{/if}
						</p>
						<p class="text-xs text-muted-foreground">Estado na última hora · atualizado às {generatedAt}</p>
					</div>
				</div>

				{#each data.services as service (service.id)}
					{@const definition = SERVICES[service.id]}
					{@const days = paddedDays(service)}
					{@const Icon = STATUS[service.status].icon}
					<div class="border-b px-6 py-5 last:border-0">
						<div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
							<div class="min-w-0">
								<h3 class="font-semibold">{definition.label}</h3>
								<p class="text-xs text-muted-foreground">{definition.description} <span class="font-mono">{definition.host}</span></p>
							</div>
							<span class="inline-flex items-center gap-1.5 text-sm font-medium">
								<Icon class="h-4 w-4" style="color: {colorOf(service.status)}" />
								{STATUS[service.status].label}
							</span>
						</div>

						<div class="relative">
							<div class="flex h-8 gap-[2px]" role="list" aria-label="Estado de {definition.label} por dia">
								{#each days as day, index (day.day)}
									<!-- Each day reads out its summary; pointing only adds the same as a tooltip. -->
									<div
										data-day
										role="listitem"
										class="h-full flex-1 cursor-default rounded-[2px] outline-offset-1 {index < DAYS - NARROW_DAYS ? 'hidden md:block' : ''}"
										class:outline={pointed?.service === service.id && pointed.index === index}
										class:outline-2={pointed?.service === service.id && pointed.index === index}
										class:outline-foreground={pointed?.service === service.id && pointed.index === index}
										style:background-color={colorOf(day.status)}
										aria-label="{formatDay(day.day)}: {dayLines(day, definition.reported).join('. ')}"
										onpointerenter={event => point(service.id, index, event)}
										onpointerdown={event => point(service.id, index, event)}
										onpointerleave={event => { if (event.pointerType === 'mouse') pointed = null; }}
									></div>
								{/each}
							</div>
							{#if pointed?.service === service.id}
								{@const day = days[pointed.index]}
								<!-- Above the day, kept inside the card at both ends. -->
								<div
									class="pointer-events-none absolute bottom-full z-10 mb-2 w-64 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md"
									style:left="clamp(0px, calc({pointed.x}px - 8rem), calc(100% - 16rem))"
								>
									<p class="mb-1 flex items-center gap-1.5 font-semibold">
										<span class="h-2 w-2 rounded-full" style:background-color={colorOf(day.status)}></span>
										{formatDay(day.day)}
									</p>
									{#each dayLines(day, definition.reported) as line, lineIndex (lineIndex)}
										<p class={lineIndex ? 'text-muted-foreground' : 'font-medium'}>{line}</p>
									{/each}
								</div>
							{/if}
						</div>

						<div class="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
							<span><span class="md:hidden">{NARROW_DAYS}</span><span class="hidden md:inline">{DAYS}</span> dias atrás</span>
							<span class="h-px flex-1 bg-border"></span>
							<span>{service.uptime == null ? 'Sem dados' : `${percent(service.uptime)} sem falhas`}</span>
							<span class="h-px flex-1 bg-border"></span>
							<span>Hoje</span>
						</div>
					</div>
				{/each}
			</Card.CardContent>
		</Card.Root>

		<Card.Root class="mt-4">
			<Card.CardHeader>
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<Card.CardTitle>Últimos 7 dias</Card.CardTitle>
						<Card.CardDescription>
							Utilizadores da app com falhas, em percentagem dos que a usaram em cada hora, e o tempo de resposta do servidor.
							Só contam falhas de ligação e erros do servidor, não pedidos recusados (como uma bicicleta avariada).
						</Card.CardDescription>
					</div>
					<Tabs.Root value={detail} onValueChange={value => { detail = value; }}>
						<Tabs.TabsList>
							{#each data.services as service (service.id)}
								<Tabs.TabsTrigger value={service.id}>{SERVICES[service.id].short}</Tabs.TabsTrigger>
							{/each}
						</Tabs.TabsList>
					</Tabs.Root>
				</div>
			</Card.CardHeader>
			<Card.CardContent>
				{@const service = data.services.find(candidate => candidate.id === detail)}
				{#if service}
					<ServiceHoursChart hours={service.hours} reported={SERVICES[service.id].reported} />
				{/if}
			</Card.CardContent>
		</Card.Root>
	{/if}
</section>
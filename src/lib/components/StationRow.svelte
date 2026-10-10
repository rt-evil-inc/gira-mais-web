<script lang="ts">
	import { mode } from 'mode-watcher';
	import { Bike, ChevronDown } from '@lucide/svelte';
	import { COLORS, REASON_LABELS, formatDuration, formatHours, listedStationOccupancy, stationService, statusColor, statusLabel, type SystemStation } from '$lib/gira-system';

	let { station, highlight = null, suspiciousAfterHours }: { station: SystemStation; highlight?: string | null; suspiciousAfterHours: number } = $props();

	/** Where Gira+ shows a battery as low. */
	const LOW_BATTERY = 20;

	let toggled = $state<boolean | null>(null);

	const dark = $derived($mode === 'dark');
	const missing = $derived(station.status === 'missing');
	const occupancy = $derived(listedStationOccupancy(station));
	/** Riders can't tell why a station is closed, so the badge only says whether it is; the why is in its tooltip. */
	const service = $derived(stationService(station.status));
	const serviceBadge = $derived({
		available: { label: 'Disponível', color: COLORS.good },
		unavailable: { label: 'Indisponível', color: COLORS.critical },
		missing: { label: 'Desaparecida', color: COLORS.grayDark },
	}[service.status]);
	const lowBattery = $derived(dark ? COLORS.critical.dark : COLORS.critical.light);
	const docked = $derived(station.bikes.filter(bike => bike.dock != null));
	/** Parked at the station but in none of its docks (bikes on a trip aren't listed at all). */
	const undocked = $derived(station.bikes.filter(bike => bike.dock == null));
	/** How long the idle station's record has gone unchanged, as of the latest poll. */
	const idleFor = $derived(station.idleSince ? formatDuration((Date.parse(station.lastSeenAt) - Date.parse(station.idleSince)) / 3_600_000) : null);
	const availableBikes = $derived(docked.filter(bike => bike.status === 'available').length);
	const holdsHighlight = $derived(highlight != null && station.bikes.some(bike => bike.visualId.toLowerCase() === highlight));
	// Opens by itself on the station holding a searched-for bike, until toggled by hand.
	const open = $derived(toggled ?? holdsHighlight);

	$effect(() => {
		// A new search resets what was toggled by hand.
		void highlight;
		toggled = null;
	});

	/** The station's docks split the way the docks chart splits them, in its order and colours. */
	const free = $derived(missing ? 0 : station.freeDocks - station.suspiciousDocks);
	const suspicious = $derived(missing ? 0 : station.suspiciousDocks);
	const segments = $derived([
		{ status: 'available_bike', count: availableBikes, label: 'com bicicleta disponível' },
		{ status: 'unavailable_bike', count: docked.length - availableBikes, label: 'com bicicleta indisponível' },
		{ status: 'free', count: free, label: free === 1 ? 'livre' : 'livres' },
		{ status: 'suspicious', count: suspicious, label: suspicious === 1 ? 'suspeita' : 'suspeitas' },
		{ status: 'unavailable', count: missing ? 0 : station.unavailableDocks, label: station.unavailableDocks === 1 ? 'indisponível' : 'indisponíveis' },
	]);

	function formatDay(value: string) {
		return new Date(value).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
	}

	/** "3, 7 e 12" */
	function list(items: string[]) {
		return items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items.at(-1)}` : items[0] ?? '';
	}
	const segmentTotal = $derived(Math.max(1, segments.reduce((total, segment) => total + segment.count, 0)));

	/**
	 * The server's reasons, minus the one the status already says and the generic "service status is not OK"
	 * that comes with nearly every flagged bike, unless it's the only one.
	 */
	function shownReasons(status: string, reasons: string[]) {
		const labels = reasons.map(reason => REASON_LABELS[reason] ?? reason).filter(label => label !== statusLabel('bikes', status));
		const specific = labels.filter(label => label !== REASON_LABELS['Service status is not OK']);
		return specific.length ? specific : labels;
	}

	function dockNumber(dock: string) {
		const number = parseInt(dock, 10);
		return Number.isNaN(number) ? dock : String(number);
	}

	function formatDate(value: string) {
		return new Date(value).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
	}

	const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
</script>

<div class="border-b last:border-0">
	<button
		class="grid w-full grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-x-4 gap-y-2 px-2 py-3 text-left transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1fr)_17rem_10.5rem_1rem]"
		class:opacity-60={missing}
		aria-expanded={open}
		onclick={() => { toggled = !open; }}
	>
		<div class="min-w-0">
			<!-- The name gives way on one line; the tag always shows whole. -->
			<p class="flex flex-wrap items-baseline gap-x-1 gap-y-1 font-medium leading-tight md:flex-nowrap">
				<span class="min-w-0 md:truncate">
					{#if station.number}<span class="mr-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{station.number}</span>{/if}
					{station.name}
				</span>
				{#if occupancy === 'empty' || occupancy === 'full' || occupancy === 'blocked' || occupancy === 'idle'}
					<span class="shrink-0 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
						<span class="mr-0.5 inline-block h-1.5 w-1.5 rounded-full align-[0.1em]" style:background-color={statusColor('occupancy', occupancy, dark)}></span>
						{occupancy === 'blocked' ? 'Vazia e cheia' : occupancy === 'idle' ? `Suspeita · sem atividade há ${idleFor}` : statusLabel('occupancy', occupancy)}
					</span>
				{/if}
			</p>
			{#if station.address}<p class="mt-1 truncate text-xs text-muted-foreground">{station.address}</p>{/if}
		</div>

		<div class="col-span-3 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
			{#if missing}
				<p class="text-xs text-muted-foreground">Desaparecida desde {formatDate(station.missingSince!)}</p>
			{:else}
				<div class="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={segments.map(segment => `${segment.count} ${segment.label}`).join(', ')}>
					{#each segments as segment (segment.status)}
						{#if segment.count}
							<div class="h-full" style:width="{segment.count / segmentTotal * 100}%" style:background-color={statusColor('docks', segment.status, dark)}></div>
						{/if}
					{/each}
				</div>
				<p class="mt-1 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
					<Bike class="inline h-3 w-3 align-[-0.15em]" aria-label="Bicicletas" /> {plural(availableBikes, 'disponível', 'disponíveis')} · {plural(free, 'livre', 'livres')}{#if suspicious}{' · '}<span class="font-medium text-foreground">{plural(suspicious, 'suspeita', 'suspeitas')}</span>{/if}
				</p>
			{/if}
		</div>

		<span class="inline-flex items-center gap-1.5 justify-self-end whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium md:justify-self-start" title={service.detail ?? undefined}>
			<span class="h-2 w-2 shrink-0 rounded-full" style:background-color={dark ? serviceBadge.color.dark : serviceBadge.color.light}></span>
			{serviceBadge.label}
		</span>

		<ChevronDown class="h-4 w-4 text-muted-foreground transition-transform {open ? 'rotate-180' : ''}" />
	</button>

	{#if open}
		<div class="px-2 pb-4">
			{#if missing}
				<p class="text-xs text-muted-foreground">
					Deixou de aparecer no sistema a {formatDate(station.missingSince!)}; vista pela última vez a {formatDate(station.lastSeenAt)}, com {station.dockLimit} docas.
				</p>
			{:else}
				<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
					<span class="font-medium text-foreground">{station.dockLimit} docas:</span>
					{#each segments as segment (segment.status)}
						{#if segment.count}
							<span class="inline-flex items-center gap-1">
								<span class="h-2 w-2 rounded-sm" style:background-color={statusColor('docks', segment.status, dark)}></span>
								<span><span class="font-medium tabular-nums text-foreground">{segment.count}</span> {segment.label}</span>
							</span>
						{/if}
					{/each}
				</div>
				{#if station.idleSince}
					<p class="mt-1 text-xs text-muted-foreground">
						Estação suspeita: o registo desta estação não muda desde {formatDate(station.idleSince)}, há {idleFor}. Nenhuma bicicleta chegou
						nem saiu desde então, embora o sistema a indique como disponível; é provável que não esteja a funcionar e que os números acima não
						estejam atualizados.
					</p>
				{/if}
				{#if service.status === 'unavailable'}
					<p class="mt-1 text-xs text-muted-foreground">
						Indisponível ({service.detail?.toLowerCase()}): não é possível levantar nem entregar bicicletas.
					</p>
				{/if}
				{#if station.availableBikes !== availableBikes}
					<p class="mt-1 text-xs text-muted-foreground">
						O contador do próprio sistema anuncia {plural(station.availableBikes, 'bicicleta disponível', 'bicicletas disponíveis')}.
					</p>
				{/if}
				{#if suspicious}
					<!-- Only when some are suspicious: at a station the system has closed, every dock is long empty. -->
					{@const count = station.longEmptyDocks.length + station.neverOccupiedDocks}
					{@const never = station.neverOccupiedDocks}
					<p class="mt-1 text-xs text-muted-foreground">
						{count === 1 ? 'Doca' : 'Docas'} sem bicicletas há mais de {formatHours(suspiciousAfterHours)}:
						{list([
							...station.longEmptyDocks.map(dock => `${dock.number} (última a ${formatDay(dock.lastOccupiedAt)})`),
							// Their numbers aren't known: the feed only names the docks bikes are in.
							...never ? [never === 1 ? '1 nunca vista com bicicleta' : `${never} nunca vistas com bicicleta`] : [],
						])}.
						{station.unavailableDocks ? `O sistema só indica ${plural(station.unavailableDocks, 'doca indisponível', 'docas indisponíveis')}, por isso` : 'O sistema não indica nenhuma doca indisponível, por isso'}
						{suspicious === 1 ? 'pelo menos 1 das que indica como livres está' : `pelo menos ${suspicious} das que indica como livres estão`} provavelmente {suspicious === 1 ? 'avariada' : 'avariadas'}.
					</p>
				{/if}

				{#if docked.length}
					<div class="mt-3 overflow-x-auto">
						<table class="w-full text-xs">
							<thead>
								<tr class="text-left text-muted-foreground">
									<th class="w-12 pb-1 font-medium">Doca</th>
									<th class="w-20 pb-1 font-medium">Bicicleta</th>
									<th class="w-16 pb-1 font-medium sm:w-24">Bateria</th>
									<th class="pb-1 font-medium">Estado</th>
								</tr>
							</thead>
							<tbody>
								{#each docked as bike (bike.visualId)}
									{@const reasons = shownReasons(bike.status, bike.reasons)}
									<tr class="border-t align-top" class:bg-muted={highlight != null && bike.visualId.toLowerCase() === highlight}>
										<td class="py-1.5 tabular-nums text-muted-foreground">{dockNumber(bike.dock!)}</td>
										<td class="py-1.5 font-medium">{bike.visualId}</td>
										<td class="py-1.5">
											{#if bike.battery != null}
												<span class="inline-flex items-center gap-1.5">
													<span class="relative hidden h-1.5 w-8 overflow-hidden rounded-full bg-muted-foreground/20 sm:inline-block">
														<span
															class="absolute inset-y-0 left-0 rounded-full bg-muted-foreground"
															style:width="{Math.min(100, Math.max(0, bike.battery))}%"
															style:background-color={bike.battery <= LOW_BATTERY ? lowBattery : undefined}
														></span>
													</span>
													<span class="tabular-nums" style:color={bike.battery <= LOW_BATTERY ? lowBattery : undefined}>{bike.battery}%</span>
												</span>
											{:else}
												<span class="text-muted-foreground">–</span>
											{/if}
										</td>
										<td class="py-1.5">
											<span class="inline-flex items-center gap-1.5 font-medium">
												<span class="h-2 w-2 shrink-0 rounded-full" style:background-color={statusColor('bikes', bike.status, dark)}></span>
												{statusLabel('bikes', bike.status)}
											</span>
											{#if bike.status !== 'available' && reasons.length}
												<span class="text-muted-foreground"> · {reasons.join(', ')}</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="mt-3 text-xs text-muted-foreground">Nenhuma bicicleta nas docas.</p>
				{/if}

				{#if undocked.length}
					<p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
						<span>{undocked.length === 1 ? '1 bicicleta na estação, sem doca:' : `${undocked.length} bicicletas na estação, sem doca:`}</span>
						{#each undocked as bike (bike.visualId)}
							<span class="inline-flex items-center gap-1" class:bg-muted={highlight != null && bike.visualId.toLowerCase() === highlight}>
								<span class="h-2 w-2 shrink-0 rounded-full" style:background-color={statusColor('bikes', bike.status, dark)}></span>
								<span class="font-medium text-foreground">{bike.visualId}</span>
								<!-- What the system has against the bike itself, as for docked ones. -->
								{#if bike.reasons.length}<span>({shownReasons(bike.status, bike.reasons).join(', ')})</span>{/if}
							</span>
						{/each}
					</p>
				{/if}
			{/if}
		</div>
	{/if}
</div>
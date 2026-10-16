<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount, untrack } from 'svelte';
	import { mode } from 'mode-watcher';
	import maplibre, { type ExpressionSpecification, type Map as MapLibre, type Popup } from 'maplibre-gl';
	import type { FeatureCollection } from 'geojson';
	import { Button } from '$lib/components/ui/button';
	import { COLORS, DOCK_STATUSES, formatDuration, listedStationOccupancy, stationDockSegments, stationService, statusColor, statusLabel, type SystemStation } from '$lib/gira-system';
	import { getMapStyle } from '$lib/map-style';

	let { stations, onshowinlist }: { stations: SystemStation[]; onshowinlist?: (station: SystemStation) => void } = $props();

	const LISBON: [number, number] = [-9.15, 38.74];
	/**
	 * Markers grow with the zoom, in two drawings: a dot over the whole city, and from RING.zoom a ring. Each stop is
	 * `size` px wide at its `zoom` and grows into the next. The drawing changes at a whole zoom: the map picks a
	 * marker's image when it loads its tile, and tiles change at whole zooms.
	 */
	const DOT = { zoom: 11.5, size: 14 };
	const RING = { zoom: 13, size: 24 };
	const STREET = { zoom: 15, size: 40 };
	const LARGEST = { zoom: 16.5, size: 48 };
	/** The size every ring is declared as, whatever size it's drawn at, so one scale sizes them all. */
	const IMAGE_SIZE = STREET.size;
	/**
	 * Each segment's number of docks, around the ring: a layer of its own that fades in between these zooms. The map
	 * doesn't draw a layer at no opacity, so there's nothing of it before them; it has no minimum zoom, though, or the
	 * numbers would only be laid out once the tiles of that zoom loaded, after the fade was due.
	 */
	const COUNTS = { from: 14, full: 15 };
	/** How far from the ring's centre its numbers sit, and the room they take past its rim, in the ring's units (it is 36 across). */
	const LABEL_RADIUS = 25.5;
	const LABEL_ROOM = 16;
	/** How much larger the selected station's ring is; it's never smaller than a ring. */
	const SELECTED_SCALE = 1.25;
	const NO_STATION: ExpressionSpecification = ['==', ['get', 'id'], -1];

	let container: HTMLDivElement;
	let popupContent: HTMLDivElement;
	let map = $state.raw<MapLibre | null>(null);
	let popup: Popup | null = null;
	/** The style the map was last given, and the one it has finished loading (null while it loads one): layers can only be added to a loaded style. */
	let givenStyle: 'light' | 'dark' = 'light';
	let loadedStyle = $state<'light' | 'dark' | null>(null);
	let fitted = false;
	let selectedId = $state<number | null>(null);

	const dark = $derived($mode === 'dark');
	/** Northernmost first, so where markers overlap the one further south is on top, as pins on a map are. */
	const located = $derived(stations.filter(station => station.latitude != null && station.longitude != null).sort((a, b) => b.latitude! - a.latitude!));
	const locatedIds = $derived(located.map(station => station.id).join(','));
	const selected = $derived(located.find(station => station.id === selectedId) ?? null);

	/** Stations nobody can use are faded. */
	const closed = (station: SystemStation) => stationService(station.status).status !== 'available';
	const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
	const zoomScale = (stops: [number, number][]): ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], ...stops.flat()];
	/** How wide (px) the selected station's marker is at a zoom, as the map's own scale between the stops has it. */
	function selectedSize(zoom: number) {
		const stops = [RING, STREET, LARGEST];
		const to = stops.find(stop => zoom < stop.zoom) ?? LARGEST;
		const from = stops[Math.max(0, stops.indexOf(to) - 1)];
		const progress = from === to ? 0 : Math.max(0, (zoom - from.zoom) / (to.zoom - from.zoom));
		return (from.size + (to.size - from.size) * progress) * SELECTED_SCALE;
	}

	/** The colour as ink on the map: the same hue, dark on the light map and light on the dark one. */
	function inkOf(color: string, dark: boolean) {
		const [red, green, blue] = [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16) / 255);
		const [max, min] = [Math.max(red, green, blue), Math.min(red, green, blue)];
		const spread = max - min;
		const hue = !spread ? 0 : max === red ? ((green - blue) / spread + 6) % 6 : max === green ? (blue - red) / spread + 2 : (red - green) / spread + 4;
		const lightness = (max + min) / 2;
		const saturation = spread ? spread / (1 - Math.abs(2 * lightness - 1)) : 0;
		return `hsl(${Math.round(hue * 60)} ${Math.round(Math.max(saturation, 0.55) * 100)}% ${dark ? 72 : 32}%)`;
	}

	/** The station's segments that have docks, with where each starts, as a fraction of the ring. */
	function ringSegments(station: SystemStation) {
		const segments = stationDockSegments(station).filter(segment => segment.count > 0);
		const total = segments.reduce((sum, segment) => sum + segment.count, 0);
		let start = 0;
		return segments.map(segment => {
			const placed = { ...segment, start, length: segment.count / total };
			start += placed.length;
			return placed;
		});
	}

	const turn = (fraction: number) => (fraction - 0.25) * Math.PI * 2;

	/**
	 * The station's docks bar from the list, bent into a ring: the same segments in the same order and colours,
	 * clockwise from the top, parted by thin lines. Drawn `size` px wide at twice that resolution.
	 */
	function drawRing(context: CanvasRenderingContext2D, station: SystemStation, dark: boolean, size: number) {
		const unit = size * 2 / 36;
		const pixels = Math.round(36 * unit);
		const colors = getComputedStyle(container);
		const background = `hsl(${colors.getPropertyValue('--background')})`;
		const segments = ringSegments(station);
		context.canvas.width = context.canvas.height = pixels;
		context.setTransform(unit, 0, 0, unit, pixels / 2, pixels / 2);

		context.beginPath();
		context.arc(0, 0, 17.5, 0, Math.PI * 2);
		context.fillStyle = background;
		context.fill();
		context.strokeStyle = `hsl(${colors.getPropertyValue('--foreground')} / 0.25)`;
		context.lineWidth = 1;
		context.stroke();

		context.lineWidth = 8;
		context.globalAlpha = closed(station) ? 0.45 : 1;
		for (const segment of segments) {
			context.beginPath();
			context.arc(0, 0, 12, turn(segment.start), turn(segment.start + segment.length));
			context.strokeStyle = statusColor('docks', segment.status, dark);
			context.stroke();
		}
		context.globalAlpha = 1;

		// The segments are parted by lines as wide at the rim as at the hole, rather than by gaps that widen outwards.
		if (segments.length > 1) {
			context.lineWidth = 1.3;
			context.strokeStyle = background;
			for (const { start } of segments) {
				context.beginPath();
				context.moveTo(Math.cos(turn(start)) * 7.5, Math.sin(turn(start)) * 7.5);
				context.lineTo(Math.cos(turn(start)) * 16.5, Math.sin(turn(start)) * 16.5);
				context.stroke();
			}
		}
		return context.getImageData(0, 0, pixels, pixels);
	}

	/**
	 * A number of docks, in its segment's colour, at the resolution the largest ring is drawn at. There's one image
	 * per number and colour, shared by every station: an image of its own numbers for each station had the map take
	 * twice as long to prepare its tiles.
	 */
	function drawCount(context: CanvasRenderingContext2D, text: string, color: string) {
		const unit = LARGEST.size * 2 / 36;
		const font = `700 ${9.5 * unit}px Inter, sans-serif`;
		const halo = 1.3 * unit;
		context.font = font;
		context.canvas.width = Math.ceil(context.measureText(text).width + halo * 2);
		context.canvas.height = Math.ceil(11 * unit + halo * 2);
		// Sizing the canvas resets what was set on it.
		context.font = font;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.lineJoin = 'round';
		context.lineWidth = halo * 2;
		context.strokeStyle = `hsl(${getComputedStyle(container).getPropertyValue('--background')})`;
		context.strokeText(text, context.canvas.width / 2, context.canvas.height / 2 + 0.5 * unit);
		context.fillStyle = color;
		context.fillText(text, context.canvas.width / 2, context.canvas.height / 2 + 0.5 * unit);
		return context.getImageData(0, 0, context.canvas.width, context.canvas.height);
	}

	/**
	 * The stations as sources drawn by the map itself, as the app's are: each ring is an image, so moving the map
	 * moves them with it at no cost. (As elements over the map, 200 of them tripled the work of every frame.)
	 * Stations with the same docks share an image. The numbers around the rings are a source of their own, a point
	 * each, placed by an offset from the station.
	 */
	function drawStations(map: MapLibre, stations: SystemStation[], dark: boolean) {
		const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
		const mode = dark ? 'dark' : 'light';
		const rings: FeatureCollection = { type: 'FeatureCollection', features: [] };
		const numbers: FeatureCollection = { type: 'FeatureCollection', features: [] };
		for (const station of stations) {
			const segments = ringSegments(station);
			const geometry = { type: 'Point' as const, coordinates: [station.longitude!, station.latitude!] };
			const image = `station-${mode}-${closed(station) ? 'closed-' : ''}${stationDockSegments(station).map(segment => segment.count).join('-')}`;
			if (!map.hasImage(`${image}-ring`)) {
				for (const [drawing, size] of [['dot', RING.size], ['ring', LARGEST.size]] as const) {
					map.addImage(`${image}-${drawing}`, drawRing(context, station, dark, size), { pixelRatio: 2 * size / IMAGE_SIZE });
				}
			}
			rings.features.push({ type: 'Feature', properties: { id: station.id, image }, geometry });

			// Numbers of neighbouring short segments are spread apart, so they don't sit on one another.
			const APART = 0.075;
			const angles = segments.map(segment => segment.start + segment.length / 2);
			for (let index = 1; index < angles.length; index++) angles[index] = Math.max(angles[index], angles[index - 1] + APART);
			for (let index = angles.length - 2; index >= 0; index--) angles[index] = Math.min(angles[index], angles[index + 1] - APART);
			segments.forEach((segment, index) => {
				const count = `count-${mode}-${segment.status}-${segment.count}`;
				if (!map.hasImage(count)) map.addImage(count, drawCount(context, String(segment.count), inkOf(statusColor('docks', segment.status, dark), dark)), { pixelRatio: 2 * LARGEST.size / IMAGE_SIZE });
				// From the station, in px for a ring as large as it's declared; the map scales it with the ring.
				const radius = LABEL_RADIUS / 36 * IMAGE_SIZE;
				numbers.features.push({
					type: 'Feature',
					properties: { id: station.id, image: count, offset: [Math.cos(turn(angles[index])) * radius, Math.sin(turn(angles[index])) * radius] },
					geometry,
				});
			});
		}

		const source = map.getSource('stations');
		const countsSource = map.getSource('station-counts');
		if (source instanceof maplibre.GeoJSONSource && countsSource instanceof maplibre.GeoJSONSource) {
			source.setData(rings);
			countsSource.setData(numbers);
			return;
		}
		map.addSource('stations', { type: 'geojson', data: rings });
		map.addSource('station-counts', { type: 'geojson', data: numbers });
		const icons = { 'icon-allow-overlap': true, 'icon-ignore-placement': true };
		const ring = { ...icons, 'icon-image': ['step', ['zoom'], ['concat', ['get', 'image'], '-dot'], RING.zoom, ['concat', ['get', 'image'], '-ring']] as ExpressionSpecification };
		const counts = { ...icons, 'icon-image': ['get', 'image'] as ExpressionSpecification, 'icon-offset': ['get', 'offset'] as ExpressionSpecification };
		const fadeIn = { 'icon-opacity': zoomScale([[COUNTS.from, 0], [COUNTS.full, 1]]) };
		const sizes = [DOT, RING, STREET, LARGEST].map(({ zoom, size }): [number, number] => [zoom, size / IMAGE_SIZE]);
		const selectedSizes = [RING, STREET, LARGEST].map(({ zoom, size }): [number, number] => [zoom, size * SELECTED_SCALE]);
		const selectedScale = zoomScale(selectedSizes.map(([zoom, size]) => [zoom, size / IMAGE_SIZE]));
		// One layer for both drawings: were they a layer each, handing over at a zoom, a fast zoom would cross it before
		// the tiles holding the next one had loaded, and the stations would vanish until they did.
		map.addLayer({ id: 'stations', type: 'symbol', source: 'stations', layout: { ...ring, 'icon-size': zoomScale(sizes) } });
		// The numbers are only ever looked at: clicks ask for the 'stations' layer alone.
		map.addLayer({ id: 'station-counts', type: 'symbol', source: 'station-counts', layout: { ...counts, 'icon-size': zoomScale(sizes) }, paint: fadeIn });
		// The selected station again, larger and outlined, above the rest at every zoom.
		map.addLayer({
			id: 'station-selected-outline',
			type: 'circle',
			source: 'stations',
			filter: NO_STATION,
			paint: {
				'circle-color': `hsl(${getComputedStyle(container).getPropertyValue('--foreground')})`,
				'circle-radius': zoomScale(selectedSizes.map(([zoom, size]) => [zoom, size / 2 + 1.5])),
			},
		});
		map.addLayer({ id: 'station-selected', type: 'symbol', source: 'stations', filter: NO_STATION, layout: { ...ring, 'icon-size': selectedScale } });
		map.addLayer({ id: 'station-selected-counts', type: 'symbol', source: 'station-counts', filter: NO_STATION, layout: { ...counts, 'icon-size': selectedScale }, paint: fadeIn });
	}

	onMount(() => {
		givenStyle = dark ? 'dark' : 'light';
		const created = new maplibre.Map({
			container,
			style: getMapStyle(givenStyle),
			center: LISBON,
			zoom: DOT.zoom,
			minZoom: 9,
			maxZoom: 18,
			dragRotate: false,
			pitchWithRotate: false,
			touchPitch: false,
			attributionControl: { compact: true },
			// The map sits in a page that scrolls: the wheel and one finger keep scrolling the page.
			cooperativeGestures: true,
			locale: {
				'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + scroll para aproximar o mapa',
				'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + scroll para aproximar o mapa',
				'CooperativeGesturesHandler.MobileHelpText': 'Usa dois dedos para mover o mapa',
				'NavigationControl.ZoomIn': 'Aproximar',
				'NavigationControl.ZoomOut': 'Afastar',
			},
		});
		created.touchZoomRotate.disableRotation();
		created.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
		// Fires for the first style and for each one set after it.
		created.on('style.load', () => { loadedStyle = givenStyle; });
		// A click on a station selects it, one anywhere else closes the popup; the topmost station under the click wins.
		created.on('click', event => {
			const [feature] = created.getLayer('stations') ? created.queryRenderedFeatures(event.point, { layers: ['stations'] }) : [];
			selectedId = feature?.properties.id ?? null;
		});
		created.on('mouseenter', 'stations', () => { created.getCanvas().style.cursor = 'pointer'; });
		created.on('mouseleave', 'stations', () => { created.getCanvas().style.cursor = ''; });
		// The popup sits just clear of the selected station's marker, whatever size the zoom makes it, and of its
		// numbers once they show.
		const popupOffset = (zoom: number) => selectedSize(zoom) / 2 * (zoom >= COUNTS.from ? (18 + LABEL_ROOM) / 18 : 1) + 6;
		created.on('zoom', () => popup?.setOffset(popupOffset(created.getZoom())));
		popup = new maplibre.Popup({ offset: popupOffset(DOT.zoom), maxWidth: '18rem', className: 'station-popup', closeOnClick: false })
			.setDOMContent(popupContent)
			.on('close', () => { selectedId = null; });
		map = created;
		return () => created.remove();
	});

	$effect(() => {
		const style = dark ? 'dark' : 'light';
		if (!map || !loadedStyle || style === loadedStyle) return;
		// A new style drops the stations' source and layers; they're drawn again once it has loaded.
		loadedStyle = null;
		givenStyle = style;
		map.setStyle(getMapStyle(style), { diff: false });
	});

	$effect(() => {
		if (!map || loadedStyle !== (dark ? 'dark' : 'light')) return;
		drawStations(map, located, dark);
	});

	// Frames the stations shown, again whenever a search or filter changes which ones they are.
	$effect(() => {
		if (!map || !locatedIds) return;
		const target = map;
		untrack(() => {
			const bounds = new maplibre.LngLatBounds;
			for (const station of located) bounds.extend([station.longitude!, station.latitude!]);
			target.fitBounds(bounds, { padding: 48, maxZoom: 15.5, duration: fitted ? 600 : 0 });
			fitted = true;
		});
	});

	$effect(() => {
		if (!map || !popup || !loadedStyle) return;
		const filter: ExpressionSpecification = selected ? ['==', ['get', 'id'], selected.id] : NO_STATION;
		for (const layer of ['station-selected-outline', 'station-selected', 'station-selected-counts']) if (map.getLayer(layer)) map.setFilter(layer, filter);
		// Its numbers move out with its larger ring, so the ones at the usual distance go.
		if (map.getLayer('station-counts')) map.setFilter('station-counts', selected ? ['!=', ['get', 'id'], selected.id] : null);
		if (!selected) {
			if (popup.isOpen()) popup.remove();
			return;
		}
		popup.setLngLat([selected.longitude!, selected.latitude!]);
		if (!popup.isOpen()) popup.addTo(map);
		// The station goes below the middle, leaving the popup above it room inside the map.
		map.easeTo({ center: [selected.longitude!, selected.latitude!], offset: [0, 100], duration: 400 });
	});
</script>

<div class="station-map">
	<div bind:this={container} class="h-[26rem] w-full overflow-hidden rounded-lg border sm:h-[36rem]"></div>

	<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
		{#each Object.keys(DOCK_STATUSES).filter(status => status !== 'missing') as status (status)}
			<span class="inline-flex items-center gap-1.5">
				<span class="h-2 w-2 rounded-sm" style:background-color={statusColor('docks', status, dark)}></span>
				{statusLabel('docks', status)}
			</span>
		{/each}
		{#if located.length < stations.length}
			<span class="sm:ml-auto">{plural(stations.length - located.length, 'estação sem localização', 'estações sem localização')}</span>
		{/if}
	</div>

	<!-- MapLibre moves this into its popup; it stays rendered so the popup always has it. -->
	<div class="hidden">
		<div bind:this={popupContent} class="text-sm">
			{#if selected}
				{@const occupancy = listedStationOccupancy(selected)}
				{@const service = stationService(selected.status)}
				{@const segments = stationDockSegments(selected)}
				<p class="pr-5 font-medium leading-tight">
					{#if selected.number}<span class="mr-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{selected.number}</span>{/if}
					{selected.name}
				</p>
				{#if selected.address}<p class="mt-1 text-xs text-muted-foreground">{selected.address}</p>{/if}
				<p class="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-medium">
					{#if service.status !== 'available'}
						{@const color = service.status === 'missing' ? COLORS.grayDark : COLORS.critical}
						<span class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5" title={service.detail ?? undefined}>
							<span class="h-2 w-2 rounded-full" style:background-color={dark ? color.dark : color.light}></span>
							{service.status === 'missing' ? 'Desaparecida' : 'Indisponível'}
						</span>
					{:else}
						<span class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5">
							<span class="h-2 w-2 rounded-full" style:background-color={statusColor('occupancy', occupancy, dark)}></span>
							{occupancy === 'ok' ? 'Disponível' : occupancy === 'blocked' ? 'Vazia e cheia' : statusLabel('occupancy', occupancy)}
						</span>
					{/if}
				</p>
				{#if selected.idleSince}
					<p class="mt-1 text-xs text-muted-foreground">
						Sem atividade há {formatDuration((Date.parse(selected.lastSeenAt) - Date.parse(selected.idleSince)) / 3_600_000)}.
					</p>
				{/if}
				{#if service.status !== 'missing'}
					<p class="mt-2 text-xs font-medium">{selected.dockLimit} docas</p>
					<ul class="mt-1 space-y-0.5 text-xs text-muted-foreground">
						{#each segments as segment (segment.status)}
							{#if segment.count}
								<li class="flex items-center gap-1.5">
									<span class="h-2 w-2 shrink-0 rounded-sm" style:background-color={statusColor('docks', segment.status, dark)}></span>
									<span><span class="font-medium tabular-nums text-foreground">{segment.count}</span> {segment.label}</span>
								</li>
							{/if}
						{/each}
					</ul>
				{/if}
				{#if onshowinlist}
					<Button variant="outline" size="sm" class="mt-3 h-7 w-full text-xs" onclick={() => onshowinlist(selected)}>Ver na lista</Button>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.station-map :global(.station-popup .maplibregl-popup-content) {
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		background: hsl(var(--popover));
		color: hsl(var(--popover-foreground));
		padding: 0.75rem;
		font-family: 'Inter', sans-serif;
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
	}
	/* Above the attribution, which would otherwise cover a popup near the map's bottom edge. */
	.station-map :global(.station-popup) {
		z-index: 3;
	}
	.station-map :global(.station-popup .maplibregl-popup-tip) {
		display: none;
	}
	.station-map :global(.station-popup .maplibregl-popup-close-button) {
		padding: 0.25rem 0.5rem;
		color: hsl(var(--muted-foreground));
		font-size: 1rem;
	}
</style>
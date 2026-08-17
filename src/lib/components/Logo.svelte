<script>
	import { cn } from '$lib/utils.js';
	import { cubicOut } from 'svelte/easing';
	import { draw, fade } from 'svelte/transition';

	let { class: className = '' } = $props();

	// Geometry lives here so the glow layer below can mirror the artwork without duplicating it.
	const shapes = [
		'M496.73 851.668C469.117 851.668 446.73 874.052 446.73 901.663C446.73 929.284 469.117 951.668 496.73 951.668C524.344 951.668 546.73 929.284 546.73 901.663C546.73 874.052 524.344 851.668 496.73 851.668Z',
		'M939.207 687.471C945.392 733.223 941.135 784.256 925.017 827.502C908.839 870.905 882.201 909.646 847.466 940.289C812.73 970.932 770.97 992.531 725.888 1003.17C683.355 1013.21 639.26 1012.96 597.148 1003.17L615.997 921.232C645.63 927.977 676.96 927.942 706.49 920.974C738.048 913.527 767.28 898.407 791.595 876.957C815.91 855.507 834.557 828.388 845.881 798.006C848.611 790.682 850.893 780.222 852.726 772.668H661.233V687.668H937.748L939.207 687.471Z',
		'M630.261 449.325C691.822 442.611 753.877 456.419 806.781 488.606L763 560.168C725.967 537.637 682.493 528.428 639.4 533.128C596.308 537.828 555.974 556.632 524.669 586.616C493.364 616.6 472.84 656.086 466.288 698.936C461.962 727.23 463.912 756.244 471.927 783.668L390.754 807.168C379.503 768.103 376.755 726.753 382.957 686.194C392.317 624.979 421.637 568.571 466.358 525.736C511.08 482.901 568.699 456.039 630.261 449.325Z',
	];
	const lines = [
		{ d: 'M931 471H1199', width: 74, duration: 500, delay: 1500 },
		{ d: 'M1065 338L1065 605', width: 74, duration: 500, delay: 1750 },
		{ d: 'M1064.5 730.5C1208.92 730.5 1326 616.922 1326 472.5C1326 328.078 1208.92 211 1064.5 211C971.365 211 888.326 262.188 842 335.5C788.418 311.715 724.901 297 662.5 297C610.327 297 560.311 306.238 514 323.168', width: 84, duration: 2000 },
		{ d: 'M1064.5 42C889.871 42 739.527 145.976 672 295.398', width: 84, duration: 2000 },
		{ d: 'M1444.5 270C1476.73 330.358 1495 399.295 1495 472.5C1495 710.259 1302.26 903 1064.5 903C1062.16 903 1060.3 903.037 1057.97 903L1057.85 903.272C991.078 1055.59 838.965 1162 662 1162C423.413 1162 230 968.587 230 730C230 637.057 259.351 550.969 309.29 480.5', width: 84, duration: 2000 },
		{ d: 'M42 730C42 387.583 319.583 110 662 110C712.603 110 761.789 116.062 808.874 127.5', width: 84, duration: 2000 },
		{ d: 'M414.5 1298.63C490.313 1331.67 574.016 1350 662 1350C832.141 1350 986.275 1281.46 1098.3 1170.5', width: 84, duration: 2000 },
	];
	const dots = [
		'M1181 1022C1153.39 1022 1131 1044.38 1131 1071.99C1131 1099.61 1153.39 1122 1181 1122C1208.61 1122 1231 1099.61 1231 1071.99C1231 1044.38 1208.61 1022 1181 1022Z',
		'M400 336C372.387 336 350 358.384 350 385.995C350 413.616 372.387 436 400 436C427.613 436 450 413.616 450 385.995C450 358.384 427.613 336 400 336Z',
	];

	const DOT_FADE = 1000;
	// Moment the last stroke lands, so the glow can wait for the artwork to stop moving.
	const drawDuration = Math.max(...lines.map(l => (l.delay ?? 0) + l.duration));

	let show = $state(false);
	let glowVisible = $state(false);

	$effect(() => {
		show = true;
		// A filtered element is re-rasterised on every frame its paint changes, and Firefox
		// rasterises SVG filters on the CPU, so drawing the strokes under the glow stutters
		// there. The strokes themselves are left unfiltered, and the glow is held back until
		// they have settled, then faded in on opacity alone.
		const timer = setTimeout(() => glowVisible = true, drawDuration);
		return () => clearTimeout(timer);
	});
</script>

<svg class={cn('overflow-visible', className)} viewBox="0 0 1537 1392" fill="none" xmlns="http://www.w3.org/2000/svg">
	<!-- Never animates, so this glow costs one rasterisation at load. -->
	<g class="glow">
		{#each shapes as d}
			<path {d} fill="#79C000" />
		{/each}
	</g>
	<!-- Mounted from the start so the opacity-0 state gets painted and the transition actually
		runs. The alpha animates on the outer group and the filter sits on the inner one, so the
		filtered content itself never changes and can be rasterised once and reused. -->
	<g class="deferred" class:visible={glowVisible}>
		<g class="glow">
			{#each lines as { d, width }}
				<path {d} stroke="#79C000" stroke-width={width} />
			{/each}
			{#each dots as d}
				<path {d} fill="#79C000" />
			{/each}
		</g>
	</g>
	{#if show}
		<!-- |global is required: these sit in an {#each}, and a local transition would be
			suppressed because the each-block is created by its parent, not on its own. -->
		{#each lines as { d, width, duration, delay = 0 }}
			<path in:draw|global={{ delay, duration, easing: cubicOut }} {d} stroke="#79C000" stroke-width={width} />
		{/each}
		{#each dots as d}
			<path in:fade|global={{ duration: DOT_FADE, easing: cubicOut }} {d} fill="#79C000" />
		{/each}
	{/if}
</svg>

<style>
	/* One pass over the whole group rather than one per path. Firefox rasterises SVG filters
	on the CPU, and nine blurs this wide take long enough that the transition below has mostly
	elapsed before the first frame can be painted, which reads as a pop. The alpha is raised
	because a single pass loses the accumulation that overlapping per-path shadows gave. */
	.glow {
		filter: drop-shadow(0 0 500px #79C000B3);
	}

	.deferred {
		opacity: 0;
		/* cubic-bezier here is the CSS equivalent of svelte/easing's cubicOut. */
		transition: opacity 1000ms cubic-bezier(0.33, 1, 0.68, 1);
	}

	.deferred.visible {
		opacity: 1;
	}
</style>
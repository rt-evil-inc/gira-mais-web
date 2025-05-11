<script>
	import { cn } from '$lib/utils.js';
	import { cubicOut } from 'svelte/easing';
	import { draw, fade } from 'svelte/transition';

	let { class: className = '' } = $props();

	let show = $state(false);

	$effect(() => { show = true; });
</script>

<svg class={cn('overflow-visible', className)} viewBox="0 0 1537 1392" fill="none" xmlns="http://www.w3.org/2000/svg">
	<path d="M1005.25 687.84H663.538V772.846H829.498C809.464 846.01 742.858 900.375 663.538 900.375C568.399 900.375 491.515 823.772 491.515 728.65C491.515 633.516 559.473 556.913 664.033 556.913V468C511.214 468 402.586 584.918 402.586 729.145C402.586 873.386 519.405 990.304 663.671 990.304C792.307 990.304 898.941 895.611 920.555 772.846H1005.25V687.84Z" fill="#79C000"/>
	{#if show}
		<path in:draw={{ delay: 1500, duration: 500, easing: cubicOut }} d="M931 471H1199" stroke="#79C000" stroke-width="74"/>
		<path in:draw={{ delay: 1750, duration: 500, easing: cubicOut }} d="M1065 338L1065 605" stroke="#79C000" stroke-width="74"/>
		<path in:draw={{ duration: 2000, easing: cubicOut }} d="M1064.5 730.5C1208.92 730.5 1326 616.922 1326 472.5C1326 328.078 1208.92 211 1064.5 211C971.365 211 888.326 262.188 842 335.5C788.418 311.715 724.901 297 662.5 297C610.327 297 560.311 306.238 514 323.168" stroke="#79C000" stroke-width="84"/>
		<path in:draw={{ duration: 2000, easing: cubicOut }} d="M1064.5 42C889.871 42 739.527 145.976 672 295.398" stroke="#79C000" stroke-width="84"/>
		<path in:draw={{ duration: 2000, easing: cubicOut }} d="M1444.5 270C1476.73 330.358 1495 399.295 1495 472.5C1495 710.259 1302.26 903 1064.5 903C1062.16 903 1060.3 903.037 1057.97 903L1057.85 903.272C991.078 1055.59 838.965 1162 662 1162C423.413 1162 230 968.587 230 730C230 637.057 259.351 550.969 309.29 480.5" stroke="#79C000" stroke-width="84"/>
		<path in:draw={{ duration: 2000, easing: cubicOut }} d="M42 730C42 387.583 319.583 110 662 110C712.603 110 761.789 116.062 808.874 127.5" stroke="#79C000" stroke-width="84"/>
		<path in:draw={{ duration: 2000, easing: cubicOut }} d="M414.5 1298.63C490.313 1331.67 574.016 1350 662 1350C832.141 1350 986.275 1281.47 1098.3 1170.5" stroke="#79C000" stroke-width="84"/>
		<path in:fade={{ duration: 1000, easing: cubicOut }} d="M1181 1022C1153.39 1022 1131 1044.38 1131 1072C1131 1099.62 1153.39 1122 1181 1122C1208.61 1122 1231 1099.62 1231 1072C1231 1044.38 1208.61 1022 1181 1022Z" fill="#79C000"/>
		<path in:fade={{ duration: 1000, easing: cubicOut }} d="M398 337C370.387 337 348 359.384 348 386.995C348 414.616 370.387 437 398 437C425.613 437 448 414.616 448 386.995C448 359.384 425.613 337 398 337Z" fill="#79C000"/>
	{/if}
</svg>

<style>
  path {
    filter: drop-shadow(0 0 500px #79C00088);
  }
</style>
<script lang="ts">
	/** The Gira+ app's dock, in the current colour, sized like the Lucide icons beside it. */
	let { class: className = '', 'aria-label': label }: { class?: string; 'aria-label'?: string } = $props();
</script>

<svg class={className} viewBox="41.5 14 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
	<path d="M50 53H74.3934M81 53H74.3934M74.3934 53L66.2623 28.2632M66.2623 28.2632H69.3115V23H63.2131V28.2632H66.2623Z" />
</svg>
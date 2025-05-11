<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	let { children } = $props();
</script>

<svelte:head>
	<title>Gira+</title>
</svelte:head>

<ModeWatcher />
<Toaster />

{@render children()}
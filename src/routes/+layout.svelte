<script lang="ts">
	import '../app.css';
	import { ModeWatcher, setMode, mode } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import Header from '$lib/components/Header.svelte';
	import { page } from '$app/state';
	import { browser } from '$app/environment';

	let { children } = $props();

	// Store the last mode in localStorage when it changes and we are not on the home page. Only in the browser: on the
	// server `mode` is one store shared by every request, so each render would stay subscribed, and in memory, for good.
	if (browser) {
		mode.subscribe(mode => {
			if (page.route.id !== '/') {
				localStorage.setItem('mode', mode || 'system');
			}
		});
	}

	// Apply mode based on route
	$effect(() => {
		if (!browser) return;
		if (page.route.id === '/') {
			setMode('dark');
		} else {
			const storedMode = localStorage.getItem('mode') as 'light' | 'dark' | 'system' | null;
			setMode(storedMode || 'system');
		}
	});
</script>

<svelte:head>
	<title>Gira+</title>
</svelte:head>

<ModeWatcher />
<Toaster />

<Header />
{@render children()}
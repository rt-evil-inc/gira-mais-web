<script lang="ts">
	import { untrack } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import Spinner from '$lib/components/Spinner.svelte';
	import { CHART_CARD } from '$lib/charts';
	import { timeAgo, type ErrorItem, type ErrorListResponse } from '$lib/admin';
	import { ChevronDown, ChevronRight, RefreshCw, Smartphone } from '@lucide/svelte';

	interface Props {
		/** The range and filters, as for /api/admin/errors. */
		query: string;
		tick: number;
		/** Filter by a device. */
		onDevice: (device: string) => void;
	}

	let { query, tick, onDevice }: Props = $props();

	let items = $state<ErrorItem[]>([]);
	let next = $state<string | null>(null);
	let loading = $state(false);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);
	let expanded = $state<number[]>([]);
	let loadedQuery: string | null = null;
	let controller: AbortController | null = null;
	/** Separate from controller, so a refresh doesn't cancel it; only new filters do. */
	let moreController: AbortController | null = null;

	async function fetchPage(signal: AbortSignal, before?: string) {
		const response = await fetch(`/api/admin/errors/list?${query}${before ? `&before=${before}` : ''}`, { signal });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return await response.json() as ErrorListResponse;
	}

	$effect(() => {
		void [query, tick];
		untrack(load);
	});

	/**
	 * New filters start the list over; a refresh with the same ones only adds the errors that arrived since, so the
	 * pages already loaded and the errors opened stay.
	 */
	async function load() {
		controller?.abort();
		controller = new AbortController;
		const refresh = loadedQuery === query && items.length > 0;
		if (!refresh) {
			loading = true;
			moreController?.abort();
		}
		try {
			const page = await fetchPage(controller.signal);
			const newest = items[0]?.id;
			// A refresh adds what arrived since, unless more arrived than a page holds: then it starts over, as
			// merging would leave a gap no page would fill.
			const gap = refresh && page.next !== null && page.errors.at(-1)!.id > newest;
			if (refresh && !gap) {
				items = [...page.errors.filter(item => item.id > newest), ...items];
			} else {
				items = page.errors;
				next = page.next;
				expanded = [];
			}
			loadedQuery = query;
			error = null;
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			error = err instanceof Error ? err.message : 'Erro desconhecido';
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (!next) return;
		loadingMore = true;
		moreController = new AbortController;
		try {
			const page = await fetchPage(moreController.signal, next);
			items = [...items, ...page.errors.filter(item => item.id < items[items.length - 1].id)];
			next = page.next;
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			error = err instanceof Error ? err.message : 'Erro desconhecido';
		} finally {
			loadingMore = false;
		}
	}

	function pretty(message: string | null) {
		if (!message) return '(sem mensagem)';
		try {
			return JSON.stringify(JSON.parse(message), null, 2);
		} catch {
			return message;
		}
	}
</script>

<Card.Root class={CHART_CARD.root}>
	<Card.CardHeader class={CHART_CARD.header}>
		<Card.CardTitle>Erros recentes</Card.CardTitle>
		<Card.CardDescription class="mt-1.5">Os erros que correspondem aos filtros, do mais recente para o mais antigo. Toque no dispositivo para ver só os erros dele.</Card.CardDescription>
	</Card.CardHeader>
	<Card.CardContent class={CHART_CARD.content}>
		{#if loading && items.length === 0}
			<div class="flex h-24 items-center justify-center"><Spinner /></div>
		{:else if error && items.length === 0}
			<p class="py-6 text-center text-sm text-destructive">Erro: {error}</p>
		{:else if items.length === 0}
			<p class="py-6 text-center text-sm text-muted-foreground">Nenhum erro no período</p>
		{:else}
			<ul class="divide-y transition-opacity {loading ? 'opacity-50' : ''}">
				{#each items as item (item.id)}
					{@const open = expanded.includes(item.id)}
					<li class="py-2 text-sm">
						<div class="flex items-start gap-2">
							<button type="button" class="mt-0.5 shrink-0 rounded hover:bg-muted" aria-label={open ? 'Fechar' : 'Abrir'} onclick={() => expanded = open ? expanded.filter(id => id !== item.id) : [...expanded, item.id]}>
								{#if open}<ChevronDown class="h-4 w-4" />{:else}<ChevronRight class="h-4 w-4" />{/if}
							</button>
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
									<Badge variant="outline" class="text-[10px] font-normal">{item.errorCode}</Badge>
									{#if item.userAgent}
										<span class="text-xs text-muted-foreground">{item.userAgent.replace('Gira+/', 'v')}</span>
									{/if}
									<button type="button" class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline" title={item.deviceId} onclick={() => onDevice(item.deviceId)}>
										<Smartphone class="h-3 w-3" />
										<span class="font-mono">{item.deviceId.slice(0, 8)}</span>
									</button>
									<span class="ml-auto text-xs text-muted-foreground" title={new Date(item.timestamp).toLocaleString('pt-PT')}>
										{timeAgo(item.timestamp)}
									</span>
								</div>
								{#if open}
									<pre class="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">{pretty(item.errorMessage)}</pre>
								{:else if item.errorMessage}
									<button type="button" class="mt-1 block w-full text-left" onclick={() => expanded = [...expanded, item.id]}>
										<p class="line-clamp-2 break-all font-mono text-xs text-muted-foreground">{item.errorMessage}</p>
									</button>
								{/if}
							</div>
						</div>
					</li>
				{/each}
			</ul>
			{#if next}
				<div class="pt-3 text-center">
					<Button variant="outline" size="sm" onclick={loadMore} disabled={loadingMore}>
						<RefreshCw class="h-4 w-4 {loadingMore ? 'animate-spin' : ''}" />
						Carregar mais
					</Button>
				</div>
			{/if}
		{/if}
	</Card.CardContent>
</Card.Root>
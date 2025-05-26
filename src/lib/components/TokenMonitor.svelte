<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { ChevronDown, ChevronRight, Search, RefreshCw, Clock, Smartphone } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { pt } from 'date-fns/locale';
	import { invalidate } from '$app/navigation';

	interface TokenSource {
		id: string;
		lastTokenAt: string;
		minutesAgo: number;
		tokenCount: number;
	}

	interface TokenRequest {
		id: string;
		timestamp: string;
		token: string;
	}

	interface TokenStats {
		total_tokens: number;
		assigned_tokens: number;
		available_tokens: number;
		valid_tokens: number;
		expired_unassigned: number;
		available_tokens_after_10_mins: number;
	}

	let { tokenSources, tokenStats }: { tokenSources: TokenSource[]; tokenStats: TokenStats } = $props();
	let openTokenSources = $state<string[]>([]);
	let selectedTokens = $state<{ [tokenSource: string]: TokenRequest[] }>({});
	let searchTerm = $state('');
	let isLoading = $state(false);
	let autoRefresh = $state(true);
	let refreshInterval: ReturnType<typeof setInterval>;

	const filteredTokenSources = $derived.by(() => {
		if (!searchTerm) return tokenSources;
		return tokenSources.filter(tokenSource => tokenSource.id.toLowerCase().includes(searchTerm.toLowerCase()));
	});

	async function loadTokenSources() {
		await Promise.all([
			invalidate('/api/admin/tokens'),
			invalidate('/api/token/stats'),
		]);
	}

	async function loadTokenSource(tokenSourceId: string) {
		try {
			const encodedTokenSourceId = encodeURIComponent(tokenSourceId);
			const res = await fetch(`/api/admin/tokens/${encodedTokenSourceId}/history`);
			if (!res.ok) throw new Error('Erro ao carregar histórico');

			const data: {
				tokens: {
					id: string;
					timestamp: string;
					token: string;
				}[];
				stats: {
					totalTokens: number;
				};
			} = await res.json();
			selectedTokens[tokenSourceId] = data.tokens;
		} catch (err) {
			console.error('Erro ao carregar histórico:', err);
		}
	}

	function toggleTokenSourceExpanded(tokenSourceId: string) {
		if (openTokenSources.includes(tokenSourceId)) {
			openTokenSources = openTokenSources.filter(id => id !== tokenSourceId);
		} else {
			openTokenSources = [...openTokenSources, tokenSourceId];
			if (!selectedTokens[tokenSourceId]) {
				loadTokenSource(tokenSourceId);
			}
		}
	}

	function formatTimestamp(timestamp: string) {
		return formatDistanceToNow(new Date(timestamp), {
			addSuffix: true,
			locale: pt,
		});
	}

	function getStatusColor(minutesAgo: number) {
		if (minutesAgo > 60) return 'text-destructive';
		if (minutesAgo > 30) return 'text-warning';
		return 'text-success';
	}

	function getStatusBadge(minutesAgo: number) {
		if (minutesAgo > 60) return { variant: 'destructive' as const, text: 'Inativo' };
		if (minutesAgo > 30) return { variant: 'secondary' as const, text: 'Atenção' };
		return { variant: 'default' as const, text: 'Ativo' };
	}

	// Auto refresh
	$effect(() => {
		if (autoRefresh) {
			refreshInterval = setInterval(loadTokenSources, 30000); // 30 seconds
			return () => clearInterval(refreshInterval);
		}
	});

// Initial load
</script>

<Card>
	<CardHeader>
		<div class="flex items-center justify-between">
			<div>
				<CardTitle class="flex items-center gap-2">
					<Smartphone class="h-5 w-5" />
					Monitorização de Tokens
				</CardTitle>
				<CardDescription>
					Monitore os seus tokens em tempo real
				</CardDescription>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={() => loadTokenSources()}
					disabled={isLoading}
				>
					<RefreshCw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
					Atualizar
				</Button>
			</div>
		</div>
	</CardHeader>
	<CardContent>
		<!-- Search and Filter -->
		<div class="mb-4 flex items-center gap-4">
			<div class="relative flex-1">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					bind:value={searchTerm}
					placeholder="Buscar por ID do telefone..."
					class="pl-9"
				/>
			</div>
			<Badge variant="outline">
				{filteredTokenSources.length} fonte{ filteredTokenSources.length !== 1 ? 's' : ''} de tokens
			</Badge>
		</div>

		<!-- Token Statistics Overview -->
		<div class="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
			<div class="bg-card border rounded-lg p-3">
				<div class="text-2xl font-bold text-foreground">{tokenStats.assigned_tokens}</div>
				<div class="text-xs text-muted-foreground">Tokens Atribuídos</div>
			</div>
			<div class="bg-card border rounded-lg p-3">
				<div class="text-2xl font-bold text-foreground">{tokenStats.available_tokens}</div>
				<div class="text-xs text-muted-foreground">Tokens Disponíveis</div>
			</div>
			<div class="bg-card border rounded-lg p-3">
				<div class="text-2xl font-bold text-foreground">{tokenStats.valid_tokens}</div>
				<div class="text-xs text-muted-foreground">Tokens Válidos</div>
			</div>
			<div class="bg-card border rounded-lg p-3">
				<div class="text-2xl font-bold text-foreground">{tokenStats.total_tokens}</div>
				<div class="text-xs text-muted-foreground">Total de Tokens</div>
			</div>
		</div>

		<!-- Token Source List -->
		<div class="space-y-2">
			{#each filteredTokenSources as tokenSource (tokenSource.id)}
				{@const statusBadge = getStatusBadge(tokenSource.minutesAgo)}
				<Card class="border">
					<CardContent class="p-2">
						<button
							class="w-full flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors cursor-pointer"
							onclick={() => toggleTokenSourceExpanded(tokenSource.id)}
						>
							<div class="flex items-center gap-3">
								<div class="flex items-center justify-center h-6 w-6">
									{#if openTokenSources.includes(tokenSource.id)}
										<ChevronDown class="h-4 w-4" />
									{:else}
										<ChevronRight class="h-4 w-4" />
									{/if}
								</div>
								<div class="text-left">
									<div class="font-medium">{tokenSource.id}</div>
									<div class="text-sm text-muted-foreground flex items-center gap-1">
										<Clock class="h-3 w-3" />
										Último token: {formatTimestamp(tokenSource.lastTokenAt)}
									</div>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<Badge variant={statusBadge.variant}>
									{statusBadge.text}
								</Badge>
								<div class="text-right">
									<div class="text-sm font-medium">{tokenSource.tokenCount} tokens</div>
									<div class="text-xs text-muted-foreground {getStatusColor(tokenSource.minutesAgo)}">
										{tokenSource.minutesAgo}min atrás
									</div>
								</div>
							</div>
						</button>

						<!-- Expanded Details -->
						{#if openTokenSources.includes(tokenSource.id)}
							<div class="mt-4 pt-4 border-t">
								{#if selectedTokens[tokenSource.id]}
									<!-- Recent Tokens -->
									<div>
										<h4 class="text-sm font-medium mb-3">Últimos 10 Tokens:</h4>
										<div class="space-y-2 max-h-64 overflow-y-auto">
											{#each selectedTokens[tokenSource.id] as token (token.id)}
												<div class="flex items-center justify-between p-2 bg-muted rounded text-xs">
													<div class="flex items-center gap-2">
														<span class="font-mono">...{token.token.slice(-32, -1)}</span>
													</div>
													<div class="text-muted-foreground">
														{formatTimestamp(token.timestamp)}
													</div>
												</div>
											{/each}
										</div>
									</div>
								{:else}
									<div class="text-center py-4 text-muted-foreground">
										Carregando histórico...
									</div>
								{/if}
							</div>
						{/if}
					</CardContent>
				</Card>
			{/each}

			{#if filteredTokenSources.length === 0}
				<div class="text-center py-8 text-muted-foreground">
					{searchTerm ? 'Nenhum telefone encontrado' : 'Nenhum telefone registrado'}
				</div>
			{/if}
		</div>
	</CardContent>
</Card>
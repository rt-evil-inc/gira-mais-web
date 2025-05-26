<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { ChevronDown, ChevronRight, Search, RefreshCw, Clock, Smartphone } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { pt } from 'date-fns/locale';

	interface TokenSource {
		id: string;
		lastTokenAt: string;
		minutesAgo: number;
		tokenCount: number;
		isExpanded?: boolean;
	}

	interface TokenRequest {
		id: string;
		timestamp: string;
		token: string;
	}

	let tokenSources = $state<TokenSource[]>([]);
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
		try {
			isLoading = true;
			const res = await fetch('/api/admin/tokens');
			if (!res.ok) throw new Error('Erro ao carregar telefones');

			const data = await res.json();
			tokenSources = data.tokenSources.map((tokenSource: TokenSource) => ({
				...tokenSource,
				isExpanded: tokenSources.find(p => p.id === tokenSource.id)?.isExpanded || false,
			}));
		} catch (err) {
			console.error('Erro ao carregar telefones:', err);
		} finally {
			isLoading = false;
		}
	}

	async function loadTokenSource(tokenSourceId: string) {
		try {
			const res = await fetch(`/api/admin/tokens/${tokenSourceId}/history`);
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
		const tokenSource = tokenSources.find(p => p.id === tokenSourceId);
		if (tokenSource) {
			tokenSource.isExpanded = !tokenSource.isExpanded;
			if (tokenSource.isExpanded && !selectedTokens[tokenSourceId]) {
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
	$effect(() => {
		loadTokenSources();
	});
</script>

<Card>
	<CardHeader>
		<div class="flex items-center justify-between">
			<div>
				<CardTitle class="flex items-center gap-2">
					<Smartphone class="h-5 w-5" />
					Monitoramento de Tokens
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
				{filteredTokenSources.length} telefones
			</Badge>
		</div>

		<!-- Token Source List -->
		<div class="space-y-2">
			{#each filteredTokenSources as tokenSource (tokenSource.id)}
				{@const statusBadge = getStatusBadge(tokenSource.minutesAgo)}
				<Card class="border">
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<Button
									variant="ghost"
									size="sm"
									class="h-6 w-6 p-0"
									onclick={() => toggleTokenSourceExpanded(tokenSource.id)}
								>
									{#if tokenSource.isExpanded}
										<ChevronDown class="h-4 w-4" />
									{:else}
										<ChevronRight class="h-4 w-4" />
									{/if}
								</Button>
								<div>
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
						</div>

						<!-- Expanded Details -->
						{#if tokenSource.isExpanded}
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
<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { AlertTriangle, RefreshCw, Smartphone, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { pt } from 'date-fns/locale';
	import { invalidate } from '$app/navigation';
	import StatisticsChart from '$lib/components/AreaChart.svelte';
	import StatisticsControls from '$lib/components/StatisticsControls.svelte';
	import { getLocalTimeZone, today } from '@internationalized/date';

	interface ErrorItem {
		id: number;
		deviceId: string;
		timestamp: string;
		errorCode: string;
		errorMessage: string | null;
	}

	interface ErrorData {
		errorCount: number;
		errors: ErrorItem[];
	}

	let {
		errorData,
	}: {
		errorData: ErrorData;
	} = $props();

	// Internal state for chart controls
	let interval = $state({
		start: today(getLocalTimeZone()).add({ days: -7 }),
		end: today(getLocalTimeZone()),
	});
	let groupBy = $state('hour');

	// State for collapsible and pagination
	let isErrorListCollapsed = $state(false);
	let currentPage = $state(1);
	const errorsPerPage = 5;

	// Computed values for pagination
	const totalPages = $derived(Math.ceil(errorData.errors.length / errorsPerPage));
	const startIndex = $derived((currentPage - 1) * errorsPerPage);
	const endIndex = $derived(startIndex + errorsPerPage);
	const paginatedErrors = $derived(errorData.errors.slice(startIndex, endIndex));

	function goToPage(page: number) {
		currentPage = Math.max(1, Math.min(page, totalPages));
	}

	function toggleErrorList() {
		isErrorListCollapsed = !isErrorListCollapsed;
	}
</script>

<Card class="h-full">
	<CardHeader>
		<div class="flex items-center justify-between">
			<div>
				<CardTitle class="flex items-center gap-2">
					<AlertTriangle class="h-5 w-5 text-orange-500" />
					Erros
				</CardTitle>
				<CardDescription>
					Número de erros ao longo do tempo e lista de erros recentes
				</CardDescription>
			</div>
			<div class="flex items-center gap-2">
				<Badge variant="outline" class="text-lg px-3 py-1">
					{errorData.errorCount} nas últimas 24h
				</Badge>
				<Button
					variant="outline"
					size="sm"
					onclick={() => invalidate('/api/admin/errors')}
				>
					<RefreshCw class="h-4 w-4" />
					Atualizar
				</Button>
			</div>
		</div>
	</CardHeader>

	<CardContent class="space-y-6">
		<!-- Chart Controls -->
		<div>
			<StatisticsControls bind:interval bind:groupBy />
		</div>

		<!-- Chart Section -->
		<div>
			<StatisticsChart endpoint="admin/errors" colorProperty="--warning" {interval} {groupBy}
				title="Erros"
				description="Número de erros ao longo do tempo"
			/>
		</div>

		<!-- Error List Section -->
		<div class="border-t pt-6">
			{#if errorData.errorCount === 0}
				<div class="text-center py-8 text-muted-foreground">
					<AlertTriangle class="h-12 w-12 mx-auto mb-4 text-primary" />
					<p class="text-lg font-medium text-primary">Nenhum erro nas últimas 24 horas!</p>
					<p class="text-sm">Sistema a funcionar sem erros</p>
				</div>
			{:else}
				<div class="space-y-4">
					<button
						class="w-full flex items-center justify-between p-2 -m-2 rounded hover:bg-muted/50 transition-colors cursor-pointer"
						onclick={toggleErrorList}
					>
						<div class="flex items-center gap-2">
							<h3 class="text-lg font-semibold">Erros Recentes</h3>
							{#if isErrorListCollapsed}
								<ChevronDown class="h-4 w-4" />
							{:else}
								<ChevronUp class="h-4 w-4" />
							{/if}
						</div>
						<p class="text-sm text-muted-foreground">
							{errorData.errors.length} erros mais recentes (de {errorData.errorCount} total)
						</p>
					</button>

					{#if !isErrorListCollapsed}
						<div class="space-y-2 max-h-96 overflow-y-auto">
							{#each paginatedErrors as errorItem (errorItem.id)}
								<div class="border rounded-lg p-3 bg-background border-border">
									<div class="flex items-start justify-between gap-3">
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 mb-1">
												<Badge variant="outline" class="text-xs">
													{errorItem.errorCode}
												</Badge>
												<div class="flex items-center gap-1 text-xs text-muted-foreground">
													<Smartphone class="h-3 w-3" />
													{errorItem.deviceId}
												</div>
											</div>
											{#if errorItem.errorMessage}
												<p class="text-sm text-foreground break-words">
													{errorItem.errorMessage}
												</p>
											{/if}
										</div>
										<div class="text-xs text-muted-foreground whitespace-nowrap">
											{formatDistanceToNow(new Date(errorItem.timestamp), {
												addSuffix: true,
												locale: pt,
											})}
										</div>
									</div>
								</div>
							{/each}
						</div>

						<!-- Pagination Controls -->
						{#if totalPages > 1}
							<div class="flex items-center justify-between pt-4 border-t">
								<div class="text-sm text-muted-foreground">
									Página {currentPage} de {totalPages} ({errorData.errors.length} erros)
								</div>
								<div class="flex items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										onclick={() => goToPage(currentPage - 1)}
										disabled={currentPage === 1}
									>
										<ChevronLeft class="h-4 w-4" />
										Anterior
									</Button>
									<Button
										variant="outline"
										size="sm"
										onclick={() => goToPage(currentPage + 1)}
										disabled={currentPage === totalPages}
									>
										Próxima
										<ChevronRight class="h-4 w-4" />
									</Button>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	</CardContent>
</Card>
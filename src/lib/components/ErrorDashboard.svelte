<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { AlertTriangle, RefreshCw, Smartphone, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Filter, X } from 'lucide-svelte';
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
		userAgent: string | null;
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

	// State for filtering
	let ignoreGiraApiErrors = $state(false);
	let selectedVersions = $state<string[]>([]);

	// Get unique app versions from errors
	const availableVersions = $derived(() => {
		const versions = new Set<string>;
		errorData.errors.forEach(error => {
			if (error.userAgent) {
				const version = error.userAgent.replace('Gira+/', '');
				if (version && version !== error.userAgent) {
					versions.add(version);
				}
			}
		});
		return Array.from(versions).sort();
	});

	// Filter errors based on current filters
	const filteredErrors = $derived(() => {
		return errorData.errors.filter(error => {
			// Filter out gira_api_error if checkbox is checked
			if (ignoreGiraApiErrors && error.errorCode === 'gira_api_error') {
				return false;
			}

			// Filter by selected versions (if any are selected)
			if (selectedVersions.length > 0 && error.userAgent) {
				const version = error.userAgent.replace('Gira+/', '');
				if (!selectedVersions.includes(version)) {
					return false;
				}
			}

			return true;
		});
	});

	// Update pagination to use filtered errors
	const totalPages = $derived(Math.ceil(filteredErrors().length / errorsPerPage));
	const startIndex = $derived((currentPage - 1) * errorsPerPage);
	const endIndex = $derived(startIndex + errorsPerPage);
	const paginatedErrors = $derived(filteredErrors().slice(startIndex, endIndex));

	function goToPage(page: number) {
		currentPage = Math.max(1, Math.min(page, totalPages));
	}

	function toggleErrorList() {
		isErrorListCollapsed = !isErrorListCollapsed;
	}

	function toggleVersionSelection(version: string) {
		if (selectedVersions.includes(version)) {
			selectedVersions = selectedVersions.filter(v => v !== version);
		} else {
			selectedVersions = [...selectedVersions, version];
		}
		// Reset to first page when filters change
		currentPage = 1;
	}

	function clearVersionFilters() {
		selectedVersions = [];
		currentPage = 1;
	}

	function toggleIgnoreGiraApiErrors() {
		ignoreGiraApiErrors = !ignoreGiraApiErrors;
		currentPage = 1;
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
					{errorData.errorCount} nas últimas 72h
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

		<!-- Filters Section -->
		<div class="border rounded-lg p-4 bg-muted/30">
			<div class="flex items-center gap-2 mb-3">
				<Filter class="h-4 w-4" />
				<h4 class="text-sm font-medium">Filtros</h4>
			</div>

			<div class="flex flex-col sm:flex-row gap-4">
				<!-- Ignore Gira API Errors Checkbox -->
				<div class="flex items-center space-x-2">
					<Checkbox
						id="ignore-gira-api"
						checked={ignoreGiraApiErrors}
						onCheckedChange={toggleIgnoreGiraApiErrors}
					/>
					<label
						for="ignore-gira-api"
						class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
					>
						Ignorar erros gira_api_error
					</label>
				</div>

				<!-- App Version Multi-Select -->
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium">Versões da app:</span>
					<Popover>
						<PopoverTrigger
							class="inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-[200px] hover:bg-accent hover:text-accent-foreground"
						>
							{#if selectedVersions.length === 0}
								Todas as versões
							{:else if selectedVersions.length === 1}
								{selectedVersions[0]}
							{:else}
								{selectedVersions.length} versões selecionadas
							{/if}
							<ChevronDown class="ml-2 h-4 w-4" />
						</PopoverTrigger>
						<PopoverContent class="w-[300px] p-3">
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<h5 class="text-sm font-medium">Versões da app</h5>
									{#if selectedVersions.length > 0}
										<Button
											variant="ghost"
											size="sm"
											onclick={clearVersionFilters}
											class="h-auto p-1 text-xs"
										>
											<X class="h-3 w-3 mr-1" />
											Limpar
										</Button>
									{/if}
								</div>

								<div class="max-h-48 overflow-y-auto space-y-2">
									{#each availableVersions() as version}
										<div class="flex items-center space-x-2">
											<Checkbox
												id="version-{version}"
												checked={selectedVersions.includes(version)}
												onCheckedChange={() => toggleVersionSelection(version)}
											/>
											<label
												for="version-{version}"
												class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
											>
												{version}
											</label>
										</div>
									{/each}

									{#if availableVersions().length === 0}
										<p class="text-sm text-muted-foreground">Nenhuma versão encontrada</p>
									{/if}
								</div>
							</div>
						</PopoverContent>
					</Popover>
				</div>
			</div>

			<!-- Active Filters Summary -->
			{#if ignoreGiraApiErrors || selectedVersions.length > 0}
				<div class="flex items-center gap-2 mt-3 pt-3 border-t">
					<span class="text-xs text-muted-foreground">Filtros ativos:</span>
					<div class="flex flex-wrap gap-1">
						{#if ignoreGiraApiErrors}
							<Badge variant="secondary" class="text-xs">
								ignorar gira_api_error
								<button
									class="ml-1 hover:bg-muted rounded-full"
									onclick={toggleIgnoreGiraApiErrors}
								>
									<X class="h-3 w-3" />
								</button>
							</Badge>
						{/if}
						{#each selectedVersions as version}
							<Badge variant="secondary" class="text-xs">
								{version}
								<button
									class="ml-1 hover:bg-muted rounded-full"
									onclick={() => toggleVersionSelection(version)}
								>
									<X class="h-3 w-3" />
								</button>
							</Badge>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Error List Section -->
		<div class="border-t pt-6">
			{#if errorData.errorCount === 0}
				<div class="text-center py-8 text-muted-foreground">
					<AlertTriangle class="h-12 w-12 mx-auto mb-4 text-primary" />
					<p class="text-lg font-medium text-primary">Nenhum erro nas últimas 72 horas!</p>
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
							{filteredErrors().length} erros exibidos (de {errorData.errors.length} total)
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
													<span title={errorItem.deviceId} class="cursor-help font-mono">
														{errorItem.deviceId.length > 8 ?
															`${errorItem.deviceId.slice(0, 8)}...` : errorItem.deviceId}
													</span>
												</div>
												{#if errorItem.userAgent}
													<Badge variant="secondary" class="text-xs bg-muted text-muted-foreground">
														{errorItem.userAgent.replace('Gira+/', '')}
													</Badge>
												{/if}
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
									Página {currentPage} de {totalPages} ({filteredErrors().length} erros filtrados)
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
<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button, buttonVariants } from '$lib/components/ui/button';
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
	let selectedErrorCodes = $state<string[]>([]);
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

	// Get unique error codes from errors
	const availableErrorCodes = $derived(() => {
		const errorCodes = new Set<string>;
		errorData.errors.forEach(error => {
			if (error.errorCode) {
				errorCodes.add(error.errorCode);
			}
		});
		return Array.from(errorCodes).sort();
	});

	$effect(() => {
		// Pre-select all error codes except for the ignored ones
		selectedErrorCodes = availableErrorCodes().filter(
			code => code !== 'gira_api_error' && code !== 'no_tokens_available_error' && code !== 'token_fetch_error',
		);
	});

	// Filter errors based on current filters
	const filteredErrors = $derived(() => {
		return errorData.errors.filter(error => {
			// Filter by selected error codes
			if (selectedErrorCodes.length > 0 && !selectedErrorCodes.includes(error.errorCode)) {
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

	function toggleErrorCodeSelection(errorCode: string) {
		if (selectedErrorCodes.includes(errorCode)) {
			selectedErrorCodes = selectedErrorCodes.filter(c => c !== errorCode);
		} else {
			selectedErrorCodes = [...selectedErrorCodes, errorCode];
		}
		currentPage = 1;
	}

	function clearErrorCodeFilters() {
		selectedErrorCodes = [];
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
		<!-- Filters Section -->
		<div class="border rounded-lg p-4 bg-muted/30">
			<div class="flex items-center gap-2 mb-3">
				<Filter class="h-4 w-4" />
				<h4 class="text-sm font-medium">Filtros</h4>
			</div>

			<div class="flex flex-col sm:flex-row gap-4">
				<!-- Error Code Multi-Select -->
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium">Tipos de Erro:</span>
					<Popover>
						<PopoverTrigger
							class={buttonVariants({ variant: 'outline', size: 'sm' })}
						>
							{#if selectedErrorCodes.length === 0}
								Todos os tipos
							{:else if selectedErrorCodes.length === 1}
								{selectedErrorCodes[0]}
							{:else}
								{selectedErrorCodes.length} tipos selecionados
							{/if}
							<ChevronDown class="ml-2 h-4 w-4" />
						</PopoverTrigger>
						<PopoverContent class="w-[300px] p-3">
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<h5 class="text-sm font-medium">Tipos de Erro</h5>
									{#if selectedErrorCodes.length > 0}
										<Button
											variant="ghost"
											size="sm"
											onclick={clearErrorCodeFilters}
											class="h-auto p-1 text-xs"
										>
											<X class="h-3 w-3 mr-1" />
											Limpar
										</Button>
									{/if}
								</div>

								<div class="max-h-48 overflow-y-auto space-y-2">
									{#each availableErrorCodes() as errorCode}
										<div class="flex items-center space-x-2">
											<Checkbox
												id="error-code-{errorCode}"
												checked={selectedErrorCodes.includes(errorCode)}
												onCheckedChange={() => toggleErrorCodeSelection(errorCode)}
											/>
											<label
												for="error-code-{errorCode}"
												class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
											>
												{errorCode}
											</label>
										</div>
									{/each}

									{#if availableErrorCodes().length === 0}
										<p class="text-sm text-muted-foreground">Nenhum tipo de erro encontrado</p>
									{/if}
								</div>
							</div>
						</PopoverContent>
					</Popover>
				</div>

				<!-- App Version Multi-Select -->
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium">Versões da app:</span>
					<Popover>
						<PopoverTrigger
							class={buttonVariants({ variant: 'outline', size: 'sm' })}
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
			{#if selectedErrorCodes.length > 0 || selectedVersions.length > 0}
				<div class="flex items-center gap-2 mt-3 pt-3 border-t">
					<span class="text-xs text-muted-foreground">Filtros ativos:</span>
					<div class="flex flex-wrap gap-1">
						{#each selectedErrorCodes as errorCode}
							<Badge variant="secondary" class="text-xs">
								{errorCode}
								<button
									class="ml-1 hover:bg-muted rounded-full"
									onclick={() => toggleErrorCodeSelection(errorCode)}
								>
									<X class="h-3 w-3" />
								</button>
							</Badge>
						{/each}
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

		<!-- Chart Controls -->
		<StatisticsControls bind:interval bind:groupBy />

		<!-- Chart Section -->
		<div>
			<StatisticsChart
				endpoint={`admin/errors?${selectedErrorCodes.map(c => `errorCodes=${c}`).join('&')}&${selectedVersions.map(v => `versions=${v}`).join('&')}`}
				colorProperty="--warning"
				{interval}
				{groupBy}
				title="Erros"
				description="Número de erros ao longo do tempo"
			/>
		</div>

		<!-- Error List Section -->
		<div>
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
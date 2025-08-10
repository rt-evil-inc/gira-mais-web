<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	interface Props {
		title: string;
		value?: number;
		loading?: boolean;
		error?: string;
		icon?: any;
		description?: string;
	}

	let { title, value, loading = false, error, icon, description }: Props = $props();

	function formatNumber(num: number): string {
		return new Intl.NumberFormat('pt-PT').format(num);
	}
</script>

<Card.Root class="h-full">
	<Card.CardContent class="p-6">
		<div class="flex items-center justify-between">
			<div class="flex-1">
				<div class="flex items-center gap-2 mb-3">
					{#if icon}
						{@const IconComponent = icon}
						<IconComponent class="h-6 w-6 text-muted-foreground" />
					{/if}
					<h3 class="text-lg font-semibold">{title}</h3>
				</div>

				{#if loading}
					<div class="space-y-3">
						<div class="h-10 w-28 bg-muted animate-pulse rounded"></div>
						{#if description}
							<div class="h-4 bg-muted animate-pulse rounded w-3/4"></div>
						{/if}
					</div>
				{:else if error}
					<div class="text-3xl font-bold text-destructive mb-2">Erro</div>
					<p class="text-xs text-muted-foreground/70">{error}</p>
				{:else if value !== undefined}
					<div class="text-4xl font-bold mb-2">{formatNumber(value)}</div>
					{#if description}
						<p class="text-sm text-muted-foreground">{description}</p>
					{/if}
				{:else}
					<div class="text-4xl font-bold text-muted-foreground mb-2">-</div>
					{#if description}
						<p class="text-xs text-muted-foreground/70">{description}</p>
					{/if}
				{/if}
			</div>
		</div>
	</Card.CardContent>
</Card.Root>
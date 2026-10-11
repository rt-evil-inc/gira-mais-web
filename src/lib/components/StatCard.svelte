<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	interface Props {
		title: string;
		value?: number;
		/** Shown after the value as "value/total". */
		total?: number;
		loading?: boolean;
		error?: string;
		icon?: any;
		description?: string;
		/** Smaller, for a row of secondary figures; on phones, just the title and the value. */
		compact?: boolean;
	}

	let { title, value, total, loading = false, error, icon, description, compact = false }: Props = $props();

	function formatNumber(num: number): string {
		return new Intl.NumberFormat('pt-PT').format(num);
	}

	/** Every card is smaller on phones; compact ones also leave out the icon and description there, and keep their values level. */
	const size = $derived(compact ? {
		header: 'mb-2 sm:mb-1',
		icon: 'hidden h-4 w-4 sm:block',
		title: 'text-xs font-medium text-muted-foreground sm:text-sm',
		value: 'mt-auto text-xl sm:mt-0 sm:mb-1 sm:text-2xl',
		description: 'hidden text-xs sm:block',
		placeholder: 'mt-auto h-7 w-16 sm:mt-0 sm:h-8 sm:w-20',
	} : {
		header: 'mb-1 sm:mb-3',
		icon: 'h-4 w-4 sm:h-6 sm:w-6',
		title: 'text-sm font-semibold sm:text-lg',
		value: 'mb-1 text-2xl sm:mb-2 sm:text-4xl',
		description: 'text-xs sm:text-sm',
		placeholder: 'h-8 w-20 sm:h-10 sm:w-28',
	});
</script>

<Card.Root class="h-full">
	<Card.CardContent class="flex h-full flex-col p-3 {compact ? 'sm:p-4' : 'sm:p-6'}">
		<div class="flex items-center gap-2 {size.header}">
			{#if icon}
				{@const IconComponent = icon}
				<IconComponent class="{size.icon} shrink-0 text-muted-foreground" />
			{/if}
			<h3 class={size.title}>{title}</h3>
		</div>

		{#if loading}
			<div class="{size.placeholder} bg-muted animate-pulse rounded"></div>
			{#if description}
				<div class="{size.description} mt-2 h-4 bg-muted animate-pulse rounded w-3/4"></div>
			{/if}
		{:else if error}
			<div class="{size.value} font-bold text-destructive">Erro</div>
			<p class="text-xs text-muted-foreground/70">{error}</p>
		{:else if value !== undefined}
			<div class="{size.value} font-bold">
				{formatNumber(value)}{#if total !== undefined}<span class="text-base font-semibold text-muted-foreground/70 sm:text-2xl">/{formatNumber(total)}</span>{/if}
			</div>
			{#if description}
				<p class="{size.description} text-muted-foreground">{description}</p>
			{/if}
		{:else}
			<div class="{size.value} font-bold text-muted-foreground">-</div>
			{#if description}
				<p class="{size.description} text-muted-foreground/70">{description}</p>
			{/if}
		{/if}
	</Card.CardContent>
</Card.Root>
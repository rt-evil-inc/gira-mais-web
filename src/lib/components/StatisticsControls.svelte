<script lang="ts">
	import { getLocalTimeZone, today, parseDate } from '@internationalized/date';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { RangeCalendar } from '$lib/components/ui/range-calendar';
	import { Calendar as CalendarIcon, AreaChart as AreaChartIcon, BarChart3 as BarChartIcon } from 'lucide-svelte';
	import type { DateRange } from 'bits-ui';

	let {
		interval = $bindable<DateRange>({
			start: today(getLocalTimeZone()).add({ months: -1 }),
			end: today(getLocalTimeZone()),
		}) as DateRange,
		groupBy = $bindable<string>('day'),
		chartType = $bindable<string>('area'),
	} = $props();

	const isSmallInterval = $derived(interval.start && interval.end ?
		interval.start.add({ days: 1 }) >= interval.end : false);
	const isLargeInterval = $derived(interval.start && interval.end ?
		interval.start.add({ weeks: 2 }) < interval.end : false);

	$effect(() => {
		if (isSmallInterval) {
			groupBy = 'hour';
		} else if (isLargeInterval) {
			groupBy = 'day';
		}
	});
</script>

<div class="flex flex-col lg:flex-row gap-4 mt-2 lg:items-center lg:justify-between">
	<!-- Date Range Controls Group -->
	<div class="flex flex-wrap gap-2">
		<Popover.Root>
			<Popover.PopoverTrigger class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground px-3 py-1">
				<CalendarIcon class="mr-2 h-4 w-4" />
				<span class="w-46">{interval.start?.toString()} - {interval.end?.toString()}</span>
			</Popover.PopoverTrigger>
			<Popover.PopoverContent class="w-auto p-0" align="start">
				<RangeCalendar bind:value={interval} preventDeselect maxValue={today(getLocalTimeZone())} />
			</Popover.PopoverContent>
		</Popover.Root>

		<Button variant="outline" size="sm" onclick={() => {
			interval.start = today(getLocalTimeZone());
			interval.end = today(getLocalTimeZone());
		}}>
			Hoje
		</Button>
		<Button variant="outline" size="sm" onclick={() => {
			interval.start = today(getLocalTimeZone()).add({ weeks: -1 });
			interval.end = today(getLocalTimeZone());
		}}>
			Última semana
		</Button>
		<Button variant="outline" size="sm" onclick={() => {
			interval.start = today(getLocalTimeZone()).add({ months: -1 });
			interval.end = today(getLocalTimeZone());
		}}>
			Último mês
		</Button>
		<Button variant="outline" size="sm" onclick={() => {
			interval.start = today(getLocalTimeZone()).add({ years: -1 });
			interval.end = today(getLocalTimeZone());
		}}>
			Último ano
		</Button>
		<Button variant="outline" size="sm" onclick={() => {
			interval.start = parseDate('2025-04-27');
			interval.end = today(getLocalTimeZone());
		}}>
			Tudo
		</Button>
	</div>

	<!-- Chart Controls Group -->
	<div class="flex flex-wrap gap-4 justify-center lg:justify-end">
		<!-- Chart Type Selector -->
		<div>
			<Tabs.Root value={chartType} onValueChange={value => { chartType = value; }}>
				<Tabs.TabsList>
					<Tabs.TabsTrigger value="area" class="flex items-center gap-2">
						<AreaChartIcon class="h-5 w-5" />
						<span class="sr-only">Área</span>
					</Tabs.TabsTrigger>
					<Tabs.TabsTrigger value="bar" class="flex items-center gap-2">
						<BarChartIcon class="h-5 w-5" />
						<span class="sr-only">Barras</span>
					</Tabs.TabsTrigger>
				</Tabs.TabsList>
			</Tabs.Root>
		</div>

		<!-- Group By Selector -->
		<div>
			<Tabs.Root value={groupBy} disabled={isSmallInterval || isLargeInterval} onValueChange={value => { groupBy = value; }}>
				<Tabs.TabsList>
					<Tabs.TabsTrigger value="hour">Por hora</Tabs.TabsTrigger>
					<Tabs.TabsTrigger value="day">Por dia</Tabs.TabsTrigger>
				</Tabs.TabsList>
			</Tabs.Root>
		</div>
	</div>
</div>
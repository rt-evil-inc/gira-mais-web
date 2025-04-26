<script lang="ts">
	import { getLocalTimeZone, today, parseDate, type CalendarDate } from '@internationalized/date';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { RangeCalendar } from '$lib/components/ui/range-calendar';
	import { Calendar as CalendarIcon } from 'lucide-svelte';
	import type { DateRange } from 'bits-ui';

	let {
		interval = $bindable<DateRange>({
			start: today(getLocalTimeZone()).add({ days: -7 }),
			end: today(getLocalTimeZone()),
		}) as DateRange,
		groupBy = $bindable<string>('hour'),
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

<div class="flex flex-col items-center justify-between sm:flex-row gap-4 mt-2">
	<div class="flex flex-wrap gap-2">
		<Popover.Root>
			<Popover.PopoverTrigger>
				<Button variant="outline" size="sm" class="ml-auto">
					<CalendarIcon class="mr-2 h-4 w-4" />
					<span class="w-40">{interval.start?.toString()} - {interval.end?.toString()}</span>
				</Button>
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

	<div>
		<Tabs.Root value={groupBy} disabled={isSmallInterval || isLargeInterval} onValueChange={value => { groupBy = value; }}>
			<Tabs.TabsList>
				<Tabs.TabsTrigger value="hour">Por hora</Tabs.TabsTrigger>
				<Tabs.TabsTrigger value="day">Por dia</Tabs.TabsTrigger>
			</Tabs.TabsList>
		</Tabs.Root>
	</div>
</div>
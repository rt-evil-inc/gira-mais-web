<script>
	import Button from '$lib/components/ui/button/button.svelte';
	import { HeartIcon } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	let { class: className = '' } = $props();
</script>

<div class={cn('flex', className)}>
	<Button variant="outline" size="sm" class="bg-transparent" href="https://github.com/sponsors/rt-evil-inc" target="_blank">
		<HeartIcon class="w-4 h-4 stroke-[#db61a2]" />
		Contribuir
	</Button>
</div>
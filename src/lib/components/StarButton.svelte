<script>
	import Button from '$lib/components/ui/button/button.svelte';
	import { StarIcon } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	let { class: className = '' } = $props();

	let stars = $state(0);

	async function fetchStarCount() {
		const response = await fetch('https://api.github.com/repos/rt-evil-inc/gira-mais');
		const data = await response.json();
		return data.stargazers_count;
	}

	$effect(() => {
		fetchStarCount().then(count => {
			stars = count;
		}).catch(error => {
			console.error('Error fetching star count:', error);
		});
	});
</script>

<div class={cn('flex', className)}>
	<Button variant="outline" size="sm" class="bg-transparent {stars > 0 ? 'rounded-r-none' : ''}" href="https://github.com/rt-evil-inc/gira-mais" target="_blank">
		<StarIcon class="w-4 h-4 stroke-[#e3b341]" />
		Deixar uma estrela
	</Button>
	{#if stars > 0}
		<Button variant="outline" size="sm" class="bg-transparent rounded-l-none border-l-0" href="https://github.com/rt-evil-inc/gira-mais/stargazers" target="_blank">
			{stars}
		</Button>
	{/if}
</div>
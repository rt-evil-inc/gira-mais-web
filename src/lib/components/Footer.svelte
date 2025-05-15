<script lang="ts">
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { cn } from '$lib/utils.js';
	import SponsorButton from './SponsorButton.svelte';
	import StarButton from './StarButton.svelte';

	let { class: className = '' } = $props();
</script>

<footer class={cn('text-muted-foreground', className)}>
	<div class="container mx-auto px-4 sm:px-8">
		<div class="flex flex-col lg:flex-row py-8">
			<div class="flex flex-wrap grow gap-8 sm:justify-end">
				<div class="grow w-full sm:w-auto">
					<a href="/" class="flex items-center mb-3 no-underline">
						<img src="/icon.svg" alt="Gira+" class="h-10 w-10 mr-2" />
						<span class="text-2xl font-bold text-foreground">Gira+</span>
					</a>
					<p class="text-sm">Porque Lisboa merece mais</p>
				</div>
				<div class="grow">
					<h3 class="font-semibold text-foreground mb-3">Links Úteis</h3>
					<ul class="space-y-1 text-sm">
						<li><a href="/estatisticas">Estatísticas</a></li>
						<!-- <li><a href="/blog">Blog</a></li> -->
						<li><a href="https://github.com/orgs/rt-evil-inc/projects/1/views/7" target="_blank">Roadmap</a></li>
						<li><a href="https://github.com/rt-evil-inc/gira-mais/releases" target="_blank">Release Notes</a></li>
						<li><a href="https://github.com/rt-evil-inc/gira-mais/issues" target="_blank">Feedback</a></li>
					</ul>
				</div>
				<div class="grow">
					<h3 class="font-semibold text-foreground mb-3">Contacto</h3>
					<ul class="space-y-1 text-sm">
						<li><a href="mailto:contact@gira-mais.app">contact@gira-mais.app</a></li>
					</ul>
				</div>
			</div>
			<div class="flex flex-col-reverse lg:flex-col -mt-8 lg:mt-0 items-end gap-2">
				<StarButton />
				<SponsorButton />
			</div>
		</div>
		<Separator />
		<div class="py-5 flex flex-col-reverse sm:flex-row justify-between items-center text-sm gap-2">
			<p class="opacity-50">&copy; {(new Date).getFullYear() == 2025 ? '2025' : '2025-' + (new Date).getFullYear()} RT Labs</p>
			<p>Feito com ❤️ por <a href="https://github.com/rodrigohpalmeirim" target="_blank">Rodrigo</a> e <a href="https://github.com/ttmx" target="_blank">Tiago</a></p>
		</div>
	</div>
</footer>

<style lang="postcss">
	a:not(.no-underline) {
    @apply hover:underline hover:text-primary transition-colors;
	}
</style>
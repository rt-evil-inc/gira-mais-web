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
					<p class="text-sm pb-4">Porque Lisboa merece mais</p>
					<a href="https://gira-mais.app/discord">
						<svg class="h-6 transition-colors fill-muted-foreground hover:fill-[#5865F2]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Discord</title><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
					</a>
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
						<li><a href="https://gira-mais.app/discord">Discord</a></li>
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
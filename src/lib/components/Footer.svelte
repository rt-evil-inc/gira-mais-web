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
					<div class="flex gap-3">
						<a href="https://github.com/rt-evil-inc/gira-mais" target="_blank">
							<svg class="h-6 transition-colors fill-muted-foreground hover:fill-[#F0F6FC]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>GitHub</title><path d="M12 0C5.373 0 0 5.373 0 12c0 5.304 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577 0-.287-.011-1.045-.016-2.052-3.338.724-4.042-1.607-4.042-1.607-.546-1.384-1.333-1.754-1.333-1.754-1.089-.743.083-.728.083-.728 1.204.085 1.838 1.237 1.838 1.237 1.067 1.826 2.8 1.297 3.48.992.108-.773.418-1.297.76-1.597-2.665-.303-5.466-1.333-5.466-5.933 0-1.313.469-2.386 1.236-3.227-.124-.303-.536-1.53.117-3.185 0 0 1.008-.322 3.303 1.227.957-.266 1.986-.399 3.006-.404 1.02.005 2.049.138 3.006.404 2.295-1.549 3.303-1.227 3.303-1.227.653 1.655.241 2.882.118 3.185.769.841 1.236 1.914 1.236 3.227 0 4.605-2.805 5.63-5.475 5.925.43.372.815 1.102.815 2.222 0 1.606-.014 2.91-.014 3.303 0 .318.192.694.798.577C20.563 21.8 24 17.304 24 12c0-6.627-5.373-12-12-12z"/></svg>
						</a>
						<a href="https://gira-mais.app/discord" target="_blank">
							<svg class="h-6 transition-colors fill-muted-foreground hover:fill-[#5865F2]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Discord</title><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
						</a>
					</div>
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
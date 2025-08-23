<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Menu } from 'lucide-svelte';
	import Logo from '$lib/components/Logo.svelte';
	import LightSwitch from '$lib/components/LightSwitch.svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';

	let admin = $state(false);
	if (browser) {
		admin = localStorage.getItem('admin') === 'true';
	}
</script>

<header
	class:dark={page.route.id === '/'}
	class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 text-foreground"
>
	<div class="flex h-14 items-center px-4">
		<a href="/" class="mr-6 flex items-center">
			<img src="/icon.svg" alt="Gira+" class="h-6 w-6 mr-2" />
			<span class="font-bold sm:inline-block">Gira+</span>
		</a>
		<div class="flex flex-1 items-center justify-end gap-1">
			{#if page.route.id !== '/'}
				<LightSwitch />
			{/if}
			<div class="hidden md:flex gap-1">
				<!-- <Button variant="ghost" size="sm" href="/blog">Blog</Button> -->
				<Button variant="ghost" size="sm" href="/estatisticas">Estatísticas</Button>
				{#if admin}
					<Button variant="ghost" size="sm" href="/admin" data-sveltekit-preload-data="tap">Admin</Button>
				{/if}
				<Button variant="ghost" size="sm" href="https://github.com/rt-evil-inc/gira-mais" target="_blank">GitHub</Button>
			</div>
			<div class="md:hidden">
				<Sheet.Root>
					<Sheet.Trigger>
						<Button variant="ghost" size="icon">
							<Menu class="h-6 w-6" />
							<span class="sr-only">Abrir menu</span>
						</Button>
					</Sheet.Trigger>
					<Sheet.Content class="w-60">
						<Sheet.Header>
							<Sheet.Title>Menu</Sheet.Title>
							<Sheet.Description>Atalhos de navegação</Sheet.Description>
						</Sheet.Header>
						<div class="flex flex-col justify-center h-full gap-4 py-4 pb-32">
							<!-- <Sheet.Close class="text-left">
								<a href="/blog" class="text-lg font-medium">Blog</a>
							</Sheet.Close> -->
							<Sheet.Close class="text-left">
								<a href="/estatisticas" class="text-lg font-medium">Estatísticas</a>
							</Sheet.Close>
							{#if admin}
								<Sheet.Close class="text-left">
									<a href="/admin" class="text-lg font-medium">Admin</a>
								</Sheet.Close>
							{/if}
							<a href="https://github.com/rt-evil-inc/gira-mais" target="_blank" class="text-lg font-medium">GitHub</a>
							<a href="https://github.com/orgs/rt-evil-inc/projects/1/views/7" target="_blank" class="text-lg font-medium">Roadmap</a>
							<a href="https://github.com/rt-evil-inc/gira-mais/releases" target="_blank" class="text-lg font-medium">Release Notes</a>
							<a href="https://github.com/rt-evil-inc/gira-mais/issues" target="_blank" class="text-lg font-medium">Feedback</a>
						</div>
					</Sheet.Content>
				</Sheet.Root>
			</div>
		</div>
	</div>
</header>
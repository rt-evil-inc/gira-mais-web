<script>
	import Footer from '$lib/components/Footer.svelte';
	import { Shield } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Gira+ | Política de Privacidade</title>
</svelte:head>

<div class="flex flex-col min-h-screen">
	<div class="container mx-auto py-12 px-4 max-w-6xl grow">
		<header class="mb-10">
			<div class="flex items-center mb-4">
				<Shield class="min-h-10 min-w-10 text-primary" />
				<h1 class="text-3xl font-bold ml-2">Política de Privacidade da Gira+</h1>
			</div>
		</header>

		<div class="mt-8 mb-4">
			Os dados são processados de acordo com o código presente em <a class="underline" href="https://github.com/rt-evil-inc/gira-mais-web">https://github.com/rt-evil-inc/gira-mais-web</a>. Os dados não serão associados à sua identidade e serão usados para gerar gráficos públicos e relatar erros aos desenvolvedores.
		</div>
	</div>

	<Footer class="bg-muted/40" />
</div>
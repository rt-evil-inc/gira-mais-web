<script>
	import Footer from '$lib/components/Footer.svelte';
	import { Shield } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Gira+ | Privacy Policy</title>
</svelte:head>

<div class="flex flex-col min-h-screen">
	<div class="container mx-auto py-12 px-4 max-w-6xl grow">
		<header class="mb-10">
			<div class="flex items-center mb-4">
				<Shield class="min-h-10 min-w-10 text-primary" />
				<h1 class="text-3xl font-bold ml-2">Gira+ Privacy Policy</h1>
			</div>
		</header>

		<div class="mt-8 mb-4">
			The data is processed according to the code present on <a class="underline" href="https://github.com/rt-evil-inc/gira-mais">https://github.com/rt-evil-inc/gira-mais</a>. Data will not be tied to your identity and it is used to generate public usage dashboards and to report errors to the developers.
		</div>
	</div>

	<Footer class="bg-muted/40" />
</div>
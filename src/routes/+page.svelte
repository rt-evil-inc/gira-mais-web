<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '$lib/components/ui/accordion';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Github, Navigation, Route, Map, WandSparkles, MoonStar, ExternalLink, Star, Heart } from 'lucide-svelte';
	import * as Carousel from '$lib/components/ui/carousel';
	import Autoplay from 'embla-carousel-autoplay';
	import { Badge } from '$lib/components/ui/badge';
	import Logo from '$lib/components/Logo.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { onMount } from 'svelte';

	const screenshots = [
		'/screenshots/screenshot-1.png',
		'/screenshots/screenshot-2.png',
		'/screenshots/screenshot-3.png',
		'/screenshots/screenshot-4.png',
		'/screenshots/screenshot-5.png',
		'/screenshots/screenshot-6.png',
		'/screenshots/screenshot-7.png',
		'/screenshots/screenshot-8.png',
		'/screenshots/screenshot-9.png',
		'/screenshots/screenshot-10.png',
	];

	// GitHub data state
	interface GitHubUser {
		login: string;
		avatar_url: string;
		html_url: string;
		contributions?: number | string;
	}

	interface Sponsor {
		handle: string;
		avatar: string;
		profile: string;
		details: GitHubUser;
	}

	interface RepoStats {
		stars: number;
		forks: number;
	}

	let sponsors = $state<Sponsor[]>([]);
	let codeContributors = $state<GitHubUser[]>([]);
	let designContributors = $state<GitHubUser[]>([]);
	let stargazers = $state<GitHubUser[]>([]);
	let repoStats = $state<RepoStats>({ stars: 0, forks: 0 });
	let isLoading = $state(true);

	// Calculate optimal pagination to get recent items from the last page
	function calculateOptimalPagination(totalItems: number, itemsToShow: number, maxPerPage = 100) {
		if (totalItems <= itemsToShow) {
			return { perPage: totalItems, page: 1 };
		}

		let perPage = maxPerPage; // fallback to max if no optimal value found
		// Find the smallest per_page value that ensures at least itemsToShow items on the last page
		for (let testPerPage = itemsToShow; testPerPage <= maxPerPage; testPerPage++) {
			const remainder = totalItems % testPerPage;
			if (remainder === 0 || remainder >= itemsToShow) {
				perPage = testPerPage; // Use the first (smallest) value that works
				break;
			}
		}

		const lastPage = Math.ceil(totalItems / perPage);
		return { perPage, page: lastPage };
	}

	// Fetch GitHub data
	async function fetchGitHubData() {
		try {
			// First, get repo stats and contributor count
			const [repoResponse, contributorsCountResponse] = await Promise.all([
				fetch('https://api.github.com/repos/rt-evil-inc/gira-mais'),
				fetch('https://api.github.com/repos/rt-evil-inc/gira-mais/contributors?per_page=1'), // Just to get the total count from headers
			]);

			let totalStars = 0;
			let totalContributors = 0;

			if (repoResponse.ok) {
				const repoData = await repoResponse.json();
				totalStars = repoData.stargazers_count;
				repoStats = {
					stars: totalStars,
					forks: repoData.forks_count,
				};
			}

			// Get total contributors count from the Link header or fallback
			if (contributorsCountResponse.ok) {
				const linkHeader = contributorsCountResponse.headers.get('Link');
				if (linkHeader) {
					// Parse the last page number from Link header
					const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
					if (lastPageMatch) {
						totalContributors = parseInt(lastPageMatch[1]);
					}
				}

				// Fallback: if we can't get count from headers, estimate or use a reasonable default
				if (!totalContributors) {
					const contributors = await contributorsCountResponse.json();
					totalContributors = contributors.length || 50; // Fallback estimate
				}
			}

			// Calculate optimal pagination for both stargazers and contributors
			const starsPagination = calculateOptimalPagination(totalStars, 23);
			const contributorsPagination = calculateOptimalPagination(totalContributors, 12);

			const [contributorsResponse, stargazersResponse, sponsorsResponse] = await Promise.all([
				fetch(`https://api.github.com/repos/rt-evil-inc/gira-mais/contributors?per_page=${contributorsPagination.perPage}&page=${contributorsPagination.page}`),
				fetch(`https://api.github.com/repos/rt-evil-inc/gira-mais/stargazers?per_page=${starsPagination.perPage}&page=${starsPagination.page}`),
				fetch('https://ghs.vercel.app/sponsors/rt-evil-inc'),
			]);

			if (contributorsResponse.ok) {
				const githubContributors = await contributorsResponse.json();
				codeContributors = githubContributors;

				designContributors = [{
					login: 'Inês Freitas',
					avatar_url: 'https://media.licdn.com/dms/image/v2/D4D03AQG_7hKq8UJtVA/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1683987713410?e=2147483647&v=beta&t=F_ADBYd1z_xD_XND7uD6hzVS3Q7OYO0KgEIKYdslkME',
					html_url: 'https://pt.linkedin.com/in/ines-t-freitas',
					contributions: 'Design do logotipo',
				}];
			}

			if (stargazersResponse.ok) {
				const fetchedStargazers = await stargazersResponse.json();
				stargazers = fetchedStargazers;
			}

			if (sponsorsResponse.ok) {
				const sponsorsData = await sponsorsResponse.json();
				sponsors = sponsorsData.sponsors || [];
			}
		} catch (error) {
			console.error('Error fetching GitHub data:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchGitHubData();
	});
</script>

<svelte:head>
	<title>Gira+</title>
	<meta name="description" content="Aplicação não-oficial para o sistema de bicicletas Gira." />
	<meta property="og:title" content="Gira+" />
	<meta property="og:description" content="Aplicação não-oficial para o sistema de bicicletas Gira." />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://gira-mais.app/card.png" />
	<meta property="og:url" content="https://gira-mais.app" />
	<meta property="og:site_name" content="Gira+" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Gira+" />
	<meta name="twitter:description" content="Aplicação não-oficial para o sistema de bicicletas Gira." />
	<meta name="twitter:image" content="https://gira-mais.app/card.png" />
</svelte:head>

<div class="min-h-screen bg-background dark text-foreground">
	<!-- Hero Section -->
	<section class="py-20 text-center">
		<div class="absolute top-4 right-4 hidden md:flex gap-2">
			<Button variant="ghost" size="sm" href="https://github.com/rt-evil-inc/gira-mais" target="_blank">GitHub</Button>
			<Button variant="ghost" size="sm" href="/estatisticas">Estatísticas</Button>
			<!-- <Button variant="ghost" size="sm" href="/blog">Blog</Button> -->
		</div>
		<div class="container px-4 mx-auto flex flex-col items-center">
			<div title="Logotipo da Gira+ desenhado por Inês Freitas">
				<Logo class="h-32 md:h-40 mb-8" />
			</div>
			<h1 class="text-4xl md:text-6xl font-bold tracking-tighter mb-4">Gira+</h1>
			<p class="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-8">
				Porque Lisboa merece mais
			</p>
			<div class="flex flex-wrap gap-4 justify-center">
				<div class="relative grayscale opacity-50">
					<img src="/google-play-button-pt.png" alt="Obter no Google Play" class="h-12 md:h-16" />
					<Badge class="absolute -top-2 -right-2" variant="secondary">Brevemente</Badge>
				</div>
				<div class="relative grayscale opacity-50">
					<img src="/app-store-button-pt.svg" alt="Descarregar na App Store" class="h-12 md:h-16" />
					<Badge class="absolute -top-2 -right-2" variant="secondary">Brevemente</Badge>
				</div>
				<div class="relative grayscale opacity-50">
					<img src="https://f-droid.org/badge/get-it-on-pt.png" alt="Disponível no F-Droid" class="h-12 md:h-16 scale-150 mx-6" />
					<Badge class="absolute -top-2 -right-2" variant="secondary">Brevemente</Badge>
				</div>
			</div>
			<div class="text-sm text-muted-foreground mt-6 opacity-50 hover:opacity-100 transition-opacity">
				ou <a href="https://github.com/rt-evil-inc/gira-mais/releases" target="_blank" class="underline">descarregar o APK no GitHub</a>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="py-16">
		<div class="container">
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 items-center justify-center">
				<div class="relative w-screen -ml-8 sm:ml-0 sm:w-full lg:col-span-2 sm:m-0 select-none">
					<div class="hidden sm:block absolute inset-y-0 left-0 w-16 z-10 pointer-events-none bg-gradient-to-r from-[#151515] to-transparent"></div>
					<div class="hidden sm:block absolute inset-y-0 right-0 w-16 z-10 pointer-events-none bg-gradient-to-l from-[#151515] to-transparent"></div>
					<Carousel.Root plugins={[Autoplay({ stopOnInteraction: false })]} opts={{ loop: true }}>
						<Carousel.Content>
							{#each screenshots as screenshot}
								<Carousel.Item class="flex justify-center">
									<div class="max-w-[300px] mx-8 sm:mx-16">
										<img src={screenshot} alt="Screenshot" class="rounded-3xl shadow-xl" />
									</div>
								</Carousel.Item>
							{/each}
						</Carousel.Content>
					</Carousel.Root>
				</div>
				<div class="lg:col-span-3 flex flex-col items-center">
					<h2 class="text-3xl md:text-4xl font-bold text-center mt-8 mb-12">Características</h2>
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<Card>
							<CardHeader>
								<div class="flex gap-2 justify-between">
									<CardTitle>Interface Moderna</CardTitle>
									<WandSparkles size={24} class="stroke-primary" />
								</div>
							</CardHeader>
							<CardContent>
								<p>Design intuitivo e responsivo para uma experiência de utilizador superior à aplicação oficial.</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<div class="flex gap-2 justify-between">
									<CardTitle>Código Aberto</CardTitle>
									<Github size={24} class="stroke-primary" />
								</div>
							</CardHeader>
							<CardContent>
								<p>Totalmente <i>open-source</i> para maior transparência e possibilidade de contribuição da comunidade.</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<div class="flex gap-2 justify-between">
									<CardTitle>Mapa com ciclovias</CardTitle>
									<Map size={24} class="stroke-primary" />
								</div>
							</CardHeader>
							<CardContent>
								<p>Visualização das ciclovias, edifícios 3D e ocupação das estações Gira, facilitando a navegação.</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<div class="flex gap-2 justify-between">
									<CardTitle>Detalhes em viagem</CardTitle>
									<Route size={24} class="stroke-primary" />
								</div>
							</CardHeader>
							<CardContent>
								<p>Acompanhamento em tempo real da sua viagem, com informação sobre o trajeto percorrido.</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<div class="flex gap-2 justify-between">
									<CardTitle>Tema escuro</CardTitle>
									<MoonStar size={24} class="stroke-primary" />
								</div>
							</CardHeader>
							<CardContent>
								<p>Tema escuro para uma utilização mais confortável durante a noite.</p>
							</CardContent>
						</Card>
						<Card class="relative opacity-50 grayscale">
							<Badge class="absolute top-2 right-2" variant="secondary">Brevemente</Badge>
							<CardHeader>
								<div class="flex gap-2 justify-between">
									<CardTitle>Sistema de navegação</CardTitle>
									<Navigation size={24} class="stroke-primary" />
								</div>
							</CardHeader>
							<CardContent>
								<p>Visualização da melhor rota para a sua viagem, considerando as ciclovias.</p>
							</CardContent>
						</Card>
					</div>
					<Button class="mt-8" variant="secondary" size="lg" href="https://github.com/orgs/rt-evil-inc/projects/1/views/7" target="_blank">
						Veja o Roadmap
						<ExternalLink class="ml-2" size={16} />
					</Button>
				</div>
		</div>
	</section>

	<!-- About Us Section -->
	<section class="py-16">
		<div class="container px-4 sm:px-8 mx-auto">
			<h2 class="text-3xl md:text-4xl font-bold text-center mb-12">Quem somos?</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
				<div class="flex flex-col items-center md:items-start max-w-[350px] mx-auto">
					<p class="text-lg mb-6">
						Somos o Rodrigo e o Tiago, dois amigos, estudantes de Engenharia Informática, que gostam de desenvolver <i>software</i>.
					</p>
					<div class="flex gap-4 my-4">
						<a href="https://github.com/rodrigohpalmeirim" target="_blank">
							<Avatar class="h-16 w-16" title="Rodrigo">
								<AvatarImage src="https://avatars.githubusercontent.com/u/34187774" alt="Rodrigo" />
								<AvatarFallback class="text-foreground hover:no-underline">R</AvatarFallback>
							</Avatar>
						</a>
						<a href="https://github.com/ttmx" target="_blank">
							<Avatar class="h-16 w-16" title="Tiago">
								<AvatarImage src="https://avatars.githubusercontent.com/u/12669467" alt="Tiago" />
								<AvatarFallback class="text-foreground hover:no-underline">T</AvatarFallback>
							</Avatar>
						</a>
					</div>
				</div>
				<Card>
					<CardHeader>
						<CardTitle>Porque é que fizémos esta aplicação?</CardTitle>
					</CardHeader>
					<CardContent>
						<p class="text-muted-foreground">
							Se é um utilizador das bicicletas Gira, certamente já se deparou com os diversos problemas frustrantes que existem com a aplicação oficial. Estes problemas existem por uma razão simples: a aplicação oficial já não tem manutenção há vários anos.
						</p>
						<p class="text-muted-foreground mt-4">
							Inspirados pela <a href="https://mgira.pt/" target="_blank">mGira</a>, desenvolvida pelo Afonso, decidimos que era altura de criar uma aplicação de código aberto para telemóveis focada em melhorar a experiência de utilização das bicicletas Gira.
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	</section>

	<!-- FAQ Section -->
	<section class="py-16">
		<div class="container px-4 mx-auto">
			<h2 class="text-3xl md:text-4xl font-bold text-center mb-12">Perguntas Frequentes</h2>
			<div class="max-w-3xl mx-auto">
				<Accordion type="single" class="w-full">
					<AccordionItem value="item-1">
						<AccordionTrigger>Isto é seguro?</AccordionTrigger>
						<AccordionContent>
							<p class="text-muted-foreground">
								Sim. A aplicação comunica diretamente com o API da Gira, tal como a aplicação oficial, sem passar por servidores intermediários. Para além disso, a aplicação não recolhe dados pessoais além das <a href="/estatisticas">estatísticas anónimas de utilização opcionais</a>. Isto pode ser verificado no código fonte da aplicação, disponível no <a href="https://github.com/rt-evil-inc/gira-mais" target="_blank">GitHub</a>.
							</p>
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="item-3">
						<AccordionTrigger>A aplicação é gratuita?</AccordionTrigger>
						<AccordionContent>
							<p class="text-muted-foreground">
								Melhor ainda: a aplicação é de código aberto! Pode inspecionar todo o seu comportamento ou pedir ao seu amigo mais tecnológico que o faça! O nosso objetivo é apenas melhorar a experiência de utilização das bicicletas Gira.
							</p>
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="item-2">
						<AccordionTrigger>Como posso ajudar?</AccordionTrigger>
						<AccordionContent>
							<p class="text-muted-foreground mb-4">
								Se quiser ajudar, pode fazê-lo de várias formas:
							</p>
							<ul class="list-disc pl-6 space-y-2 text-muted-foreground">
								<li>
									<strong>Deixar uma estrela:</strong>
									<p class="mt-1">Deixe-nos uma estrela no <a href="https://github.com/rt-evil-inc/gira-mais" target="_blank">GitHub</a>! 🤩</p>
								</li>
								<li>
									<strong>Divulgar a aplicação:</strong>
									<p class="mt-1">Quanto mais pessoas usarem a aplicação, mais motivação teremos para a melhorar e mais feedback receberemos! Se conhece quem possa estar interessado, ficaríamos contentes se partilhasse a aplicação!</p>
								</li>
								<li>
									<strong>Reportar problemas ou sugerir melhorias:</strong>
									<p class="mt-1">Estamos abertos a sugestões e feedback. Se encontrar um problema ou tiver uma ideia para melhorar a aplicação, não hesite em
										<a href="https://github.com/rt-evil-inc/gira-mais/issues" target="_blank">abrir um <em>issue</em></a> no nosso repositório no GitHub.</p>
								</li>
								<li>
									<strong>Contribuir com código através do GitHub:</strong>
									<p class="mt-1">Se tem conhecimentos de programação e quer ajudar a desenvolver a aplicação, pode fazê-lo através do nosso
										<a href="https://github.com/rt-evil-inc/gira-mais" target="_blank">repositório no GitHub</a>.</p>
								</li>
								<li>
									<strong>Doações:</strong>
									<p class="mt-1">Se quiser ajudar a cobrir os custos associados ao projeto ou simplesmente mostrar agradecimento pelo nosso trabalho, pode fazê-lo através do
										<a href="https://github.com/sponsors/rt-evil-inc" target="_blank">GitHub Sponsors</a>. Ficaremos muito gratos!</p>
									<p class="mt-1">De momento, os custos associados ao projeto são os seguintes:</p>
									<ul class="list-disc pl-6 mb-2">
										<li>Domínio: ~15€ por ano</li>
										<li>Licença para publicar na App Store: 99€ por ano</li>
									</ul>
								</li>
							</ul>
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="item-4">
						<AccordionTrigger>Qual é a posição da EMEL em relação ao projeto?</AccordionTrigger>
						<AccordionContent>
							<p class="text-muted-foreground">
								Estamos a escrever um artigo sobre isto. Estará disponível em breve.
							</p>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</div>
		</div>
	</section>

	<!-- Community Section -->
	<section class="py-16">
		<div class="container px-4 mx-auto">
			{#if isLoading}
				<div class="flex flex-col xl:flex-row items-stretch justify-center gap-8 xl:gap-12">
					<!-- Sponsors Skeleton -->
					<div class="text-center flex flex-col justify-between w-full xl:w-auto">
						<div class="flex items-center justify-center gap-2 mb-6">
							<div class="flex items-center gap-3">
								<div class="w-6 h-6 bg-muted rounded animate-pulse"></div>
								<div class="w-28 h-6 bg-muted rounded animate-pulse"></div>
							</div>
							<div class="w-6 h-4 bg-muted rounded animate-pulse"></div>
						</div>
						<div class="flex flex-col items-center justify-center w-full max-w-96 mx-auto grow">
							<div class="flex flex-wrap items-center justify-center gap-2 mb-6">
								{#each Array(16) as _}
									<div class="w-12 h-12 bg-muted rounded-full animate-pulse"></div>
								{/each}
							</div>
							<div class="flex justify-center">
								<div class="w-20 h-8 bg-muted rounded animate-pulse"></div>
							</div>
						</div>
					</div>

					<div class="w-full max-w-3xl h-px xl:w-px xl:h-auto bg-border flex-shrink-0 xl:self-stretch"></div>

					<!-- Contributors Skeleton -->
					<div class="text-center flex flex-col justify-between w-full xl:w-auto">
						<div class="flex items-center justify-center gap-2 mb-6">
							<div class="flex items-center gap-3">
								<div class="w-6 h-6 bg-muted rounded animate-pulse"></div>
								<div class="w-28 h-6 bg-muted rounded animate-pulse"></div>
							</div>
							<div class="w-6 h-4 bg-muted rounded animate-pulse"></div>
						</div>
						<div class="flex flex-col items-center justify-center w-80 mx-auto grow">
							<!-- Code Contributors Skeleton -->
							<div class="mb-6">
								<div class="flex items-center justify-center mb-3">
									<div class="w-12 h-4 bg-muted rounded animate-pulse"></div>
								</div>
								<div class="flex flex-wrap items-center justify-center gap-2">
									{#each Array(8) as _}
										<div class="w-12 h-12 bg-muted rounded-full animate-pulse"></div>
									{/each}
								</div>
							</div>
							<!-- Design Contributors Skeleton -->
							<div class="mb-6">
								<div class="flex items-center justify-center mb-3">
									<div class="w-12 h-4 bg-muted rounded animate-pulse"></div>
								</div>
								<div class="flex flex-wrap items-center justify-center gap-2">
									{#each Array(2) as _}
										<div class="w-12 h-12 bg-muted rounded-full animate-pulse"></div>
									{/each}
								</div>
							</div>
							<div class="flex justify-center">
								<div class="w-32 h-8 bg-muted rounded animate-pulse"></div>
							</div>
						</div>
					</div>

					<div class="w-full max-w-3xl h-px xl:w-px xl:h-auto bg-border flex-shrink-0 xl:self-stretch"></div>

					<!-- Stargazers Skeleton -->
					<div class="text-center flex flex-col justify-between w-full xl:w-auto">
						<div class="flex items-center justify-center gap-2 mb-6">
							<div class="flex items-center gap-3">
								<div class="w-6 h-6 bg-muted rounded animate-pulse"></div>
								<div class="w-16 h-6 bg-muted rounded animate-pulse"></div>
							</div>
							<div class="w-8 h-4 bg-muted rounded animate-pulse"></div>
						</div>
						<div class="flex flex-col items-center justify-center w-80 mx-auto grow">
							<div class="flex flex-wrap items-center justify-center gap-2 mb-6">
								{#each Array(20) as _}
									<div class="w-12 h-12 bg-muted rounded-full animate-pulse"></div>
								{/each}
							</div>
							<div class="flex justify-center">
								<div class="w-32 h-8 bg-muted rounded animate-pulse"></div>
							</div>
						</div>
					</div>
				</div>
			{:else}
				<div class="flex flex-col xl:flex-row items-center xl:items-stretch justify-center gap-8 xl:gap-12">
					<!-- Sponsors -->
					<div class="text-center flex flex-col justify-between w-full xl:w-auto">
						<div class="flex items-center justify-center gap-2 mb-6">
							<h3 class="text-xl font-bold flex items-center gap-3">
								<Heart size={24} class="stroke-[#db61a2]" />
								Patrocinadores
							</h3>
							<Badge variant="secondary" class="text-xs">
								{sponsors.length}
							</Badge>
						</div>
						<div class="flex flex-col items-center justify-center w-80 mx-auto grow">
							<div class="flex flex-wrap items-center justify-center gap-2 mb-6">
								{#each sponsors.slice(0, 23).reverse() as sponsor}
									<a href={sponsor.profile} target="_blank" title={sponsor.details.name || sponsor.handle} class="relative hover:z-10 transition-transform {sponsors.length > 15 ? '-ml-4 translate-x-2' : ''} hover:scale-110">
										<Avatar class="h-12 w-12 bg-muted">
											<AvatarImage src={sponsor.avatar} alt={sponsor.handle} />
											<AvatarFallback class="bg-muted">{sponsor.handle.charAt(0).toUpperCase()}</AvatarFallback>
										</Avatar>
									</a>
								{/each}
								{#if sponsors.length > 23}
									<a href="https://github.com/sponsors/rt-evil-inc" target="_blank" title="Ver todos os patrocinadores" class="relative hover:z-10 transition-transform -ml-4 translate-x-2 hover:scale-110 !no-underline !text-foreground">
										<Avatar class="h-12 w-12 bg-muted">
											<AvatarFallback class="bg-muted text-xs">+{sponsors.length - 23}</AvatarFallback>
										</Avatar>
									</a>
								{/if}
							</div>
							<Button variant="secondary" href="https://github.com/sponsors/rt-evil-inc" target="_blank">
								Patrocinar
								<ExternalLink size={16} />
							</Button>
						</div>
					</div>

					<div class="w-full max-w-3xl h-px xl:w-px xl:h-auto bg-border flex-shrink-0 xl:self-stretch"></div>

					<!-- Contributors -->
					<div class="text-center flex flex-col justify-between w-full xl:w-auto">
						<div class="flex items-center justify-center gap-2 mb-6">
							<h3 class="text-xl font-bold flex items-center gap-3">
								<Github size={24} />
								Contribuidores
							</h3>
							<Badge variant="secondary" class="text-xs">
								{codeContributors.length + designContributors.length}
							</Badge>
						</div>
						<div class="flex flex-col items-center justify-center w-80 mx-auto grow">

							<!-- Code Contributors Subsection -->
							<div class="mb-6">
								<div class="flex items-center justify-center mb-3">
									<h4 class="text-sm font-semibold text-muted-foreground">Código</h4>
								</div>
								<div class="flex flex-wrap items-center justify-center gap-2">
									{#each codeContributors.slice(0, 15) as contributor}
										<a href={contributor.html_url} target="_blank" title="{contributor.login} ({contributor.contributions} {(contributor.contributions === 1 ? 'contribuição' : 'contribuições')})" class="relative hover:z-10 transition-transform {codeContributors.length > 15 ? '-ml-4 translate-x-2' : ''} hover:scale-110">
											<Avatar class="h-12 w-12 bg-muted">
												<AvatarImage src={contributor.avatar_url} alt={contributor.login} />
												<AvatarFallback class="bg-muted text-xs">{contributor.login.charAt(0).toUpperCase()}</AvatarFallback>
											</Avatar>
										</a>
									{/each}
									{#if codeContributors.length > 15}
										<a href="https://github.com/rt-evil-inc/gira-mais/graphs/contributors" target="_blank" title="Ver todos os contribuidores de código" class="relative hover:z-10 transition-transform -ml-4 translate-x-2 hover:scale-110 !no-underline !text-foreground">
											<Avatar class="h-12 w-12 bg-muted">
												<AvatarFallback class="bg-muted text-xs">+{codeContributors.length - 15}</AvatarFallback>
											</Avatar>
										</a>
									{/if}
								</div>
							</div>

							<!-- Design Contributors Subsection -->
							<div class="mb-6">
								<div class="flex items-center justify-center mb-3">
									<h4 class="text-sm font-semibold text-muted-foreground">Design</h4>
								</div>
								<div class="flex flex-wrap items-center justify-center gap-2">
									{#each designContributors as contributor}
										<a href={contributor.html_url} target="_blank" title="{contributor.login} ({contributor.contributions})" class="relative hover:z-10 transition-transform hover:scale-110">
											<Avatar class="h-12 w-12 bg-muted">
												<AvatarImage src={contributor.avatar_url} alt={contributor.login} />
												<AvatarFallback class="bg-muted text-xs">{contributor.login.charAt(0).toUpperCase()}</AvatarFallback>
											</Avatar>
										</a>
									{/each}
								</div>
							</div>

							<Button variant="secondary" href="https://github.com/rt-evil-inc/gira-mais/graphs/contributors" target="_blank">
								Ver contribuidores
								<ExternalLink size={16} />
							</Button>
						</div>
					</div>

					<div class="w-full max-w-3xl h-px xl:w-px xl:h-auto bg-border flex-shrink-0 xl:self-stretch"></div>

					<!-- Stargazers -->
					<div class="text-center flex flex-col justify-between w-full xl:w-auto">
						<div class="flex items-center justify-center gap-2 mb-6">
							<h3 class="text-xl font-bold flex items-center gap-3">
								<Star size={24} class="stroke-[#e3b341]" />
								Estrelas
							</h3>
							<Badge variant="secondary" class="text-xs">
								{repoStats.stars}
							</Badge>
						</div>
						<div class="flex flex-col items-center justify-center w-80 mx-auto grow">
							<div class="flex flex-wrap items-center justify-center gap-2 mb-6">
								{#each stargazers.slice(0, 23).reverse() as stargazer}
									<a href={stargazer.html_url} target="_blank" title={stargazer.login} class="relative hover:z-10 transition-transform {repoStats.stars > 15 ? '-ml-4 translate-x-2' : ''} hover:scale-110">
										<Avatar class="h-12 w-12 bg-muted">
											<AvatarImage src={stargazer.avatar_url} alt={stargazer.login} />
											<AvatarFallback class="bg-muted">{stargazer.login.charAt(0).toUpperCase()}</AvatarFallback>
										</Avatar>
									</a>
								{/each}
								{#if repoStats.stars > 23}
									<a href="https://github.com/rt-evil-inc/gira-mais/stargazers" target="_blank" title="Ver todas as estrelas" class="relative hover:z-10 transition-transform -ml-4 translate-x-2 hover:scale-110 !no-underline !text-foreground">
										<Avatar class="h-12 w-12 bg-muted">
											<AvatarFallback class="bg-muted text-xs">+{repoStats.stars - 23}</AvatarFallback>
										</Avatar>
									</a>
								{/if}
							</div>
							<Button variant="secondary" href="https://github.com/rt-evil-inc/gira-mais" target="_blank">
								Deixar uma estrela
								<ExternalLink size={16} />
							</Button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</section>
	<Footer class="bg-muted/40" />
</div>

<style lang="postcss">
	:global(.animate-pulse-slow) {
		animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	section:nth-child(even) {
		@apply bg-muted/40;
	}

	a {
		text-decoration: none;
		color: hsl(var(--primary));
	}
	a:hover {
		text-decoration: underline;
	}
</style>
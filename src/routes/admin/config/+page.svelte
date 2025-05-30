<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Settings } from 'lucide-svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import LightSwitch from '$lib/components/LightSwitch.svelte';

	let message = $state('');
	let showAlways = $state(false);

	async function updateMessage() {
		try {
			const res = await fetch('/api/admin/message', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ message, showAlways }),
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.message || 'Erro ao atualizar a mensagem');
			}

			toast.success('Mensagem atualizada com sucesso');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Erro desconhecido');
		}
	}

	$effect(() => {
		fetch('/api/message')
			.then(res => {
				if (!res.ok) throw new Error('Erro ao obter a mensagem');
				return res.json();
			})
			.then(data => {
				message = data.message;
				showAlways = data.showAlways;
			});
	});
</script>

<svelte:head>
	<title>Gira+ | Admin</title>
</svelte:head>

<div class="absolute right-0 top-0 m-4 flex items-center gap-2">
	<Button variant="ghost" size="sm" href="/admin">Monitorização</Button>
	<Button variant="ghost" size="sm" href="/estatisticas">Estatísticas</Button>
	<LightSwitch />
</div>

<div class="container mx-auto py-12 px-4 max-w-6xl">
	<header class="mb-10">
		<div class="flex items-center mb-4">
			<Settings class="min-h-10 min-w-10 text-primary" />
			<h1 class="text-3xl font-bold ml-2">Configurações</h1>
		</div>
	</header>

	<div class="grid md:grid-cols-2 gap-8">
		<Card class="w-full">
			<CardHeader>
				<CardTitle>Mensagem ao abrir a app</CardTitle>
				<CardDescription>
					Esta mensagem é exibida quando a app é aberta.
					HTML é suportado.
				</CardDescription>
			</CardHeader>

			<CardContent>
				<form onsubmit={event => { event.preventDefault(); updateMessage(); }} class="space-y-4">
					<div class="space-y-2">
						<label for="message" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Mensagem</label>
						<Textarea
							id="message"
							bind:value={message}
							placeholder="Nova mensagem"
							rows={10}
						/>
					</div>

					<div class="items-top flex space-x-2">
						<Checkbox id="show-always" bind:checked={showAlways} />
						<div class="grid gap-1.5 leading-none">
							<Label
								for="show-always"
								class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								Mostrar sempre
							</Label>
							<p class="text-muted-foreground text-sm">
								Se ativado, a mensagem será exibida sempre que a app for aberta, mesmo que já tenha sido visualizada.
							</p>
						</div>
					</div>

					<div class="pt-4">
						<Button type="submit" variant="default" class="w-full">
							Atualizar Mensagem
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>Previsualização</CardTitle>
				<CardDescription>Previsualização da forma como a mensagem aparece na app</CardDescription>
			</CardHeader>
			<CardContent>
				{#if typeof window !== 'undefined'}
					{@html message}
				{/if}
			</CardContent>
		</Card>
	</div>
</div>
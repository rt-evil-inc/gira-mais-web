<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Settings, AlertTriangle } from 'lucide-svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
	} from '$lib/components/ui/dialog';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import LightSwitch from '$lib/components/LightSwitch.svelte';

	let message = $state('');
	let messageEn = $state('');
	let showAlways = $state(false);
	let activeTab = $state('pt');
	let showConfirmDialog = $state(false);

	function getWarningMessage() {
		const hasPortuguese = message.trim().length > 0;
		const hasEnglish = messageEn.trim().length > 0;

		if (hasPortuguese && !hasEnglish) {
			return 'A mensagem em inglês está vazia. Os utilizadores com idioma inglês verão a mensagem em português.';
		} else if (!hasPortuguese && hasEnglish) {
			return 'A mensagem em português está vazia. Os utilizadores com idioma português verão a mensagem em inglês.';
		}
		return null;
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		showConfirmDialog = true;
	}

	function confirmUpdate() {
		showConfirmDialog = false;
		updateMessage();
	}

	async function updateMessage() {
		try {
			const res = await fetch('/api/admin/message', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ message, messageEn, showAlways }),
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
		fetch('/api/admin/message')
			.then(res => {
				if (!res.ok) throw new Error('Erro ao obter a mensagem');
				return res.json();
			})
			.then(data => {
				message = data.message;
				messageEn = data.messageEn;
				showAlways = data.showAlways;
			});
	});
</script>

<svelte:head>
	<title>Gira+ | Admin</title>
</svelte:head>

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
				<form onsubmit={handleSubmit} class="space-y-4">
					<Tabs bind:value={activeTab} class="w-full">
						<TabsList class="grid grid-cols-2">
							<TabsTrigger value="pt">Português</TabsTrigger>
							<TabsTrigger value="en">Inglês</TabsTrigger>
						</TabsList>
						<TabsContent value="pt" class="space-y-4">
							<div class="space-y-2">
								<Textarea id="message-pt" bind:value={message} placeholder="Nova mensagem em português" rows={10} />
							</div>
						</TabsContent>
						<TabsContent value="en" class="space-y-4">
							<div class="space-y-2">
								<Textarea id="message-en" bind:value={messageEn} placeholder="Nova mensagem em inglês" rows={10} />
							</div>
						</TabsContent>
					</Tabs>
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
						<Dialog bind:open={showConfirmDialog}>
							<Button type="submit" variant="default" class="w-full">
								Atualizar Mensagem
							</Button>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Confirmar atualização da mensagem</DialogTitle>
									<DialogDescription>
										Tem a certeza que pretende atualizar a mensagem da aplicação?
									</DialogDescription>
								</DialogHeader>

								{#if getWarningMessage()}
									<Alert>
										<AlertTriangle class="h-4 w-4" />
										<AlertDescription>
											{getWarningMessage()}
										</AlertDescription>
									</Alert>
								{/if}

								<DialogFooter>
									<Button variant="outline" onclick={() => showConfirmDialog = false}>
										Cancelar
									</Button>
									<Button onclick={confirmUpdate}>
										Confirmar atualização
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</form>
			</CardContent>
		</Card>

		<Card class="flex flex-col">
			<CardHeader>
				<CardTitle>Previsualização</CardTitle>
				<CardDescription>Previsualização da forma como a mensagem aparece na app</CardDescription>
			</CardHeader>
			<CardContent class="grow">
				<div class="p-4 border rounded-lg bg-muted/50 h-full">
					<Tabs bind:value={activeTab}>
						<TabsContent value="pt">
							{#if typeof window !== 'undefined'}
								{@html message}
							{/if}
						</TabsContent>
						<TabsContent value="en">
							{#if typeof window !== 'undefined'}
								{@html messageEn}
							{/if}
						</TabsContent>
					</Tabs>
				</div>
			</CardContent>
		</Card>
	</div>
</div>
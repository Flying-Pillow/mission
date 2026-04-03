<!--
	@file apps/vscode-extension/src/webview/ConsoleTab.svelte
	@description Renders the operator console tab for Mission prompts and streamed output.
-->
<svelte:options runes={true} />

<script lang="ts">
	import type { MissionTimelineModel } from '../MissionTimelineViewModel.js';

	type ConsoleState = MissionTimelineModel['consoleState'];

	type Props = {
		consoleState: ConsoleState;
		onSendReply: (text: string) => void;
	};

	let { consoleState, onSendReply }: Props = $props();
	let consoleReply = $state('');
	let consoleBody = $state<HTMLDivElement | undefined>(undefined);

	const promptOptions = $derived.by(() => consoleState.promptOptions ?? []);

	$effect(() => {
		consoleState.lines.length;
		if (consoleBody) {
			consoleBody.scrollTop = consoleBody.scrollHeight;
		}
	});

	function submitReply(text: string): void {
		const normalized = text.trim();
		if (!normalized) {
			return;
		}

		onSendReply(normalized);
		consoleReply = '';
	}

	function handleConsoleKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' || !consoleState.awaitingInput) {
			return;
		}

		event.preventDefault();
		submitReply(consoleReply);
	}
</script>

<section class="mc-surface mc-console rounded-3xl overflow-hidden">
	<div
		class="flex flex-col gap-2 border-b border-(--vscode-panel-border) px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="text-sm font-semibold">Operator Console</div>
		<div class="mc-muted text-xs">
			{consoleState.awaitingInput
				? 'Waiting for input'
				: (consoleState.title ?? 'No active operator')}
		</div>
	</div>
	<div bind:this={consoleBody} class="max-h-80 overflow-auto px-4 py-3 font-mono text-xs leading-6">
		{#if consoleState.lines.length > 0}
			<pre>{consoleState.lines.join('\n')}</pre>
		{:else}
			<div class="mc-muted">Run a Mission operator to see streamed output here.</div>
		{/if}
	</div>
	<div class="grid gap-3 border-t border-(--vscode-panel-border) px-4 py-4">
		{#if promptOptions.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each promptOptions as option, index (`${option}:${index}`)}
					<button
						type="button"
						class="mc-tab-active rounded-full border px-3 py-1.5 text-xs font-semibold"
						onclick={() => {
							submitReply(option);
						}}
					>
						{option.length > 0 ? option : 'Enter'}
					</button>
				{/each}
			</div>
		{/if}
		<div class="grid gap-2 lg:grid-cols-[1fr_auto]">
			<input
				class="mc-input rounded-2xl px-3 py-2 text-sm disabled:opacity-50"
				type="text"
				placeholder="Reply to the active operator prompt"
				bind:value={consoleReply}
				disabled={!consoleState.awaitingInput}
				onkeydown={handleConsoleKeydown}
			/>
			<button
				type="button"
				class="mc-tab-active rounded-2xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
				disabled={!consoleState.awaitingInput}
				onclick={() => {
					submitReply(consoleReply);
				}}
			>
				Send
			</button>
		</div>
		<p class="mc-muted m-0 text-xs">
			Quick replies appear when Mission detects an operator prompt.
		</p>
	</div>
</section>

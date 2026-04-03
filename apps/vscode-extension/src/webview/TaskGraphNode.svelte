<!--
	@file apps/vscode-extension/src/webview/TaskGraphNode.svelte
	@description Renders a custom Svelte Flow node for a Mission execution flight.
-->
<svelte:options runes={true} />

<script lang="ts">
	import { Handle, Position, type Node, type NodeProps } from '@xyflow/svelte';
	import type { MissionTaskGraphNodeData } from './taskGraphTypes.js';

	type MissionTaskNode = Node<MissionTaskGraphNodeData, 'missionTask'>;

	let { data }: NodeProps<MissionTaskNode> = $props();

	function statusClass(statusLabel: string): string {
		switch (statusLabel) {
			case 'ready':
				return 'border-emerald-500/50 bg-emerald-500/12 text-emerald-600';
			case 'active':
				return 'border-sky-500/50 bg-sky-500/12 text-sky-600';
			case 'blocked':
				return 'border-orange-500/50 bg-orange-500/12 text-orange-600';
			default:
				return 'border-slate-500/40 bg-slate-500/12 text-slate-500';
		}
	}

	function progressClass(statusLabel: string): string {
		switch (statusLabel) {
			case 'ready':
				return 'bg-emerald-600';
			case 'active':
				return 'bg-sky-600';
			case 'blocked':
				return 'bg-orange-600';
			default:
				return 'bg-slate-500';
		}
	}

	function containerClass(nodeData: MissionTaskGraphNodeData): string {
		if (nodeData.selected) {
			return 'border-(--vscode-textLink-foreground) bg-[color-mix(in_srgb,var(--vscode-textLink-foreground)_10%,var(--vscode-editor-background))] ring-2 ring-[color-mix(in_srgb,var(--vscode-textLink-foreground)_35%,transparent)]';
		}

		if (nodeData.current) {
			return 'border-(--vscode-textLink-foreground) bg-[color-mix(in_srgb,var(--vscode-textLink-foreground)_8%,var(--vscode-editor-background))]';
		}

		if (nodeData.connected) {
			return 'border-(--vscode-panel-border) bg-[color-mix(in_srgb,var(--vscode-editor-background)_92%,white_8%)]';
		}

		return 'border-(--vscode-panel-border) bg-[color-mix(in_srgb,var(--vscode-editor-background)_88%,white_12%)] opacity-80';
	}
</script>

<Handle
	type="target"
	position={Position.Left}
	class="h-3! w-3! border-2! border-white/70! bg-(--vscode-panel-border)!"
/>

<div
	class={`w-70 rounded-3xl border p-4 shadow-lg transition ${containerClass(data)}`}
	role="button"
	tabindex="0"
	onclick={() => {
		data.onSelect(data.id);
	}}
	onkeydown={(event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			data.onSelect(data.id);
		}
	}}
>
	<div class="mb-3 flex items-start justify-between gap-3">
		<div>
			<h3 class="m-0 text-sm font-semibold leading-5">{data.title}</h3>
			<p class="mc-muted mt-1 text-xs leading-5">{data.summary}</p>
		</div>
		<span
			class={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase ${statusClass(data.statusLabel)}`}
		>
			{data.statusLabel}
		</span>
	</div>

	<div class="mb-3">
		<div class="mc-muted mb-1 flex justify-between text-[11px]">
			<span>Progress</span>
			<span>{data.progress}%</span>
		</div>
		<div class="h-2 rounded-full bg-black/10">
			<div
				class={`h-2 rounded-full ${progressClass(data.statusLabel)}`}
				style={`width: ${data.progress}%`}
			></div>
		</div>
	</div>

	{#if data.stale}
		<div
			class="mb-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-5"
		>
			Needs review after upstream changes.
		</div>
	{/if}

	<div class="mb-3 flex flex-wrap gap-2">
		{#if data.requiredSkills.length > 0}
			{#each data.requiredSkills.slice(0, 2) as skill (skill)}
				<span class="mc-pill rounded-full px-2 py-1 text-[11px]">{skill}</span>
			{/each}
		{:else}
			<span class="mc-pill rounded-full px-2 py-1 text-[11px]">No skill hint</span>
		{/if}
	</div>

	<button
		type="button"
		class="mc-tab-active nopan w-full rounded-2xl border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
		disabled={!data.actionEnabled}
		onclick={(event) => {
			event.stopPropagation();
			data.onOpenGuidance(data.id);
		}}
	>
		{data.actionEnabled ? 'Open Guidance' : 'View Current Flight'}
	</button>
</div>

<Handle
	type="source"
	position={Position.Right}
	class="h-3! w-3! border-2! border-white/70! bg-(--vscode-textLink-foreground)!"
/>

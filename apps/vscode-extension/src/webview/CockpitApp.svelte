<!--
	@file apps/vscode-extension/src/webview/CockpitApp.svelte
	@description Renders the Mission flight controller cockpit inside the VS Code sidebar webview.
-->
<svelte:options runes={true} />

<script lang="ts">
	import { onMount } from 'svelte';
	import Gauge from './Gauge.svelte';
	import type { MissionCockpitAction } from '../MissionModels.js';
	import type {
		MissionCockpitHostMessage,
		MissionCockpitMessage,
		MissionCockpitVisualState,
		MissionCockpitModel
	} from '../MissionCockpitViewModel.js';

	type VsCodeApi = {
		postMessage(message: MissionCockpitMessage): void;
	};

	const missionGlobal = globalThis as typeof globalThis & {
		__MISSION_CONTROL_COCKPIT_MODEL__?: MissionCockpitModel;
		acquireVsCodeApi?: () => VsCodeApi;
	};

	const initialModel = missionGlobal.__MISSION_CONTROL_COCKPIT_MODEL__;

	if (!initialModel) {
		throw new Error('Mission cockpit model is missing.');
	}

	const initialConsoleExpanded = initialModel.promptDock.awaitingInput;

	let model = $state(structuredClone(initialModel));
	let consoleReply = $state('');
	let consoleExpanded = $state(initialConsoleExpanded);
	let vscodeApi: VsCodeApi | undefined;

	onMount(() => {
		const acquireVsCodeApi = missionGlobal.acquireVsCodeApi;
		if (typeof acquireVsCodeApi === 'function') {
			vscodeApi = acquireVsCodeApi();
		}

		const handleMessage = (event: MessageEvent<MissionCockpitHostMessage>) => {
			if (event.data?.type !== 'cockpit-model') {
				return;
			}

			model = structuredClone(event.data.model);
			if (model.promptDock.awaitingInput) {
				consoleExpanded = true;
			}
		};

		window.addEventListener('message', handleMessage);
		return () => {
			window.removeEventListener('message', handleMessage);
		};
	});

	function postMessage(message: MissionCockpitMessage): void {
		vscodeApi?.postMessage(message);
	}

	function sendReply(text: string): void {
		const normalized = text.trim();
		if (!normalized) {
			return;
		}

		postMessage({
			type: 'console-reply',
			text: normalized
		});
		consoleReply = '';
	}

	function handleConsoleKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' || !model.promptDock.awaitingInput) {
			return;
		}

		event.preventDefault();
		sendReply(consoleReply);
	}

	function toneClass(tone: MissionCockpitVisualState | 'warning'): string {
		switch (tone) {
			case 'ready':
				return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
			case 'active':
				return 'border-sky-400/45 bg-sky-400/12 text-sky-200';
			case 'blocked':
				return 'border-rose-400/45 bg-rose-400/12 text-rose-200';
			case 'warning':
				return 'border-amber-400/45 bg-amber-400/12 text-amber-200';
			case 'idle':
			default:
				return 'border-white/8 bg-white/4 text-slate-300';
		}
	}

	function utilityAction(id: MissionCockpitModel['utilities'][number]['id']): void {
		switch (id) {
			case 'refresh':
				postMessage({ type: 'refresh' });
				return;
			case 'roadmap':
				postMessage({ type: 'open-roadmap' });
				return;
			case 'chat':
				postMessage({ type: 'open-chat' });
				return;
			case 'folder':
				postMessage({ type: 'open-folder' });
				return;
			case 'implement-gate':
				postMessage({ type: 'preview-gate', intent: 'implement' });
				return;
		}
	}

	function previewArtifactFromGauge(artifactKey: string | undefined): void {
		if (!artifactKey) {
			return;
		}

		postMessage({
			type: 'open-artifact-preview',
			artifactKey
		});
	}

	function openArtifact(artifact: MissionCockpitModel['artifacts'][number]): void {
		if (artifact.action) {
			runCockpitAction(artifact.action);
			return;
		}

		postMessage({
			type: 'open-artifact-preview',
			artifactKey: artifact.artifactKey
		});
	}

	const promptOptions = $derived.by(() => model.promptDock.promptOptions ?? []);
	const activeRailSlice = $derived.by(() => model.sliceRail.find((slice) => slice.active));
	const missionTitle = $derived.by(() => model.missionTitle?.trim() || 'Active mission');
	const gaugeSummary = $derived.by(() => {
		const stage = model.stageGauge.activeLabel;
		const slice = model.sliceGauge.activeLabel;
		return slice ? `${stage} - ${slice}` : stage;
	});
	const activeTaskLabel = $derived.by(
		() => activeRailSlice?.nextTaskLabel ?? model.operatorState.nextTaskLabel
	);
	const staleCount = $derived.by(
		() =>
			model.artifacts.filter((artifact) => artifact.stale).length +
			model.sliceRail.filter((slice) => slice.stale).length
	);
	const dominantAction = $derived.by(() => {
		if (model.proceedAction) {
			return model.proceedAction;
		}

		if (model.primaryAction) {
			return {
				label: model.primaryAction.ctaLabel,
				hint: model.primaryAction.reason,
				action: model.primaryAction.action
			};
		}

		return undefined;
	});
	const normalFlowGroup = $derived.by(() =>
		model.actionGroups.find((group) => group.id === 'normal-flow')
	);
	const checkpointGroup = $derived.by(() =>
		model.actionGroups.find((group) => group.id === 'checkpoint')
	);
	const interventionGroup = $derived.by(() =>
		model.actionGroups.find((group) => group.id === 'intervention')
	);

	type CockpitTaskItem = MissionCockpitModel['sliceRail'][number]['tasks'][number];

	function taskStatusLabel(task: CockpitTaskItem): string {
		if (task.completed) {
			return 'Done';
		}

		switch (task.status) {
			case 'allowed':
				return 'Now';
			case 'ready':
				return 'Ready';
			case 'blocked':
				return 'Blocked';
			case 'draft':
			default:
				return 'Draft';
		}
	}

	function updateTaskCheck(task: CockpitTaskItem, completed: boolean): void {
		postMessage({
			type: 'toggle-task',
			taskId: task.taskId,
			completed
		});
	}

	function runCockpitAction(action: MissionCockpitAction): void {
		postMessage({ type: 'run-action', action });
	}

	function actionButtonClass(
		groupId: MissionCockpitModel['actionGroups'][number]['id']
	): string {
		return groupId === 'intervention' ? 'mc-cockpit-button-warning' : 'mc-cockpit-button-primary';
	}

	function flightDisplayTitle(title: string): string {
		const normalized = title.replace(/^slice\s+\d+\s*:\s*/i, '').trim();
		return normalized.length > 0 ? normalized : title;
	}
</script>

<div class="mc-cockpit-shell min-h-screen px-3 pb-4 pt-3 text-(--vscode-foreground)">
	<div class="mc-cockpit-header mb-3 rounded-3xl border px-4 pb-3 pt-3">
		<div class="mb-2 flex items-start gap-3">
			<div class="min-w-0">
				<h1 class="m-0 text-[20px] font-semibold tracking-tight">{model.missionId}</h1>
				<p class="mc-muted mt-2 text-xs leading-5">
					{missionTitle}
				</p>
				<p class="mc-header-summary mt-1 text-xs leading-5">{model.pulseSummary}</p>
			</div>
		</div>

		{#if activeRailSlice}
			<p class="m-0 mb-2 text-xs leading-5 text-slate-200/88">
				Active flight: {flightDisplayTitle(activeRailSlice.title)}
			</p>
		{/if}

		<div class="mb-3 h-1.5 overflow-hidden rounded-full bg-white/8">
			<div class="mc-pulse-progress h-full" style={`width: ${model.stageProgressPercent}%`}></div>
		</div>

		<div class="flex flex-wrap gap-2">
			<span
				class={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase ${toneClass(model.stageGauge.segments[model.stageGauge.activeIndex]?.state ?? 'idle')}`}
			>
				{model.stageGauge.activeLabel}
			</span>
			<span
				class={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase ${toneClass(model.operatorState.stateTone)}`}
			>
				{model.operatorState.modeLabel}
			</span>
			<span
				class={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase ${toneClass(model.gateSummary.stateTone)}`}
			>
				{model.gateSummary.label}
			</span>
			{#if staleCount > 0}
				<span class="rounded-full border border-amber-400/45 bg-amber-400/12 px-3 py-1 text-[11px] font-semibold uppercase text-amber-200">
					{staleCount} stale
				</span>
			{/if}
		</div>
	</div>

	<div class="mc-flight-card mb-3 rounded-3xl border p-4">
		<div class="mb-3 flex items-start justify-between gap-3">
			<div class="min-w-0">
				<div class="mc-cockpit-label">Next Action Deck</div>
				<h2 class="m-0 mt-1 text-[17px] font-semibold tracking-tight">
					{model.operatorState.headline}
				</h2>
			</div>
			<span
				class={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase ${toneClass(model.gateSummary.stateTone)}`}
			>
				{model.gateSummary.label}
			</span>
		</div>

		<p class="mc-header-summary m-0 text-sm leading-6">{model.operatorState.detail}</p>

		<div class="mt-3 flex flex-wrap gap-2">
			{#if activeTaskLabel}
				<span class="mc-gauge-metadata rounded-full px-3 py-1 text-[11px]">
					Next task: {activeTaskLabel}
				</span>
			{/if}
			{#if model.operatorState.stopCondition}
				<span class="mc-gauge-metadata rounded-full px-3 py-1 text-[11px]">
					Stop: {model.operatorState.stopCondition}
				</span>
			{/if}
		</div>

		{#if dominantAction}
			<div class="mt-4 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-3 py-3">
				<div class="text-sm font-semibold text-slate-100">{dominantAction.label}</div>
				<p class="mc-header-summary m-0 mt-1 text-sm leading-6">{dominantAction.hint}</p>
				<div class="mt-3">
					<button
						type="button"
						class="mc-cockpit-button-primary rounded-full px-4 py-2 text-xs font-semibold"
						onclick={() => {
							runCockpitAction(dominantAction.action);
						}}
					>
						{dominantAction.label}
					</button>
				</div>
			</div>
		{/if}

		{#if model.operatorState.blockers.length > 0}
			<div class="mc-cockpit-detail mt-3 rounded-2xl border px-3 py-3">
				<div class="mc-cockpit-label mb-2">Blocking Rules</div>
				<div class="grid gap-2">
					{#each model.operatorState.blockers as blocker, index (`${blocker}:${index}`)}
						<p class="m-0 text-sm leading-6 text-rose-100/90">{blocker}</p>
					{/each}
				</div>
			</div>
		{/if}

		{#if !dominantAction && normalFlowGroup?.actions.length}
			<div class="mc-action-group mt-3 rounded-3xl border px-3 py-3">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h3 class="m-0 text-[15px] font-semibold tracking-tight">{normalFlowGroup.title}</h3>
						<p class="mc-header-summary m-0 mt-1 text-xs leading-5">Primary governed path</p>
					</div>
					<span class={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase ${toneClass(normalFlowGroup.stateTone)}`}>
						Go
					</span>
				</div>
				<div class="mt-3 grid gap-2">
					{#each normalFlowGroup.actions as action (`normal:${action.label}:${action.hint}`)}
						<div class="mc-cockpit-detail rounded-2xl border px-3 py-3">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="text-sm font-semibold text-slate-100">{action.label}</div>
									<p class="mc-header-summary m-0 mt-1 text-sm leading-6">{action.hint}</p>
								</div>
								<button
									type="button"
									class="mc-cockpit-button-primary rounded-full px-3 py-1.5 text-xs font-semibold"
									onclick={() => {
										runCockpitAction(action.action);
									}}
								>
									{action.label}
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if checkpointGroup?.actions.length}
			<div class="mc-action-group mt-3 rounded-3xl border px-3 py-3">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h3 class="m-0 text-[15px] font-semibold tracking-tight">{checkpointGroup.title}</h3>
						<p class="mc-header-summary m-0 mt-1 text-xs leading-5">Review and confirmation actions</p>
					</div>
					<span class={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase ${toneClass(checkpointGroup.stateTone)}`}>
						Review
					</span>
				</div>
				<div class="mt-3 grid gap-2">
					{#each checkpointGroup.actions as action (`checkpoint:${action.label}:${action.hint}`)}
						<div class="mc-cockpit-detail rounded-2xl border px-3 py-3">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="text-sm font-semibold text-slate-100">{action.label}</div>
									<p class="mc-header-summary m-0 mt-1 text-sm leading-6">{action.hint}</p>
								</div>
								<button
									type="button"
									class="mc-cockpit-button-secondary rounded-full px-3 py-1.5 text-xs font-semibold"
									onclick={() => {
										runCockpitAction(action.action);
									}}
								>
									{action.label}
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if interventionGroup?.actions.length}
			<div class="mc-action-group mt-3 rounded-3xl border px-3 py-3">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h3 class="m-0 text-[15px] font-semibold tracking-tight">{interventionGroup.title}</h3>
						<p class="mc-header-summary m-0 mt-1 text-xs leading-5">Use only when deviating from normal flow</p>
					</div>
					<span class={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase ${toneClass(interventionGroup.stateTone)}`}>
						Deliberate
					</span>
				</div>
				<div class="mt-3 grid gap-2">
					{#each interventionGroup.actions as action (`intervention:${action.label}:${action.hint}`)}
						<div class="mc-cockpit-detail rounded-2xl border px-3 py-3">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="text-sm font-semibold text-slate-100">{action.label}</div>
									<p class="mc-header-summary m-0 mt-1 text-sm leading-6">{action.hint}</p>
								</div>
								<button
									type="button"
									class="mc-cockpit-button-warning rounded-full px-3 py-1.5 text-xs font-semibold"
									onclick={() => {
										runCockpitAction(action.action);
									}}
								>
									{action.label}
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="mc-flight-card mb-3 rounded-3xl border p-4">
		<div class="mb-3 flex items-center justify-between gap-3">
			<div class="mc-cockpit-label">Artifact Corridor</div>
			<div class="text-[11px] uppercase tracking-[0.12em] text-slate-300/85">Governed sequence</div>
		</div>
		<div class="mc-artifact-corridor pb-1">
			{#each model.artifacts as artifact (artifact.artifactKey)}
				<button
					type="button"
					class={`mc-artifact-item ${artifact.focused ? 'mc-artifact-item-focused' : ''}`}
					onclick={() => {
						openArtifact(artifact);
					}}
				>
					<div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100/88">
						{artifact.label}
					</div>
					<div class="mt-2 flex flex-wrap gap-1.5">
						<span class={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${toneClass(artifact.stateTone)}`}>
							{artifact.validationLabel}
						</span>
						<span class="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase text-slate-300/90">
							{artifact.checkpointLabel}
						</span>
						{#if artifact.stale}
							<span class="rounded-full border border-amber-400/45 bg-amber-400/12 px-2 py-0.5 text-[10px] uppercase text-amber-200">
								Stale
							</span>
						{/if}
					</div>
					{#if artifact.actionLabel}
						<div class="mt-2 text-[11px] text-sky-200/90">{artifact.actionLabel}</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<div class="mc-flight-card mb-3 rounded-3xl border p-4">
		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-2">
				<Gauge
					gauge={model.stageGauge}
					size={168}
					onSegmentClick={(segment) => {
						previewArtifactFromGauge(segment.artifactKey);
					}}
				/>
			</div>
			<div class="flex flex-col gap-2">
				<Gauge gauge={model.sliceGauge} size={168} />
			</div>
		</div>
		<div class="mt-2">
			<div class="mc-gauge-badge rounded-full px-3 py-1.5 text-[8px] uppercase">
				<span class="mc-gauge-badge-text">{gaugeSummary}</span>
			</div>
		</div>
	</div>

	{#if activeRailSlice}
		<div class="mc-slice-card mc-slice-card-active mb-3 rounded-[1.75rem] border p-3">
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<div class="mc-cockpit-label">Current Flight</div>
					<div class="mc-slice-kicker mb-2 text-[10px] uppercase tracking-[0.18em]">
						Flight {String(activeRailSlice.sequence).padStart(2, '0')}
					</div>
					<h3 class="m-0 text-[15px] font-semibold tracking-tight">
						{flightDisplayTitle(activeRailSlice.title)}
					</h3>
				</div>
				<div class="flex flex-col items-end gap-2">
					<span
						class={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${toneClass(activeRailSlice.stateTone)}`}
					>
						{activeRailSlice.statusLabel}
					</span>
					<button
						type="button"
						class="mc-cockpit-button-secondary rounded-full px-3 py-1.5 text-xs font-semibold"
						onclick={() => {
							runCockpitAction(activeRailSlice.openAction);
						}}
					>
						Open Guidance
					</button>
				</div>
			</div>

			<div class="mt-3 flex flex-wrap gap-2">
				{#if activeRailSlice.nextTaskLabel}
					<span class="mc-slice-next rounded-full px-3 py-1 text-[11px]">
						Next: {activeRailSlice.nextTaskLabel}
					</span>
				{/if}
				{#if activeRailSlice.stopCondition}
					<span class="mc-slice-next rounded-full px-3 py-1 text-[11px]">
						Stop: {activeRailSlice.stopCondition}
					</span>
				{/if}
			</div>

			<details class="mc-cockpit-detail mt-3 rounded-2xl border px-3 py-3">
				<summary class="flex cursor-pointer items-center justify-between gap-3">
					<div>
						<div class="text-sm font-semibold text-slate-100">Flight Context</div>
						<p class="mc-header-summary m-0 mt-1 text-sm leading-6">
							Expand for flight outcome, verification targets, and required skills.
						</p>
					</div>
					<span class="mc-cockpit-label">Expand</span>
				</summary>

				<div class="mt-3 grid gap-3">
					{#if activeRailSlice.summary}
						<div>
							<div class="mc-cockpit-label mb-1">Outcome</div>
							<p class="mc-slice-summary m-0 text-sm leading-6">{activeRailSlice.summary}</p>
						</div>
					{/if}
					{#if activeRailSlice.verificationTargets.length > 0}
						<div>
							<div class="mc-cockpit-label mb-1">Verification Targets</div>
							<div class="flex flex-wrap gap-2">
								{#each activeRailSlice.verificationTargets as target (`verify:${target}`)}
									<span class="mc-gauge-metadata rounded-full px-3 py-1 text-[11px]">{target}</span>
								{/each}
							</div>
						</div>
					{/if}
					{#if activeRailSlice.requiredSkills.length > 0}
						<div>
							<div class="mc-cockpit-label mb-1">Required Skills</div>
							<div class="flex flex-wrap gap-2">
								{#each activeRailSlice.requiredSkills as skill (`skill:${skill}`)}
									<span class="mc-gauge-metadata rounded-full px-3 py-1 text-[11px]">{skill}</span>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</details>

			<div class="mt-3 grid gap-2">
				{#each activeRailSlice.tasks as task (`${activeRailSlice.title}:${task.taskId}`)}
					<div class="mc-cockpit-task rounded-2xl border px-3 py-2 text-sm">
						<div class="min-w-0 flex-1">
							<p
								title={task.summary}
								class={`mc-task-label m-0 leading-6 ${task.completed ? 'text-slate-400 line-through decoration-slate-500/70' : 'text-slate-100'}`}
							>
								{task.title}
							</p>
							<p class="mc-muted mt-1 mb-0 text-xs leading-5">{task.summary}</p>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<span class="mc-cockpit-task-tag rounded-full px-2 py-1 text-[10px] uppercase">
								{taskStatusLabel(task)}
							</span>
							{#if task.completed}
								<button
									type="button"
									class="mc-cockpit-button-secondary rounded-full px-3 py-1 text-[10px] font-semibold uppercase"
									onclick={() => {
										updateTaskCheck(task, false);
									}}
								>
									Reopen
								</button>
							{:else if task.status === 'allowed'}
								<button
									type="button"
									class="mc-cockpit-button-primary rounded-full px-3 py-1 text-[10px] font-semibold uppercase"
									onclick={() => {
										updateTaskCheck(task, true);
									}}
								>
									Mark Done
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class={`mc-flight-card mb-3 rounded-3xl border p-4 ${model.promptDock.awaitingInput ? 'mc-prompt-dock-awaiting' : ''}`}>
		<div class="mb-3 flex items-center justify-between gap-3">
			<div class="mc-cockpit-label">Prompt Dock</div>
			<button
				type="button"
				class="mc-cockpit-button-secondary rounded-full px-3 py-1 text-xs font-semibold"
				onclick={() => {
					consoleExpanded = !consoleExpanded;
				}}
			>
				{consoleExpanded ? 'Collapse' : 'Expand'}
			</button>
		</div>

		{#if consoleExpanded}
			{#if model.promptDock.awaitingInput}
				<p class="mb-3 text-sm leading-6 text-sky-200/90">Flight Controller input is required.</p>
			{:else}
				<p class="mb-3 text-sm leading-6 text-slate-300">
					Prompt dock is idle. Live prompts will expand this area automatically.
				</p>
			{/if}

			{#if model.promptDock.lines.length > 0}
				<div
					class="mc-cockpit-console mb-3 max-h-44 overflow-auto rounded-2xl border p-3 font-mono text-[11px] leading-6 text-slate-200/90"
				>
					<pre>{model.promptDock.lines.join('\n')}</pre>
				</div>
			{/if}

			{#if promptOptions.length > 0}
				<div class="mb-3 flex flex-wrap gap-2">
					{#each promptOptions as option, index (`${option}:${index}`)}
						<button
							type="button"
							class="mc-cockpit-button-secondary rounded-full px-3 py-1.5 text-xs font-semibold"
							onclick={() => {
								sendReply(option);
							}}
						>
							{option.length > 0 ? option : 'Enter'}
						</button>
					{/each}
				</div>
			{/if}

			<div class="grid gap-2 lg:grid-cols-[1fr_auto]">
				<input
					class="mc-cockpit-input rounded-2xl px-3 py-2 text-sm disabled:opacity-50"
					type="text"
					placeholder="Reply to the active flight controller prompt"
					bind:value={consoleReply}
					disabled={!model.promptDock.awaitingInput}
					onkeydown={handleConsoleKeydown}
				/>
				<button
					type="button"
					class="mc-cockpit-button-primary rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!model.promptDock.awaitingInput}
					onclick={() => {
						sendReply(consoleReply);
					}}
				>
					Send
				</button>
			</div>
		{:else}
			<p class="text-sm text-slate-300">Prompt Dock is collapsed.</p>
		{/if}
	</div>

	<div class="mc-flight-card rounded-3xl border p-4">
		<div class="mc-cockpit-label mb-3">Utilities</div>
		<div class="grid grid-cols-2 gap-2">
			{#each model.utilities as utility (utility.id)}
				<button
					type="button"
					class="mc-cockpit-utility rounded-2xl border px-3 py-3 text-left"
					onclick={() => {
						utilityAction(utility.id);
					}}
				>
					<div class="text-sm font-semibold text-slate-100">{utility.label}</div>
					<div class="mt-1 text-xs leading-5 text-slate-400">{utility.description}</div>
				</button>
			{/each}
		</div>
	</div>
</div>

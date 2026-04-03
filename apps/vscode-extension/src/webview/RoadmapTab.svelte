<!--
	@file apps/vscode-extension/src/webview/RoadmapTab.svelte
	@description Renders the roadmap tab content for Mission execution flights.
-->
<svelte:options runes={true} />

<script lang="ts">
	import type { MissionTimelineTask } from '../MissionTimelineViewModel.js';

	type Props = {
		tasks: MissionTimelineTask[];
		onOpenGuidance: (task: MissionTimelineTask) => void;
		onToggleTask: (task: MissionTimelineTask, taskId: string, completed: boolean) => void;
	};

	let { tasks, onOpenGuidance, onToggleTask }: Props = $props();

	function statusPillClass(task: MissionTimelineTask): string {
		switch (task.statusLabel) {
			case 'ready':
				return 'text-emerald-600';
			case 'active':
				return 'text-sky-600';
			case 'blocked':
				return 'text-orange-600';
			default:
				return 'text-slate-500';
		}
	}

	function progressBarClass(task: MissionTimelineTask): string {
		switch (task.statusLabel) {
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

	function handleWorkItemToggle(task: MissionTimelineTask, taskId: string, event: Event): void {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) {
			return;
		}

		onToggleTask(task, taskId, input.checked);
	}
</script>

<section class="grid gap-4">
	<div
		class="mc-surface rounded-2xl border-l-4 border-l-(--vscode-textLink-foreground) px-4 py-3 text-sm"
	>
		<div class="font-semibold">Mission flights: {tasks.length}</div>
		<p class="mc-muted mt-1 mb-0 leading-6">
			Open flight guidance from any card, track bounded work items, and verify each flight before
			closing it.
		</p>
	</div>

	<div class="grid gap-4">
		{#each tasks as task (task.id)}
			<article class="mc-card rounded-3xl border-l-4 border-l-slate-500 p-4">
				<div class="mb-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
					<div class="min-w-0">
						<div class="mb-2 flex items-center gap-3">
							<div
								class="flex h-9 w-9 items-center justify-center rounded-full bg-(--vscode-textLink-foreground) text-sm font-bold text-white"
							>
								{task.sequence}
							</div>
							<h2 class="m-0 text-base font-semibold">
								Flight {String(task.sequence).padStart(2, '0')}: {task.displayTitle}
							</h2>
						</div>
						<p class="mc-muted m-0 text-sm">{task.taskSummary}</p>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<span
							class={`mc-pill rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusPillClass(task)}`}
						>
							{task.statusLabel}
						</span>
						<button
							type="button"
							class="mc-tab-active rounded-full border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
							disabled={!task.actionEnabled}
							title={task.actionHint}
							onclick={() => {
								onOpenGuidance(task);
							}}
						>
							{task.actionLabel}
						</button>
					</div>
				</div>

				{#if task.stale}
					<div
						class="mb-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-5"
					>
						Stale downstream output: {task.staleReason ?? 'This flight should be reviewed again.'}
					</div>
				{/if}

				<div class="mb-3">
					<div class="mc-muted mb-1 flex justify-between text-xs">
						<span>Progress</span>
						<span>{task.progress}%</span>
					</div>
					<div class="h-2 rounded-full bg-black/10">
						<div
							class={`h-2 rounded-full ${progressBarClass(task)}`}
							style={`width: ${task.progress}%`}
						></div>
					</div>
				</div>

				<div class="mb-3 flex flex-wrap gap-2">
					<span class="mc-pill rounded-full px-3 py-1 text-xs">{task.relativeEffortLabel}</span>
					<span class="mc-pill rounded-full px-3 py-1 text-xs">
						Depends on:
						{#if task.dependencyDisplayLabels.length > 0}
							{task.dependencyDisplayLabels.join(', ')}
						{:else}
							Starts the mission flow
						{/if}
					</span>
				</div>

				{#if task.goal}
					<p class="mb-3 text-sm leading-6">Goal: {task.goal}</p>
				{/if}

				<details class="border-t border-black/10 pt-3">
					<summary class="mc-link cursor-pointer text-sm font-semibold">Contributor details</summary
					>
					<div class="mt-3 grid gap-3 xl:grid-cols-2">
						<div class="mc-detail rounded-2xl p-3">
							<h3 class="mc-muted mb-2 text-xs font-semibold uppercase tracking-[0.08em]">
								Work in this flight
							</h3>
							<ul class="m-0 grid list-none gap-2 p-0 text-sm">
								{#if task.workItems.length > 0}
									{#each task.workItems as item (`${task.id}:${item.taskId}`)}
										<li>
											<label class="flex items-start gap-3">
												<input
													type="checkbox"
													checked={item.completed}
													onchange={(event) => {
														handleWorkItemToggle(task, item.taskId, event);
													}}
												/>
												<span
													class="mc-pill rounded-full px-2 py-0.5 text-[11px] font-bold uppercase"
												>
													{item.completed ? 'Done' : item.status === 'allowed' ? 'Now' : 'Next'}
												</span>
												<span>
													<span class="block font-medium">{item.title}</span>
													<span class="mc-muted block text-xs leading-5">{item.summary}</span>
												</span>
											</label>
										</li>
									{/each}
								{:else}
									<li class="mc-muted">No bounded work items listed.</li>
								{/if}
							</ul>
						</div>

						<div class="mc-detail rounded-2xl p-3">
							<h3 class="mc-muted mb-2 text-xs font-semibold uppercase tracking-[0.08em]">
								Verify before closing
							</h3>
							<ul class="m-0 grid gap-2 pl-5 text-sm">
								{#if task.verificationTargets.length > 0}
									{#each task.verificationTargets as target (target)}
										<li>{target}</li>
									{/each}
								{:else}
									<li class="mc-muted">No explicit verification targets listed.</li>
								{/if}
							</ul>
						</div>

						<div class="mc-detail rounded-2xl p-3">
							<h3 class="mc-muted mb-2 text-xs font-semibold uppercase tracking-[0.08em]">
								Needs first
							</h3>
							<ul class="m-0 grid gap-2 pl-5 text-sm">
								{#if task.dependencyDisplayLabels.length > 0}
									{#each task.dependencyDisplayLabels as label (label)}
										<li>{label}</li>
									{/each}
								{:else}
									<li class="mc-muted">This flight can start immediately.</li>
								{/if}
							</ul>
						</div>

						<div class="mc-detail rounded-2xl p-3">
							<h3 class="mc-muted mb-2 text-xs font-semibold uppercase tracking-[0.08em]">
								Skills in play
							</h3>
							<div class="flex flex-wrap gap-2 text-sm">
								{#if task.requiredSkills.length > 0}
									{#each task.requiredSkills as skill (skill)}
										<span class="mc-pill rounded-full px-3 py-1 text-xs">{skill}</span>
									{/each}
								{:else}
									<span class="mc-pill rounded-full px-3 py-1 text-xs">No skill hint listed</span>
								{/if}
							</div>
							{#if task.stopCondition}
								<p class="mt-3 text-sm leading-6">Done when: {task.stopCondition}</p>
							{/if}
						</div>
					</div>
				</details>
			</article>
		{/each}
	</div>
</section>

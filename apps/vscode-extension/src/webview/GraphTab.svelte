<!--
	@file apps/vscode-extension/src/webview/GraphTab.svelte
	@description Renders the dependency graph tab and selected flight details for Mission.
-->
<svelte:options runes={true} />

<script lang="ts">
	import {
		Background,
		BackgroundVariant,
		Controls,
		MarkerType,
		Position,
		SvelteFlow,
		type Edge,
		type Node,
		type NodeTypes
	} from '@xyflow/svelte';
	import TaskGraphNode from './TaskGraphNode.svelte';
	import type { MissionTimelineTask } from '../MissionTimelineViewModel.js';
	import type { MissionTaskGraphNodeData } from './taskGraphTypes.js';

	type GraphScope = 'all' | 'selected';
	type GraphColumn = {
		title: string;
		tasks: MissionTimelineTask[];
	};
	type GraphEdge = Edge;
	type GraphNode = Node<MissionTaskGraphNodeData, 'missionTask'>;
	type Props = {
		tasks: MissionTimelineTask[];
		currentSlice?: string;
		selectedTaskId: string;
		graphScope: GraphScope;
		onSelectTask: (taskId: string) => void;
		onSetGraphScope: (scope: GraphScope) => void;
		onOpenGuidance: (task: MissionTimelineTask) => void;
	};

	let {
		tasks,
		currentSlice,
		selectedTaskId,
		graphScope,
		onSelectTask,
		onSetGraphScope,
		onOpenGuidance
	}: Props = $props();

	const graphNodeTypes: NodeTypes = {
		missionTask: TaskGraphNode as unknown as NodeTypes[string]
	};
	const graphColumns = $derived.by(() => buildGraphColumns(tasks));
	const selectedNeighborhoodIds = $derived.by(() =>
		buildNeighborhoodTaskIds(tasks, selectedTaskId)
	);
	const visibleTasks = $derived.by(() =>
		graphScope === 'selected' ? tasks.filter((task) => selectedNeighborhoodIds.has(task.id)) : tasks
	);
	const selectedTask = $derived.by(
		() => tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null
	);
	const flowNodes = $derived.by(() =>
		buildFlowNodes(visibleTasks, selectedTaskId, selectedNeighborhoodIds)
	);
	const flowEdges = $derived.by(() => buildFlowEdges(visibleTasks, selectedTaskId));
	const visibleTaskCount = $derived.by(() => visibleTasks.length);

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

	function buildGraphColumns(inputTasks: MissionTimelineTask[]): GraphColumn[] {
		const maxDependencyCount = inputTasks.reduce(
			(maximum, task) => Math.max(maximum, task.dependencyLabels.length),
			0
		);

		return Array.from({ length: maxDependencyCount + 1 }, (_, index) => ({
			title:
				index === 0 ? 'Start' : index === 1 ? 'Depends on 1 flight' : `Depends on ${index} flights`,
			tasks: inputTasks.filter((task) => task.dependencyLabels.length === index)
		})).filter((column) => column.tasks.length > 0);
	}

	function focusSelectedTask(): void {
		if (!selectedTaskId) {
			return;
		}

		onSetGraphScope('selected');
	}

	function showFullGraph(): void {
		onSetGraphScope('all');
	}

	function jumpToCurrentSlice(): void {
		const currentTask = tasks.find((task) => task.name === currentSlice);
		if (!currentTask) {
			return;
		}

		onSelectTask(currentTask.id);
		onSetGraphScope('selected');
	}

	function openGuidanceById(taskId: string): void {
		const task = tasks.find((entry) => entry.id === taskId);
		if (!task) {
			return;
		}

		onOpenGuidance(task);
	}

	function buildFlowNodes(
		inputTasks: MissionTimelineTask[],
		activeTaskId: string,
		connectedTaskIds: Set<string>
	): GraphNode[] {
		const maxNodesPerRow = 3;
		const horizontalGap = 360;
		const verticalGap = 440;

		return inputTasks.map((task, index) => {
			const column = index % maxNodesPerRow;
			const row = Math.floor(index / maxNodesPerRow);

			const nodeData: MissionTaskGraphNodeData = {
				id: task.id,
				title: `Flight ${String(task.sequence).padStart(2, '0')}: ${task.displayTitle}`,
				statusLabel: task.statusLabel,
				progress: task.progress,
				summary: task.taskSummary,
				stale: task.stale,
				current: task.id === activeTaskId,
				selected: task.id === activeTaskId,
				connected: connectedTaskIds.has(task.id),
				actionEnabled: task.actionEnabled,
				requiredSkills: task.requiredSkills,
				onSelect: onSelectTask,
				onOpenGuidance: openGuidanceById
			};

			return {
				id: task.id,
				type: 'missionTask',
				position: {
					x: column * horizontalGap,
					y: row * verticalGap
				},
				data: nodeData,
				sourcePosition: Position.Right,
				targetPosition: Position.Left,
				selectable: false,
				draggable: false
			} satisfies GraphNode;
		});
	}

	function buildFlowEdges(inputTasks: MissionTimelineTask[], activeTaskId: string): GraphEdge[] {
		const tasksByName = new Map(inputTasks.map((task) => [task.name, task]));
		const edges: GraphEdge[] = [];

		for (const task of inputTasks) {
			for (const dependencyLabel of task.dependencyLabels) {
				const dependencyTask = tasksByName.get(dependencyLabel);
				if (!dependencyTask) {
					continue;
				}

				const edgeIsSelected = dependencyTask.id === activeTaskId || task.id === activeTaskId;
				const statusColor = edgeColorForStatus(task.statusLabel);
				const strokeOpacity = edgeIsSelected ? 1 : task.statusLabel === 'ready' ? 0.52 : 0.7;
				const strokeWidth = edgeIsSelected ? 3.2 : task.statusLabel === 'active' ? 2.8 : 1.9;

				edges.push({
					id: `${dependencyTask.id}-${task.id}`,
					source: dependencyTask.id,
					target: task.id,
					type: 'smoothstep',
					animated: task.statusLabel === 'active',
					markerEnd: {
						type: MarkerType.ArrowClosed,
						width: 18,
						height: 18,
						color: statusColor
					},
					style: `stroke: ${statusColor}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth};`
				});
			}
		}

		return edges;
	}

	function edgeColorForStatus(statusLabel: string): string {
		switch (statusLabel) {
			case 'ready':
				return 'rgb(5 150 105)';
			case 'active':
				return 'rgb(2 132 199)';
			case 'blocked':
				return 'rgb(234 88 12)';
			default:
				return 'var(--vscode-descriptionForeground)';
		}
	}

	function buildNeighborhoodTaskIds(
		inputTasks: MissionTimelineTask[],
		centerTaskId: string
	): Set<string> {
		if (!centerTaskId) {
			return new Set(inputTasks.map((task) => task.id));
		}

		const tasksByName = new Map(inputTasks.map((task) => [task.name, task]));
		const centerTask = inputTasks.find((task) => task.id === centerTaskId);
		if (!centerTask) {
			return new Set(inputTasks.map((task) => task.id));
		}

		const relatedTaskIds = new Set<string>([centerTask.id]);

		for (const dependencyLabel of centerTask.dependencyLabels) {
			const dependencyTask = tasksByName.get(dependencyLabel);
			if (dependencyTask) {
				relatedTaskIds.add(dependencyTask.id);
			}
		}

		for (const task of inputTasks) {
			if (task.dependencyLabels.includes(centerTask.name)) {
				relatedTaskIds.add(task.id);
			}
		}

		return relatedTaskIds;
	}
</script>

<section class="mc-surface rounded-3xl p-4">
	<div class="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
		<div>
			<h2 class="m-0 text-base font-semibold">Dependency Graph</h2>
			<p class="mc-muted mt-1 text-sm">
				Select a flight to inspect its dependency context, verification targets, and jump directly
				into Mission guidance.
			</p>
			<p class="mc-muted mt-2 text-xs uppercase tracking-[0.08em]">
				Showing {visibleTaskCount} of {tasks.length} flights
				{#if graphScope === 'selected'}
					around the current selection
				{/if}
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class={graphScope === 'all'
					? 'mc-tab-active rounded-full border px-3 py-1 text-xs font-semibold'
					: 'mc-tab-idle rounded-full border px-3 py-1 text-xs font-semibold'}
				onclick={showFullGraph}
			>
				Full Graph
			</button>
			<button
				type="button"
				class={graphScope === 'selected'
					? 'mc-tab-active rounded-full border px-3 py-1 text-xs font-semibold'
					: 'mc-tab-idle rounded-full border px-3 py-1 text-xs font-semibold'}
				onclick={focusSelectedTask}
				disabled={!selectedTask}
			>
				Focus Selection
			</button>
			<button
				type="button"
				class="mc-pill rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50"
				onclick={jumpToCurrentSlice}
				disabled={!currentSlice}
			>
				Jump To Current Flight
			</button>
		</div>
	</div>

	<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
		<div class="mc-detail rounded-3xl p-3">
			<div class="h-170 overflow-hidden rounded-3xl">
				<SvelteFlow
					nodes={flowNodes}
					edges={flowEdges}
					nodeTypes={graphNodeTypes}
					fitView
					minZoom={0.3}
					maxZoom={1.75}
					colorMode="system"
					nodesFocusable
					autoPanOnNodeFocus
					proOptions={{ hideAttribution: true }}
				>
					<Controls showLock={false} />
					<Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
				</SvelteFlow>
			</div>
		</div>

		<div class="mc-detail rounded-3xl p-4">
			<h3 class="mc-muted mb-3 text-xs font-semibold uppercase tracking-[0.08em]">
				Selected Flight
			</h3>
			{#if selectedTask}
				<div class="grid gap-4">
					<div>
						<div class="mb-2 flex flex-wrap items-center gap-2">
							<span class="text-sm font-semibold">
								Flight {String(selectedTask.sequence).padStart(2, '0')}. {selectedTask.displayTitle}
							</span>
							<span
								class={`mc-pill rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${statusPillClass(selectedTask)}`}
							>
								{selectedTask.statusLabel}
							</span>
						</div>
						<p class="mc-muted text-sm leading-6">{selectedTask.taskSummary}</p>
					</div>

					{#if selectedTask.goal}
						<div>
							<h4 class="mc-muted mb-2 text-xs font-semibold uppercase tracking-[0.08em]">Goal</h4>
							<p class="text-sm leading-6">{selectedTask.goal}</p>
						</div>
					{/if}

					<div>
						<h4 class="mc-muted mb-2 text-xs font-semibold uppercase tracking-[0.08em]">
							Depends On
						</h4>
						<div class="flex flex-wrap gap-2">
							{#if selectedTask.dependencyDisplayLabels.length > 0}
								{#each selectedTask.dependencyDisplayLabels as label (label)}
									<span class="mc-pill rounded-full px-2 py-1 text-[11px]">{label}</span>
								{/each}
							{:else}
								<span class="mc-pill rounded-full px-2 py-1 text-[11px]">Mission entry flight</span>
							{/if}
						</div>
					</div>

					<div>
						<h4 class="mc-muted mb-2 text-xs font-semibold uppercase tracking-[0.08em]">
							Verify Before Closing
						</h4>
						<ul class="m-0 grid gap-2 pl-5 text-sm">
							{#if selectedTask.verificationTargets.length > 0}
								{#each selectedTask.verificationTargets as target (target)}
									<li>{target}</li>
								{/each}
							{:else}
								<li class="mc-muted">No explicit verification targets listed.</li>
							{/if}
						</ul>
					</div>

					<div>
						<h4 class="mc-muted mb-2 text-xs font-semibold uppercase tracking-[0.08em]">
							Graph Columns
						</h4>
						<div class="flex flex-wrap gap-2">
							{#each graphColumns as column (column.title)}
								<span class="mc-pill rounded-full px-2 py-1 text-[11px]"
									>{column.title}: {column.tasks.length}</span
								>
							{/each}
						</div>
					</div>

					<button
						type="button"
						class="mc-tab-active rounded-2xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!selectedTask.actionEnabled}
						onclick={() => {
							onOpenGuidance(selectedTask);
						}}
					>
						{selectedTask.actionEnabled ? 'Open Guidance' : 'View Current Flight'}
					</button>
				</div>
			{:else}
				<p class="mc-muted text-sm">No mission flight is available to render in the graph.</p>
			{/if}
		</div>
	</div>
</section>

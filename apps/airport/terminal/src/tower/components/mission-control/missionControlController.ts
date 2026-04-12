import type {
	ContextGraph,
	MissionAgentSessionRecord,
	MissionStageId,
} from '@flying-pillow/mission-core';
import { createEffect, createMemo, createSignal, type Accessor } from 'solid-js';
import {
	buildDefaultCollapsedTreeNodeIds,
	buildProjectedSessionRecords,
	buildProjectedStageStatuses,
	buildVisibleTreeTargets,
	createSessionNodeId,
	moveTreeTargetSelection,
	type TreeTargetDescriptor,
	type TreeTargetKind,
} from './missionControlDomain.js';

type TowerMode = 'repository' | 'mission';

type MissionControlControllerOptions = {
	towerMode: Accessor<TowerMode>;
	currentMissionId: Accessor<string | undefined>;
	systemDomain: Accessor<ContextGraph | undefined>;
	stageRail: Accessor<Array<{ id: string; label: string; state: string }> | undefined>;
	treeNodes: Accessor<Array<{
		id: string;
		label: string;
		kind: string;
		depth: number;
		color: string;
		statusLabel?: string;
		collapsible: boolean;
		sourcePath?: string;
		stageId?: string;
		taskId?: string;
		sessionId?: string;
	}> | undefined>;
};

export function useMissionControlController(options: MissionControlControllerOptions) {
	const [selectedTreeTargetId, setSelectedTreeTargetId] = createSignal<string | undefined>();
	const [collapsedTreeNodeIds, setCollapsedTreeNodeIds] = createSignal<Set<string>>(new Set<string>());
	const [treePageScrollRequest, setTreePageScrollRequest] = createSignal<{ delta: number } | undefined>();
	const [collapseDefaultsMissionId, setCollapseDefaultsMissionId] = createSignal<string | undefined>();

	const stages = createMemo(() =>
		options.towerMode() === 'mission'
			? buildProjectedStageStatuses(options.systemDomain(), options.stageRail())
			: []
	);
	const sessions = createMemo(() =>
		options.towerMode() === 'mission'
			? buildProjectedSessionRecords(options.systemDomain())
			: []
	);
	const treeTargets = createMemo<TreeTargetDescriptor[]>(() =>
		(options.treeNodes() ?? []).map((node) => {
			return {
				id: node.id,
				label: node.label,
				kind: node.kind as TreeTargetKind,
				depth: node.depth,
				color: node.color,
				...(node.statusLabel ? { statusLabel: node.statusLabel } : {}),
				collapsible: node.collapsible,
				collapsed: collapsedTreeNodeIds().has(node.id),
				...(node.sourcePath ? { sourcePath: node.sourcePath } : {}),
				...(node.stageId ? { stageId: node.stageId as MissionStageId } : {}),
				...(node.taskId ? { taskId: node.taskId } : {}),
				...(node.sessionId ? { sessionId: node.sessionId } : {})
			};
		})
	);
	const visibleTreeTargets = createMemo<TreeTargetDescriptor[]>(() =>
		buildVisibleTreeTargets(treeTargets(), collapsedTreeNodeIds())
	);
	const selectedTreeTarget = createMemo(() => {
		const currentTargetId = selectedTreeTargetId();
		if (currentTargetId) {
			const currentTarget = visibleTreeTargets().find((target) => target.id === currentTargetId);
			if (currentTarget) {
				return currentTarget;
			}
		}
		return visibleTreeTargets()[0];
	});
	const selectedSessionRecord = createMemo<MissionAgentSessionRecord | undefined>(() => {
		const sessionId = selectedTreeTarget()?.kind === 'session'
			? selectedTreeTarget()?.sessionId
			: undefined;
		if (!sessionId) {
			return undefined;
		}
		return sessions().find((session) => session.sessionId === sessionId);
	});
	const promptableSessionRecord = createMemo<MissionAgentSessionRecord | undefined>(() => {
		const session = selectedSessionRecord();
		if (!session) {
			return undefined;
		}
		return session.lifecycleState !== 'completed'
			&& session.lifecycleState !== 'failed'
			&& session.lifecycleState !== 'cancelled'
			? session
			: undefined;
	});
	const canSendSessionText = createMemo(() => promptableSessionRecord() !== undefined);

	createEffect(() => {
		if (options.towerMode() !== 'mission') {
			return;
		}
		const missionId = options.currentMissionId();
		if (!missionId || collapseDefaultsMissionId() === missionId) {
			return;
		}
		if (stages().length === 0) {
			return;
		}
		setCollapsedTreeNodeIds(buildDefaultCollapsedTreeNodeIds(stages(), sessions()));
		setCollapseDefaultsMissionId(missionId);
	});

	createEffect(() => {
		setSelectedTreeTargetId((current) => {
			if (current && visibleTreeTargets().some((target) => target.id === current)) {
				return current;
			}
			return visibleTreeTargets()[0]?.id;
		});
	});

	function reset(): void {
		setSelectedTreeTargetId(undefined);
		setCollapsedTreeNodeIds(new Set<string>());
		setTreePageScrollRequest(undefined);
		setCollapseDefaultsMissionId(undefined);
	}

	function selectTreeTarget(targetId: string | undefined): void {
		if (!targetId) {
			return;
		}
		setSelectedTreeTargetId(targetId);
	}

	function selectSessionNode(sessionId: string): void {
		setSelectedTreeTargetId(createSessionNodeId(sessionId));
	}

	function activateTreeTarget(targetId: string | undefined): void {
		if (!targetId) {
			return;
		}
		const target = treeTargets().find((candidate) => candidate.id === targetId);
		if (!target) {
			return;
		}
		if (target.collapsible) {
			setCollapsedTreeNodeIds((current) => {
				const next = new Set(current);
				if (next.has(target.id)) {
					next.delete(target.id);
				} else {
					next.add(target.id);
				}
				return next;
			});
			return;
		}
		selectTreeTarget(targetId);
	}

	function moveSelection(delta: number): void {
		if (options.towerMode() !== 'mission') {
			return;
		}
		selectTreeTarget(moveTreeTargetSelection(visibleTreeTargets(), selectedTreeTarget()?.id, delta));
	}

	function activateSelectedTarget(): void {
		if (options.towerMode() !== 'mission') {
			return;
		}
		activateTreeTarget(selectedTreeTarget()?.id);
	}

	function requestPageScroll(delta: number): void {
		setTreePageScrollRequest({ delta });
	}

	return {
		stages,
		sessions,
		visibleTreeTargets,
		selectedTreeTarget,
		selectedSessionRecord,
		promptableSessionRecord,
		canSendSessionText,
		treePageScrollRequest,
		reset,
		selectTreeTarget,
		selectSessionNode,
		activateTreeTarget,
		moveSelection,
		activateSelectedTarget,
		requestPageScroll,
	};
}

import path from 'node:path';
import type { AirportProjectionSet, AirportState, GateBinding, GateId } from '../../../../airport/build/index.js';
import type { ContextGraph, MissionOperatorProjectionContext } from '../../types.js';

export function deriveSystemAirportProjections(
	domain: ContextGraph,
	missionOperatorViews: Record<string, MissionOperatorProjectionContext>,
	airportState: AirportState
): AirportProjectionSet {
	return {
		dashboard: deriveDashboardProjection(domain, missionOperatorViews, airportState),
		editor: deriveEditorProjection(domain, airportState),
		agentSession: deriveAgentSessionProjection(domain, airportState)
	};
}

function deriveDashboardProjection(
	domain: ContextGraph,
	missionOperatorViews: Record<string, MissionOperatorProjectionContext>,
	airportState: AirportState
): AirportProjectionSet['dashboard'] {
	const base = createGateProjectionBase(airportState, 'dashboard');
	const repositoryId = airportState.repositoryId ?? domain.selection.repositoryId;
	const repositoryContext = repositoryId ? domain.repositories[repositoryId] : undefined;
	const requestedMissionId = base.binding.targetKind === 'mission'
		? base.binding.targetId
		: undefined;
	const requestedMissionContext = requestedMissionId ? domain.missions[requestedMissionId] : undefined;
	const requestedMissionView = requestedMissionId ? missionOperatorViews[requestedMissionId] : undefined;
	const missionId = requestedMissionContext && requestedMissionView ? requestedMissionId : undefined;
	const missionContext = missionId ? requestedMissionContext : undefined;
	const missionView = missionId ? requestedMissionView : undefined;
	const selectedTaskId = missionId && domain.selection.taskId && domain.tasks[domain.selection.taskId]?.missionId === missionId
		? domain.selection.taskId
		: undefined;
	const selectedSessionId = missionId && domain.selection.agentSessionId && domain.agentSessions[domain.selection.agentSessionId]?.missionId === missionId
		? domain.selection.agentSessionId
		: undefined;
	const selectedStageId = missionId
		? selectedTaskId
			? domain.tasks[selectedTaskId]?.stageId
			: selectedSessionId
				? resolveSessionStageId(domain, selectedSessionId)
				: domain.selection.stageId
		: undefined;
	const commandContext = missionId
		? deriveMissionDashboardCommandContext(domain, missionId, selectedStageId, selectedTaskId, selectedSessionId)
		: deriveRepositoryDashboardCommandContext(repositoryContext, repositoryId);
	return {
		...base,
		surfaceMode: missionId ? 'mission' : 'repository',
		centerRoute: missionId ? 'mission-control' : 'repository-flow',
		...(repositoryId ? { repositoryId } : {}),
		repositoryLabel: repositoryContext?.displayLabel
			|| path.basename(airportState.repositoryRootPath || repositoryId || 'repository')
			|| 'Repository',
		...(missionId ? { missionId } : {}),
		...(missionContext?.briefSummary ? { missionLabel: missionContext.briefSummary } : missionId ? { missionLabel: missionId } : {}),
		...(selectedStageId ? { selectedStageId } : {}),
		...(selectedTaskId ? { selectedTaskId } : {}),
		...(selectedSessionId ? { selectedSessionId } : {}),
		commandContext,
		stageRail: missionView?.stageRail.map((item) => ({ ...item })) ?? [],
		treeNodes: missionView?.treeNodes.map((node) => ({ ...node })) ?? [],
		subtitle: missionContext?.briefSummary
			|| missionId
			|| repositoryContext?.displayLabel
			|| airportState.repositoryRootPath
			|| 'Repository overview',
		emptyLabel: missionId
			? 'Mission control is ready.'
			: 'Repository mode is ready.'
	};
}

function deriveEditorProjection(domain: ContextGraph, airportState: AirportState): AirportProjectionSet['editor'] {
	const base = createGateProjectionBase(airportState, 'editor');
	const artifactId = base.binding.targetKind === 'artifact'
		? base.binding.targetId
		: undefined;
	const artifactContext = artifactId ? domain.artifacts[artifactId] : undefined;
	const missionContext = artifactContext?.missionId ? domain.missions[artifactContext.missionId] : undefined;
	const repositoryContext = airportState.repositoryId ? domain.repositories[airportState.repositoryId] : undefined;
	const launchPath = artifactContext?.filePath
		|| missionContext?.workspacePath
		|| repositoryContext?.rootPath
		|| airportState.repositoryRootPath;
	return {
		...base,
		subtitle: artifactContext?.displayLabel
			|| artifactContext?.filePath
			|| base.subtitle,
		...(artifactId ? { artifactId } : {}),
		...(artifactContext?.filePath ? { artifactPath: artifactContext.filePath } : {}),
		...(artifactContext?.displayLabel ? { resourceLabel: artifactContext.displayLabel } : {}),
		...(launchPath ? { launchPath } : {}),
		emptyLabel: artifactContext?.filePath
			? 'Editor gate is ready.'
			: 'Editor gate is waiting for an artifact binding.'
	};
}

function deriveAgentSessionProjection(domain: ContextGraph, airportState: AirportState): AirportProjectionSet['agentSession'] {
	const base = createGateProjectionBase(airportState, 'agentSession');
	const sessionId = base.binding.targetKind === 'agentSession'
		? base.binding.targetId
		: undefined;
	const sessionContext = sessionId ? domain.agentSessions[sessionId] : undefined;
	const taskId = sessionContext?.taskId || (base.binding.targetKind === 'task' ? base.binding.targetId : undefined);
	return {
		...base,
		subtitle: sessionContext?.promptTitle
			|| sessionId
			|| base.subtitle,
		...(sessionId ? { sessionId, sessionLabel: sessionId } : {}),
		...(taskId ? { taskId } : {}),
		...(sessionContext?.missionId ? { missionId: sessionContext.missionId } : {}),
		...(sessionContext?.workingDirectory ? { workingDirectory: sessionContext.workingDirectory } : {}),
		statusLabel: sessionContext?.lifecycleState || (sessionId ? 'bound' : 'idle'),
		emptyLabel: sessionId
			? 'Agent session gate is bound and waiting for the session surface.'
			: 'Agent session gate is idle.'
	};
}

function createGateProjectionBase(
	airportState: AirportState,
	gateId: GateId
): AirportProjectionSet[keyof AirportProjectionSet] {
	const binding = airportState.gates[gateId];
	const pane = airportState.substrate.panesByGate[gateId];
	return {
		gateId,
		binding: structuredClone(binding),
		connectedClientIds: Object.values(airportState.clients)
			.filter((client) => client.connected && client.claimedGateId === gateId)
			.map((client) => client.clientId),
		title: formatGateTitle(gateId),
		subtitle: formatGateSubtitle(binding),
		intentFocused: airportState.focus.intentGateId === gateId,
		observedFocused: airportState.focus.observedGateId === gateId,
		...(pane ? { pane: { ...pane } } : {})
	} as AirportProjectionSet[keyof AirportProjectionSet];
}

function formatGateTitle(gateId: GateId): string {
	switch (gateId) {
		case 'dashboard':
			return 'Dashboard';
		case 'editor':
			return 'Editor';
		case 'agentSession':
			return 'Agent Session';
	}
	return gateId;
}

function formatGateSubtitle(binding: GateBinding): string {
	if (binding.targetKind === 'empty') {
		return 'No target bound';
	}

	const targetLabel = binding.targetId?.trim() || 'unresolved';
	return binding.mode ? `${binding.targetKind}:${targetLabel} (${binding.mode})` : `${binding.targetKind}:${targetLabel}`;
}

function deriveMissionDashboardCommandContext(
	domain: ContextGraph,
	missionId: string,
	selectedStageId: string | undefined,
	selectedTaskId: string | undefined,
	selectedSessionId: string | undefined
) {
	if (selectedSessionId) {
		const session = domain.agentSessions[selectedSessionId];
		return {
			sessionId: selectedSessionId,
			...(session?.taskId ? { taskId: session.taskId } : {}),
			targetKind: 'session' as const,
			targetLabel: session?.promptTitle || selectedSessionId
		};
	}

	if (selectedTaskId) {
		const task = domain.tasks[selectedTaskId];
		return {
			...(task?.stageId ? { stageId: task.stageId } : {}),
			taskId: selectedTaskId,
			targetKind: 'task' as const,
			targetLabel: task?.subject || selectedTaskId
		};
	}

	if (selectedStageId) {
		return {
			stageId: selectedStageId,
			targetKind: 'stage' as const,
			targetLabel: selectedStageId
		};
	}

	const mission = domain.missions[missionId];
	return {
		targetKind: 'mission' as const,
		targetLabel: mission?.briefSummary || missionId
	};
}

function deriveRepositoryDashboardCommandContext(
	repositoryContext: ContextGraph['repositories'][string] | undefined,
	repositoryId: string | undefined
) {
	return {
		targetKind: 'repository' as const,
		targetLabel: repositoryContext?.displayLabel
			|| repositoryContext?.rootPath
			|| repositoryId
			|| 'Repository'
	};
}

function resolveSessionStageId(domain: ContextGraph, sessionId: string): string | undefined {
	const taskId = domain.agentSessions[sessionId]?.taskId;
	return taskId ? domain.tasks[taskId]?.stageId : undefined;
}
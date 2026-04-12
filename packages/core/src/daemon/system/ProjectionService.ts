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
	return {
		...base,
		surfaceMode: missionId ? 'mission' : 'repository',
		...(repositoryId ? { repositoryId } : {}),
		repositoryLabel: repositoryContext?.displayLabel
			|| path.basename(airportState.repositoryRootPath || repositoryId || 'repository')
			|| 'Repository',
		...(missionId ? { missionId } : {}),
		...(missionContext?.briefSummary ? { missionLabel: missionContext.briefSummary } : missionId ? { missionLabel: missionId } : {}),
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
	const directArtifactPath = artifactId && !artifactContext ? artifactId : undefined;
	const missionContext = artifactContext?.missionId ? domain.missions[artifactContext.missionId] : undefined;
	const repositoryContext = airportState.repositoryId ? domain.repositories[airportState.repositoryId] : undefined;
	const launchPath = artifactContext?.filePath
		|| directArtifactPath
		|| missionContext?.workspacePath
		|| repositoryContext?.rootPath
		|| airportState.repositoryRootPath;
	return {
		...base,
		subtitle: artifactContext?.displayLabel
			|| artifactContext?.filePath
			|| directArtifactPath
			|| base.subtitle,
		...(artifactId ? { artifactId } : {}),
		...(artifactContext?.filePath
			? { artifactPath: artifactContext.filePath }
			: directArtifactPath
				? { artifactPath: directArtifactPath }
				: {}),
		...(artifactContext?.displayLabel ? { resourceLabel: artifactContext.displayLabel } : {}),
		...(launchPath ? { launchPath } : {}),
		emptyLabel: artifactContext?.filePath || directArtifactPath
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
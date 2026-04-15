import type {
	MissionSystemSnapshot,
	OperatorStatus,
	PaneBinding,
} from '@flying-pillow/mission-core';

type TowerMode = 'repository' | 'mission';
type TreeSelectionPaneBindings = Partial<Record<'briefingRoom' | 'runway', PaneBinding>>;

export function buildMissionActionsRevision(
	status: OperatorStatus,
	missionId: string | undefined = status.missionId
): string | undefined {
	const normalizedMissionId = missionId?.trim();
	if (!normalizedMissionId) {
		return undefined;
	}
	const workflowUpdatedAt = status.workflow?.updatedAt?.trim();
	if (workflowUpdatedAt) {
		return `mission:${normalizedMissionId}:${workflowUpdatedAt}`;
	}
	const systemVersion = status.system?.state.version;
	if (typeof systemVersion === 'number') {
		return `mission:${normalizedMissionId}:system:${String(systemVersion)}`;
	}
	return `mission:${normalizedMissionId}:status`;
}

export function buildActionsInvalidationKey(input: {
	mode: TowerMode;
	status: OperatorStatus;
	missionActionsRevision: string | undefined;
}): string {
	if (input.mode === 'mission') {
		return input.missionActionsRevision
			?? buildMissionActionsRevision(input.status)
			?? 'mission:unresolved';
	}
	return JSON.stringify({
		mode: 'repository',
		found: input.status.found,
		operationalMode: input.status.operationalMode ?? null,
		availableMissionCount: input.status.control?.availableMissionCount ?? null,
		settingsComplete: input.status.control?.settingsComplete ?? null,
		currentBranch: input.status.control?.currentBranch ?? null,
		trackingProvider: input.status.control?.trackingProvider ?? null
	});
}

export function computeSelectionBindingUpdates(
	desiredBindings: TreeSelectionPaneBindings,
	currentPanes: MissionSystemSnapshot['state']['airport']['panes'] | undefined
): Array<['briefingRoom' | 'runway', PaneBinding]> {
	const updates: Array<['briefingRoom' | 'runway', PaneBinding]> = [];
	for (const paneId of ['briefingRoom', 'runway'] as const) {
		const desiredBinding = desiredBindings[paneId];
		if (!desiredBinding) {
			continue;
		}
		const currentBinding = currentPanes?.[paneId];
		if (JSON.stringify(desiredBinding) === JSON.stringify(currentBinding)) {
			continue;
		}
		updates.push([paneId, desiredBinding as PaneBinding]);
	}
	return updates;
}

export function computeSelectionBindingSyncPlan(input: {
	desiredBindings: TreeSelectionPaneBindings;
	currentPanes: MissionSystemSnapshot['state']['airport']['panes'] | undefined;
	acknowledgedSyncKey: string | undefined;
	inFlightSyncKey: string | undefined;
}): {
	desiredSyncKey: string;
	updates: Array<['briefingRoom' | 'runway', PaneBinding]>;
	currentMatches: boolean;
	shouldQueue: boolean;
} {
	const desiredSyncKey = JSON.stringify(input.desiredBindings);
	const updates = computeSelectionBindingUpdates(input.desiredBindings, input.currentPanes);
	const currentMatches = updates.length === 0;
	const blocked = desiredSyncKey === input.acknowledgedSyncKey || desiredSyncKey === input.inFlightSyncKey;
	return {
		desiredSyncKey,
		updates,
		currentMatches,
		shouldQueue: !currentMatches && !blocked
	};
}
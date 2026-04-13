import type { MissionResolvedSelection, PaneBinding } from '@flying-pillow/mission-core';

export function resolvePanelBindingsFromSelection(
	selection: MissionResolvedSelection | undefined,
	missionId: string | undefined
): Partial<Record<'briefingRoom', PaneBinding>> | undefined {
	const normalizedMissionId = missionId?.trim();
	const artifactId = selection?.activeInstructionArtifactId ?? selection?.activeStageResultArtifactId;
	if (!artifactId) {
		if (!normalizedMissionId) {
			return undefined;
		}
		return {
			briefingRoom: {
				targetKind: 'mission',
				targetId: normalizedMissionId,
				mode: 'view'
			}
		};
	}

	return {
		briefingRoom: {
			targetKind: 'artifact',
			targetId: artifactId,
			mode: 'view'
		}
	};
}
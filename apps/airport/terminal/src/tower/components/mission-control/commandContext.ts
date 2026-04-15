import type {
	MissionSelectionTarget,
	MissionResolvedSelection,
	OperatorActionTargetContext,
} from '@flying-pillow/mission-core';

export function resolveOperatorActionContextFromSelection(
	selection: MissionResolvedSelection | undefined
): OperatorActionTargetContext {
	if (!selection) {
		return {};
	}
	return {
		...(selection.stageId ? { stageId: selection.stageId } : {}),
		...(selection.taskId ? { taskId: selection.taskId } : {}),
		...(selection.activeAgentSessionId ? { sessionId: selection.activeAgentSessionId } : {})
	};
}

export function resolveOperatorActionContextFromTreeTarget(
	target: Pick<MissionSelectionTarget, 'kind' | 'stageId' | 'taskId' | 'sessionId'> | undefined
): OperatorActionTargetContext {
	if (!target) {
		return {};
	}

	switch (target.kind) {
		case 'session':
			return {
				...(target.stageId ? { stageId: target.stageId } : {}),
				...(target.taskId ? { taskId: target.taskId } : {}),
				...(target.sessionId ? { sessionId: target.sessionId } : {})
			};
		case 'task':
		case 'task-artifact':
			return {
				...(target.stageId ? { stageId: target.stageId } : {}),
				...(target.taskId ? { taskId: target.taskId } : {})
			};
		case 'stage':
		case 'stage-artifact':
			return {
				...(target.stageId ? { stageId: target.stageId } : {})
			};
		default:
			return {};
	}
}

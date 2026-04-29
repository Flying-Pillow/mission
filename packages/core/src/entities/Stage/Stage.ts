import type { MissionStageId, MissionStageStatus } from '../../types.js';
import type { Artifact } from '../Artifact/Artifact.js';
import type { TaskData } from '../Task/Task.js';
import { Task } from '../Task/Task.js';
import type { MissionTaskState } from '../../types.js';

export type Stage = {
	stageId: MissionStageId;
	lifecycle: MissionStageStatus['status'];
	isCurrentStage: boolean;
	artifacts: Artifact[];
	tasks: TaskData[];
};

export function createStage(input: Stage): Stage {
	return {
		stageId: input.stageId,
		lifecycle: input.lifecycle,
		isCurrentStage: input.isCurrentStage,
		artifacts: input.artifacts.map((artifact) => structuredClone(artifact)),
		tasks: input.tasks.map((task) => structuredClone(task))
	};
}

export function isMissionDelivered(stages: MissionStageStatus[]): boolean {
	return stages.some((stage) => stage.stage === 'delivery' && stage.status === 'completed');
}

export function resolveActiveStageTasks(stage: MissionStageStatus | undefined): MissionTaskState[] {
	return stage ? stage.tasks.filter((task) => Task.isActive(task)) : [];
}

export function resolveReadyStageTasks(stage: MissionStageStatus | undefined): MissionTaskState[] {
	return stage ? stage.tasks.filter((task) => Task.isReady(task)) : [];
}
import {
	MISSION_ARTIFACT_KEYS,
	getMissionStageDefinition
} from '../../workflow/manifest.js';
import {
	type MissionLifecycleState,
	type MissionStageId,
	type MissionType,
	type OperatorStatus
} from '../../types.js';
import { toAgentSession, type AgentSession } from '../AgentSession/AgentSession.js';
import {
	createMissionArtifact,
	createTaskArtifact,
	type Artifact
} from '../Artifact/Artifact.js';
import { toTask, type Task } from '../Task/Task.js';
import { createStage, type Stage } from './Stage.js';

export type Mission = {
	missionId: string;
	title?: string;
	issueId?: number;
	type?: MissionType;
	operationalMode?: string;
	branchRef?: string;
	missionDir?: string;
	missionRootDir?: string;
	lifecycle?: MissionLifecycleState;
	updatedAt?: string;
	currentStageId?: MissionStageId;
	artifacts: Artifact[];
	stages: Stage[];
	agentSessions: AgentSession[];
	recommendedAction?: string;
};

export function toMission(status: OperatorStatus): Mission {
	const missionId = status.missionId?.trim();
	if (!missionId) {
		throw new Error('Mission entity conversion requires an OperatorStatus with missionId.');
	}

	const missionRootDir = status.missionRootDir ?? status.missionDir;
	const productFiles = status.productFiles ?? {};
	const currentStageId = status.workflow?.currentStageId ?? status.stage;
	const artifacts: Artifact[] = [];

	for (const artifactKey of MISSION_ARTIFACT_KEYS) {
		const filePath = productFiles[artifactKey];
		if (!filePath) {
			continue;
		}

		artifacts.push(createMissionArtifact({
			artifactKey,
			filePath,
			...(missionRootDir ? { missionRootDir } : {})
		}));
	}

	const stages: Stage[] = (status.stages ?? []).map((stage) => {
		const stageArtifacts = getMissionStageDefinition(stage.stage).artifacts
			.map((artifactKey) => productFiles[artifactKey]
				? createMissionArtifact({
					artifactKey,
					filePath: productFiles[artifactKey],
					stageId: stage.stage,
					...(missionRootDir ? { missionRootDir } : {})
				})
				: undefined)
			.filter((artifact): artifact is Artifact => artifact !== undefined);
		const tasks: Task[] = stage.tasks.map((task) => {
			const entity = toTask(task);
			if (task.filePath) {
				artifacts.push(createTaskArtifact({
					taskId: task.taskId,
					stageId: task.stage,
					fileName: task.fileName,
					filePath: task.filePath,
					relativePath: task.relativePath
				}));
			}
			return entity;
		});
		return createStage({
			stageId: stage.stage,
			lifecycle: stage.status,
			isCurrentStage: currentStageId === stage.stage,
			artifacts: stageArtifacts,
			tasks
		});
	});

	return {
		missionId,
		...(status.title ? { title: status.title } : {}),
		...(status.issueId !== undefined ? { issueId: status.issueId } : {}),
		...(status.type ? { type: status.type } : {}),
		...(status.operationalMode ? { operationalMode: status.operationalMode } : {}),
		...(status.branchRef ? { branchRef: status.branchRef } : {}),
		...(status.missionDir ? { missionDir: status.missionDir } : {}),
		...(status.missionRootDir ? { missionRootDir: status.missionRootDir } : {}),
		...(status.workflow?.lifecycle ? { lifecycle: status.workflow.lifecycle } : {}),
		...(status.workflow?.updatedAt ? { updatedAt: status.workflow.updatedAt } : {}),
		...(currentStageId ? { currentStageId } : {}),
		artifacts,
		stages,
		agentSessions: (status.agentSessions ?? []).map((session) => toAgentSession(session)),
		...(status.recommendedAction ? { recommendedAction: status.recommendedAction } : {})
	};
}
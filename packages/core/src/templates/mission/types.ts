import type {
	MissionBrief,
	MissionProductKey,
	MissionStageId,
	MissionTaskAgent,
	MissionTaskStatus
} from '../../types.js';

export type MissionProductTemplate = {
	key: MissionProductKey;
	body: (brief: MissionBrief, branchRef: string) => string;
};

export type MissionTaskTemplate = {
	fileName: string;
	subject: string;
	instruction: string;
	dependsOn?: string[];
	agent: MissionTaskAgent;
	status?: MissionTaskStatus;
	retries?: number;
};

export type MissionStageTemplateDefinition = {
	artifacts: MissionProductTemplate[];
	defaultTasks: MissionTaskTemplate[];
};

export type MissionStageTemplateDefinitions = Record<
	MissionStageId,
	MissionStageTemplateDefinition
>;
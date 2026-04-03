import type { MissionStatus } from '@flying-pillow/mission-core';

export type MissionTimelineTask = {
	taskId: string;
	subject: string;
	status: string;
};

export type MissionTimelineStage = {
	stageId: string;
	status: string;
	tasks: MissionTimelineTask[];
};

export type MissionTimelineModel = {
	status: MissionStatus;
	stages: MissionTimelineStage[];
};

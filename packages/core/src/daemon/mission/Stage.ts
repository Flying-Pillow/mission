import { FilesystemAdapter } from '../../lib/FilesystemAdapter.js';
import {
	MISSION_STAGE_TEMPLATE_DEFINITIONS,
	type MissionStageTemplateDefinition
} from '../../templates/mission/index.js';
import {
	MISSION_STAGES,
	MISSION_TASK_STAGE_DIRECTORIES,
	type MissionDescriptor,
	type MissionStageId
} from '../../types.js';
import { Artifact } from './Artifact.js';
import { Task } from './Task.js';

export class Stage {
	public constructor(
		private readonly descriptor: MissionDescriptor,
		private readonly currentStage: MissionStageId,
		private readonly delivered = false
	) {}

	public get stage(): MissionStageId {
		return this.currentStage;
	}

	public get directoryName(): string {
		return MISSION_TASK_STAGE_DIRECTORIES[this.currentStage];
	}

	public get previousStage(): MissionStageId | undefined {
		const index = MISSION_STAGES.indexOf(this.currentStage);
		return index > 0 ? MISSION_STAGES[index - 1] : undefined;
	}

	public get nextStage(): MissionStageId | undefined {
		if (this.delivered) {
			return undefined;
		}

		const index = MISSION_STAGES.indexOf(this.currentStage);
		if (index < 0 || index >= MISSION_STAGES.length - 1) {
			return undefined;
		}

		return MISSION_STAGES[index + 1];
	}

	public getCurrentStage(): MissionStageId {
		return this.stage;
	}

	public getDirectoryName(): string {
		return this.directoryName;
	}

	public getPreviousStage(): MissionStageId | undefined {
		return this.previousStage;
	}

	public getNextStage(): MissionStageId | undefined {
		return this.nextStage;
	}

	public getAllowedNextStages(): MissionStageId[] {
		const nextStage = this.getNextStage();
		return nextStage ? [nextStage] : [];
	}

	public isAdjacentTransition(targetStage: MissionStageId): boolean {
		const currentIndex = MISSION_STAGES.indexOf(this.currentStage);
		const targetIndex = MISSION_STAGES.indexOf(targetStage);
		return currentIndex >= 0 && targetIndex >= 0 && Math.abs(targetIndex - currentIndex) === 1;
	}

	public getArtifacts(): Artifact[] {
		return this.getDefinition().artifacts.map(
			(template) =>
				new Artifact(this.descriptor.missionDir, {
					kind: 'product',
					key: template.key,
					body: template.body(this.descriptor.brief, this.descriptor.branchRef)
				})
		);
	}

	public getDefaultTasks(): Task[] {
		return this.getDefinition().defaultTasks.map(
			(template) => new Task(this.descriptor.missionDir, this.currentStage, template)
		);
	}

	public async enter(
		adapter: FilesystemAdapter,
		options: { activateNextTask?: boolean } = {}
	): Promise<void> {
		if (this.getDefinition().defaultTasks.length > 0) {
			await adapter.ensureStageDirectory(this.descriptor.missionDir, this.currentStage);
		}

		for (const artifact of this.getArtifacts()) {
			await artifact.materialize(adapter);
		}

		for (const task of this.getDefaultTasks()) {
			await task.materialize(adapter);
		}

		if (options.activateNextTask === true) {
			await this.activateNextTask(adapter);
		}
	}

	public async activateNextTask(adapter: FilesystemAdapter): Promise<void> {
		const tasks = await adapter.listTaskStates(this.descriptor.missionDir, this.currentStage);
		const activeTask = tasks.find((task) => task.status === 'active');
		if (activeTask) {
			return;
		}

		const nextTask = tasks.find((task) => task.status === 'todo' && task.blockedBy.length === 0);
		if (!nextTask) {
			return;
		}

		await Task.fromState(this.descriptor.missionDir, nextTask).activate(adapter);
	}

	private getDefinition(): MissionStageTemplateDefinition {
		return MISSION_STAGE_TEMPLATE_DEFINITIONS[this.currentStage];
	}
}
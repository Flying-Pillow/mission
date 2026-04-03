import { FilesystemAdapter } from '../../lib/FilesystemAdapter.js';
import type {
	MissionStageId,
	MissionTaskAgent,
	MissionTaskState,
	MissionTaskStatus
} from '../../types.js';
import { Artifact } from './Artifact.js';

export type TaskTemplate = {
	fileName: string;
	subject: string;
	instruction: string;
	dependsOn?: string[];
	agent: MissionTaskAgent;
	status?: MissionTaskStatus;
	retries?: number;
};

export class Task {
	public constructor(
		private readonly missionDir: string,
		private readonly stageId: MissionStageId,
		private readonly template: TaskTemplate
	) {}

	public get stage(): MissionStageId {
		return this.stageId;
	}

	public get fileName(): string {
		return this.template.fileName;
	}

	public get subject(): string {
		return this.template.subject;
	}

	public get instruction(): string {
		return this.template.instruction;
	}

	public get agent(): MissionTaskAgent {
		return this.template.agent;
	}

	public get dependsOn(): string[] | undefined {
		return this.template.dependsOn ? [...this.template.dependsOn] : undefined;
	}

	public get status(): MissionTaskStatus | undefined {
		return this.template.status;
	}

	public get retries(): number | undefined {
		return this.template.retries;
	}

	public static fromState(missionDir: string, state: MissionTaskState): Task {
		return new Task(missionDir, state.stage, {
			fileName: state.fileName,
			subject: state.subject,
			instruction: state.instruction,
			dependsOn: state.dependsOn,
			agent: state.agent,
			status: state.status,
			retries: state.retries
		});
	}

	public getFileName(): string {
		return this.fileName;
	}

	public getArtifact(): Artifact {
		return new Artifact(this.missionDir, {
			kind: 'task',
			stageId: this.stageId,
			fileName: this.template.fileName,
			subject: this.template.subject,
			instruction: this.template.instruction,
			...(this.template.dependsOn ? { dependsOn: this.template.dependsOn } : {}),
			agent: this.template.agent,
			...(this.template.status ? { status: this.template.status } : {}),
			...(this.template.retries !== undefined ? { retries: this.template.retries } : {})
		});
	}

	public async materialize(adapter: FilesystemAdapter): Promise<void> {
		await this.getArtifact().materialize(adapter);
	}

	public async readState(adapter: FilesystemAdapter): Promise<MissionTaskState | undefined> {
		return adapter.readTaskState(this.missionDir, this.stageId, this.template.fileName);
	}

	public async activate(adapter: FilesystemAdapter): Promise<void> {
		const state = await this.requireState(adapter);
		if (state.status === 'active' || state.status === 'done') {
			return;
		}
		if (state.status === 'blocked') {
			throw new Error(`The next task in ${state.relativePath} is blocked.`);
		}

		await adapter.updateTaskState(state, { status: 'active' });
	}

	private async requireState(adapter: FilesystemAdapter): Promise<MissionTaskState> {
		const state = await this.readState(adapter);
		if (!state) {
			throw new Error(`Task '${this.template.fileName}' is missing from stage '${this.stageId}'.`);
		}
		return state;
	}
}
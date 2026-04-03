import type {
	MissionAgentSessionLaunchRequest,
	MissionAgentSessionRecord
} from '../../daemon/MissionAgentRuntime.js';
import type { MissionTaskState, MissionTaskUpdate } from '../../types.js';
import type { Mission } from './Mission.js';

export type LaunchTaskSessionOptions = Omit<
	MissionAgentSessionLaunchRequest,
	'runtimeId' | 'taskId' | 'workingDirectory' | 'prompt' | 'title' | 'assignmentLabel'
> & {
	runtimeId?: string;
	workingDirectory?: string;
	prompt?: string;
	title?: string;
	assignmentLabel?: string;
};

export class Task {
	public constructor(
		private readonly mission: Mission,
		private readonly snapshot: MissionTaskState
	) {}

	public get data(): MissionTaskState {
		return this.getState();
	}

	public get taskId(): string {
		return this.snapshot.taskId;
	}

	public get stage(): MissionTaskState['stage'] {
		return this.snapshot.stage;
	}

	public get sequence(): number {
		return this.snapshot.sequence;
	}

	public get subject(): string {
		return this.snapshot.subject;
	}

	public get instruction(): string {
		return this.snapshot.instruction;
	}

	public get body(): string {
		return this.snapshot.body;
	}

	public get dependsOn(): string[] {
		return [...this.snapshot.dependsOn];
	}

	public get blockedBy(): string[] {
		return [...this.snapshot.blockedBy];
	}

	public get status(): MissionTaskState['status'] {
		return this.snapshot.status;
	}

	public get agent(): MissionTaskState['agent'] {
		return this.snapshot.agent;
	}

	public get retries(): number {
		return this.snapshot.retries;
	}

	public get fileName(): string {
		return this.snapshot.fileName;
	}

	public get filePath(): string {
		return this.snapshot.filePath;
	}

	public get relativePath(): string {
		return this.snapshot.relativePath;
	}

	public getId(): string {
		return this.taskId;
	}

	public getState(): MissionTaskState {
		return {
			...this.snapshot,
			dependsOn: [...this.snapshot.dependsOn],
			blockedBy: [...this.snapshot.blockedBy]
		};
	}

	public async refresh(): Promise<Task | undefined> {
		const stage = await this.mission.stage(this.snapshot.stage);
		return stage?.task(this.snapshot.taskId);
	}

	public async setState(changes: MissionTaskUpdate): Promise<Task | undefined> {
		await this.mission.setTaskState(this.snapshot.taskId, changes);
		return this.refresh();
	}

	public async activate(): Promise<Task | undefined> {
		return this.setState({ status: 'active' });
	}

	public async block(): Promise<Task | undefined> {
		return this.setState({ status: 'blocked' });
	}

	public async complete(): Promise<Task | undefined> {
		return this.setState({ status: 'done' });
	}

	public async launchAgentSession(
		options: LaunchTaskSessionOptions = {}
	): Promise<MissionAgentSessionRecord> {
		const status = await this.mission.status();
		return this.mission.launchAgentSession({
			...(options.runtimeId ? { runtimeId: options.runtimeId } : {}),
			taskId: this.snapshot.taskId,
			workingDirectory: options.workingDirectory ?? status.missionDir ?? process.cwd(),
			prompt: options.prompt ?? this.snapshot.instruction,
			title: options.title ?? this.snapshot.subject,
			assignmentLabel: options.assignmentLabel ?? this.snapshot.relativePath,
			...(options.scope
				? { scope: options.scope }
				: {
					scope: {
						kind: 'slice',
						sliceTitle: this.snapshot.subject,
						verificationTargets: [],
						requiredSkills: [],
						dependsOn: [...this.snapshot.dependsOn],
						...(status.missionId ? { missionId: status.missionId } : {}),
						...(this.snapshot.stage ? { stage: this.snapshot.stage } : {}),
						...(this.snapshot.taskId ? { taskId: this.snapshot.taskId } : {}),
						...(this.snapshot.subject ? { taskTitle: this.snapshot.subject } : {}),
						...(this.snapshot.subject ? { taskSummary: this.snapshot.subject } : {}),
						...(this.snapshot.instruction
							? { taskInstruction: this.snapshot.instruction }
							: {})
					}
				}),
			...(options.operatorIntent ? { operatorIntent: options.operatorIntent } : {}),
			...(options.startFreshSession !== undefined
				? { startFreshSession: options.startFreshSession }
				: {})
		});
	}
}
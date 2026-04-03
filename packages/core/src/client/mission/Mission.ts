import type {
	GateIntent,
	MissionGateResult,
	MissionSelector,
	MissionStageId,
	MissionStatus,
	MissionTaskState,
	TrackedIssueSummary
} from '../../types.js';
import type {
	MissionAgentConsoleState,
	MissionAgentDisposable,
	MissionAgentSessionLaunchRequest,
	MissionAgentSessionRecord
} from '../../daemon/MissionAgentRuntime.js';
import type {
	AgentLaunch,
	Notification,
	MissionSelect,
	MissionStart,
	TaskUpdate
} from '../../daemon/protocol.js';
import type { MissionTaskUpdate } from '../../types.js';
import type { DaemonClient } from '../DaemonClient.js';
import { Stage } from './Stage.js';
import { Task } from './Task.js';

export class Mission {
	private snapshot: MissionStatus | undefined;

	public constructor(
		private readonly client: DaemonClient,
		private readonly selectorState: MissionSelector = {},
		snapshot?: MissionStatus
	) {
		this.snapshot = snapshot ? structuredClone(snapshot) : undefined;
	}

	public get selector(): MissionSelector {
		return { ...this.selectorState };
	}

	public get data(): MissionStatus | undefined {
		return this.snapshot ? structuredClone(this.snapshot) : undefined;
	}

	public get found(): boolean | undefined {
		return this.snapshot?.found;
	}

	public get missionId(): string | undefined {
		return this.snapshot?.missionId;
	}

	public get title(): string | undefined {
		return this.snapshot?.title;
	}

	public get issueId(): number | undefined {
		return this.snapshot?.issueId;
	}

	public get currentStage(): MissionStageId | undefined {
		return this.snapshot?.stage;
	}

	public get branchRef(): string | undefined {
		return this.snapshot?.branchRef;
	}

	public get missionDir(): string | undefined {
		return this.snapshot?.missionDir;
	}

	public get activeTasks(): Task[] {
		return (this.snapshot?.activeTasks ?? []).map((task) => this.hydrateTask(task));
	}

	public get readyTasks(): Task[] {
		return (this.snapshot?.readyTasks ?? []).map((task) => this.hydrateTask(task));
	}

	public get stagesSnapshot(): Stage[] {
		return this.snapshot ? this.hydrateStages(this.snapshot) : [];
	}

	public getSelector(): MissionSelector {
		return this.selector;
	}

	public withSelector(selector: MissionSelector): Mission {
		return new Mission(this.client, selector, this.snapshot);
	}

	public onDidEvent(
		listener: (event: Notification) => void
	): MissionAgentDisposable {
		return this.client.onDidEvent(listener);
	}

	public async start(params: MissionStart): Promise<MissionStatus> {
		return this.rememberStatus(await this.client.request<MissionStatus>('mission.start', params));
	}

	public async bootstrapFromIssue(
		issueNumber: number,
		agentContext?: MissionStart['agentContext']
	): Promise<MissionStatus> {
		return this.rememberStatus(await this.client.request<MissionStatus>('mission.bootstrap', {
			issueNumber,
			...(agentContext ? { agentContext } : {})
		}));
	}

	public async status(): Promise<MissionStatus> {
		return this.rememberStatus(
			await this.client.request<MissionStatus>('mission.status', this.missionParams())
		);
	}

	public async refresh(): Promise<MissionStatus> {
		return this.status();
	}

	public async evaluateGate(intent: GateIntent): Promise<MissionGateResult> {
		return this.client.request<MissionGateResult>('mission.gate.evaluate', {
			...this.missionParams(),
			intent
		});
	}

	public async transition(toStage: MissionStageId): Promise<MissionStatus> {
		return this.rememberStatus(await this.client.request<MissionStatus>('mission.transition', {
			...this.missionParams(),
			toStage
		}));
	}

	public async deliver(): Promise<MissionStatus> {
		return this.rememberStatus(
			await this.client.request<MissionStatus>('mission.deliver', this.missionParams())
		);
	}

	public async setTaskState(taskId: string, changes: MissionTaskUpdate): Promise<MissionStatus> {
		const params: TaskUpdate = {
			...this.missionParams(),
			taskId,
			changes
		};
		return this.rememberStatus(await this.client.request<MissionStatus>('mission.task.update', params));
	}

	public hydrateStages(status: MissionStatus): Stage[] {
		return (status.stages ?? []).map((stage) => new Stage(this, stage));
	}

	public hydrateStage(
		status: MissionStatus,
		stageId: MissionStageId | undefined = status.stage
	): Stage | undefined {
		const stages = this.hydrateStages(status);
		if (stageId) {
			return stages.find((stage) => stage.getId() === stageId);
		}

		return stages[0];
	}

	public hydrateTask(task: MissionTaskState): Task {
		return new Task(this, task);
	}

	public hydrateActiveTasks(status: MissionStatus): Task[] {
		return (status.activeTasks ?? []).map((task) => this.hydrateTask(task));
	}

	public hydrateReadyTasks(status: MissionStatus): Task[] {
		return (status.readyTasks ?? []).map((task) => this.hydrateTask(task));
	}

	public async stages(): Promise<Stage[]> {
		return this.hydrateStages(await this.status());
	}

	public async stage(stageId?: MissionStageId): Promise<Stage | undefined> {
		return this.hydrateStage(await this.status(), stageId);
	}

	public async task(taskId: string): Promise<Task | undefined> {
		for (const stage of await this.stages()) {
			const task = stage.task(taskId);
			if (task) {
				return task;
			}
		}

		return undefined;
	}

	public async listAgentSessions(): Promise<MissionAgentSessionRecord[]> {
		const sessions = await this.client.request<MissionAgentSessionRecord[]>(
			'mission.agent.sessions',
			this.missionParams()
		);
		if (this.snapshot) {
			this.snapshot = {
				...this.snapshot,
				agentSessions: sessions
			};
		}
		return sessions;
	}

	public async launchAgentSession(
		request: Omit<MissionAgentSessionLaunchRequest, 'runtimeId'> & { runtimeId?: string }
	): Promise<MissionAgentSessionRecord> {
		const params: AgentLaunch = {
			...this.missionParams(),
			request
		};
		return this.client.request<MissionAgentSessionRecord>('mission.agent.launch', {
			...params
		});
	}

	public async getAgentConsoleState(sessionId: string): Promise<MissionAgentConsoleState | null> {
		return this.client.request<MissionAgentConsoleState | null>('mission.agent.console.state', {
			sessionId
		});
	}

	public async sendAgentInput(sessionId: string, text: string): Promise<MissionAgentSessionRecord> {
		return this.client.request<MissionAgentSessionRecord>('mission.agent.input', {
			sessionId,
			text
		});
	}

	public async resizeAgentSession(
		sessionId: string,
		cols: number,
		rows: number
	): Promise<MissionAgentSessionRecord> {
		return this.client.request<MissionAgentSessionRecord>('mission.agent.resize', {
			sessionId,
			cols,
			rows
		});
	}

	public async cancelAgentSession(
		sessionId: string,
		reason?: string
	): Promise<MissionAgentSessionRecord> {
		return this.client.request<MissionAgentSessionRecord>('mission.agent.cancel', {
			sessionId,
			...(reason ? { reason } : {})
		});
	}

	public async terminateAgentSession(
		sessionId: string,
		reason?: string
	): Promise<MissionAgentSessionRecord> {
		return this.client.request<MissionAgentSessionRecord>('mission.agent.terminate', {
			sessionId,
			...(reason ? { reason } : {})
		});
	}

	public async listOpenGitHubIssues(limit = 50): Promise<TrackedIssueSummary[]> {
		return this.client.request<TrackedIssueSummary[]>('github.issues.list', { limit });
	}

	private missionParams(): MissionSelect {
		const selector = this.selector;
		return Object.keys(selector).length > 0 ? { selector } : {};
	}

	private rememberStatus(status: MissionStatus): MissionStatus {
		this.snapshot = structuredClone(status);
		return status;
	}
}
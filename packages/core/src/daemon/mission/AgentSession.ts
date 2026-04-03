import {
	cloneMissionAgentSessionRecord,
	createMissionAgentSessionRecord,
	type MissionAgentConsoleEvent,
	type MissionAgentConsoleState,
	type MissionAgentDisposable,
	type MissionAgentEvent,
	type MissionAgentRuntime,
	type MissionAgentSession,
	type MissionAgentSessionRecord,
	type MissionAgentSessionState,
	type MissionAgentTurnRequest
} from '../MissionAgentRuntime.js';

export type AgentSessionMetadata = {
	createdAt: string;
	taskId?: string;
	assignmentLabel?: string;
};

type AgentSessionHooks = {
	persistRecord: (record: MissionAgentSessionRecord) => Promise<void>;
	emitConsoleEvent: (event: MissionAgentConsoleEvent) => void;
	emitEvent: (event: MissionAgentEvent) => void;
};

export class AgentSession implements MissionAgentDisposable {
	private readonly consoleSubscription: MissionAgentDisposable;
	private readonly eventSubscription: MissionAgentDisposable;
	private eventQueue: Promise<void> = Promise.resolve();
	private metadata: AgentSessionMetadata;

	public constructor(
		private readonly runtime: MissionAgentRuntime,
		private readonly session: MissionAgentSession,
		metadata: AgentSessionMetadata,
		private readonly hooks: AgentSessionHooks
	) {
		this.metadata = cloneAgentSessionMetadata(metadata);
		this.consoleSubscription = this.session.onDidConsoleEvent((event) => {
			this.hooks.emitConsoleEvent(event);
		});
		this.eventSubscription = this.session.onDidEvent((event) => {
			this.eventQueue = this.eventQueue
				.catch(() => undefined)
				.then(async () => {
					await this.persistState(event.state);
					this.hooks.emitEvent(event);
				});
		});
	}

	public get runtimeId(): string {
		return this.runtime.id;
	}

	public get runtimeDisplayName(): string {
		return this.runtime.displayName;
	}

	public get sessionId(): string {
		return this.session.sessionId;
	}

	public get taskId(): string | undefined {
		return this.metadata.taskId;
	}

	public get assignmentLabel(): string | undefined {
		return this.metadata.assignmentLabel;
	}

	public getConsoleState(): MissionAgentConsoleState {
		return this.session.getConsoleState();
	}

	public getSessionState(): MissionAgentSessionState {
		return this.session.getSessionState();
	}

	public updateMetadata(nextMetadata: Partial<Omit<AgentSessionMetadata, 'createdAt'>>): void {
		this.metadata = {
			createdAt: this.metadata.createdAt,
			...(nextMetadata.taskId ?? this.metadata.taskId
				? { taskId: nextMetadata.taskId ?? this.metadata.taskId }
				: {}),
			...(nextMetadata.assignmentLabel ?? this.metadata.assignmentLabel
				? { assignmentLabel: nextMetadata.assignmentLabel ?? this.metadata.assignmentLabel }
				: {})
		};
	}

	public getRecord(): MissionAgentSessionRecord {
		return cloneMissionAgentSessionRecord(
			createMissionAgentSessionRecord(this.session.getSessionState(), this.metadata)
		);
	}

	public async persist(): Promise<void> {
		await this.persistState(this.session.getSessionState());
	}

	public async submitTurn(request: MissionAgentTurnRequest): Promise<void> {
		await this.session.submitTurn(request);
		await this.persist();
	}

	public async sendInput(text: string): Promise<void> {
		await this.session.sendInput(text);
		await this.persist();
	}

	public async resize(dimensions: { cols: number; rows: number }): Promise<void> {
		if (!this.session.resize) {
			throw new Error(
				`Mission agent runtime '${this.runtime.id}' does not support terminal resize.`
			);
		}

		await this.session.resize(dimensions);
		await this.persist();
	}

	public async cancel(reason?: string): Promise<void> {
		await this.session.cancel(reason);
		await this.persist();
	}

	public async terminate(reason?: string): Promise<void> {
		await this.session.terminate(reason);
		await this.persist();
	}

	public dispose(): void {
		this.consoleSubscription.dispose();
		this.eventSubscription.dispose();
		this.session.dispose();
	}

	private async persistState(state: MissionAgentSessionState): Promise<void> {
		await this.hooks.persistRecord(createMissionAgentSessionRecord(state, this.metadata));
	}
}

function cloneAgentSessionMetadata(metadata: AgentSessionMetadata): AgentSessionMetadata {
	return {
		createdAt: metadata.createdAt,
		...(metadata.taskId ? { taskId: metadata.taskId } : {}),
		...(metadata.assignmentLabel ? { assignmentLabel: metadata.assignmentLabel } : {})
	};
}
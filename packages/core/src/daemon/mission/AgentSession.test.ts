import { describe, expect, it } from 'vitest';
import { AgentSession } from './AgentSession.js';
import {
	MissionAgentEventEmitter,
	type MissionAgentConsoleEvent,
	type MissionAgentConsoleState,
	type MissionAgentDisposable,
	type MissionAgentEvent,
	type MissionAgentRuntime,
	type MissionAgentRuntimeAvailability,
	type MissionAgentRuntimeCapabilities,
	type MissionAgentSession,
	type MissionAgentSessionRecord,
	type MissionAgentSessionState,
	type MissionAgentTurnRequest
} from '../MissionAgentRuntime.js';

describe('AgentSession', () => {
	it('persists session state before emitting session events', async () => {
		const runtime = new TestRuntime();
		const session = new TestSession();
		let releasePersist: (() => void) | undefined;
		const persistStarted = createDeferred<void>();
		const persistFinished = createDeferred<void>();
		const eventSeen = createDeferred<MissionAgentEvent>();
		const persistedRecords: MissionAgentSessionRecord[] = [];

		new AgentSession(
			runtime,
			session,
			{
				createdAt: '2026-04-02T00:00:00.000Z',
				taskId: 'prd/01-prd-from-brief',
				assignmentLabel: 'tasks/PRD/01-prd-from-brief.md'
			},
			{
				persistRecord: async (record) => {
					persistedRecords.push(record);
					persistStarted.resolve();
					await new Promise<void>((resolve) => {
						releasePersist = resolve;
					});
					persistFinished.resolve();
				},
				emitConsoleEvent: () => undefined,
				emitEvent: (event) => {
					eventSeen.resolve(event);
				}
			}
		);

		session.emitStateChange({
			...session.getSessionState(),
			lifecycleState: 'running',
			currentTurnTitle: 'PRD From Brief',
			workingDirectory: '/repo',
			lastUpdatedAt: '2026-04-02T00:00:01.000Z'
		});

		await persistStarted.promise;
		expect(persistedRecords).toHaveLength(1);
		expect(eventSeen.settled).toBe(false);

		releasePersist?.();
		await persistFinished.promise;
		const event = await eventSeen.promise;

		expect(event.type).toBe('session-state-changed');
		expect(persistedRecords[0]).toMatchObject({
			lifecycleState: 'running',
			taskId: 'prd/01-prd-from-brief',
			assignmentLabel: 'tasks/PRD/01-prd-from-brief.md',
			currentTurnTitle: 'PRD From Brief'
		});
	});
});

const TEST_RUNTIME_CAPABILITIES: MissionAgentRuntimeCapabilities = {
	persistentSessions: true,
	interactiveInput: true,
	scopedPrompts: true,
	resumableSessions: true,
	toolPermissionRequests: false,
	contextWindowVisibility: false,
	tokenUsageVisibility: false,
	costVisibility: false,
	customInstructions: false,
	telemetry: false,
	interruptible: true
};

class TestRuntime implements MissionAgentRuntime {
	public readonly id = 'test-runtime';
	public readonly displayName = 'Test Runtime';

	public get capabilities(): MissionAgentRuntimeCapabilities {
		return TEST_RUNTIME_CAPABILITIES;
	}

	public async isAvailable(): Promise<MissionAgentRuntimeAvailability> {
		return { available: true };
	}

	public async createSession(): Promise<MissionAgentSession> {
		return new TestSession();
	}
}

class TestSession implements MissionAgentSession {
	private readonly consoleEmitter = new MissionAgentEventEmitter<MissionAgentConsoleEvent>();
	private readonly eventEmitter = new MissionAgentEventEmitter<MissionAgentEvent>();
	private readonly consoleState: MissionAgentConsoleState = {
		lines: [],
		promptOptions: null,
		awaitingInput: false,
		runtimeId: 'test-runtime',
		runtimeLabel: 'Test Runtime',
		sessionId: 'session-1'
	};
	private sessionState: MissionAgentSessionState = {
		runtimeId: 'test-runtime',
		runtimeLabel: 'Test Runtime',
		sessionId: 'session-1',
		lifecycleState: 'idle',
		lastUpdatedAt: '2026-04-02T00:00:00.000Z'
	};

	public readonly runtimeId = 'test-runtime';
	public readonly sessionId = 'session-1';

	public get capabilities(): MissionAgentRuntimeCapabilities {
		return TEST_RUNTIME_CAPABILITIES;
	}

	public readonly onDidConsoleEvent = (listener: (event: MissionAgentConsoleEvent) => void): MissionAgentDisposable =>
		this.consoleEmitter.event(listener);

	public readonly onDidEvent = (listener: (event: MissionAgentEvent) => void): MissionAgentDisposable =>
		this.eventEmitter.event(listener);

	public getConsoleState(): MissionAgentConsoleState {
		return this.consoleState;
	}

	public getSessionState(): MissionAgentSessionState {
		return this.sessionState;
	}

	public emitStateChange(state: MissionAgentSessionState): void {
		this.sessionState = state;
		this.eventEmitter.fire({
			type: 'session-state-changed',
			state
		});
	}

	public async submitTurn(_request: MissionAgentTurnRequest): Promise<void> {}

	public async sendInput(_text: string): Promise<void> {}

	public async cancel(_reason?: string): Promise<void> {}

	public async terminate(_reason?: string): Promise<void> {}

	public dispose(): void {
		this.consoleEmitter.dispose();
		this.eventEmitter.dispose();
	}
}

function createDeferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	settled: boolean;
} {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const deferred = {
		settled: false,
		promise: new Promise<T>((nextResolve) => {
			resolve = (value) => {
				deferred.settled = true;
				nextResolve(value);
			};
		}),
		resolve
	};
	return deferred;
}
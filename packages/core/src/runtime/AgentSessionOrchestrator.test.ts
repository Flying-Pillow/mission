import { describe, expect, it } from 'vitest';
import type { AgentRunner } from './AgentRunner.js';
import type { AgentSession } from './AgentSession.js';
import { AgentSessionOrchestrator } from './AgentSessionOrchestrator.js';
import type { PersistedAgentSessionStore } from './PersistedAgentSessionStore.js';
import type {
    AgentCommand,
    AgentPrompt,
    AgentSessionEvent,
    AgentSessionReference,
    AgentSessionSnapshot,
    AgentSessionStartRequest
} from './AgentRuntimeTypes.js';

type Listener = (event: AgentSessionEvent) => void;

class FakeSession implements AgentSession {
    public readonly runnerId: string;
    public readonly transportId: string | undefined;
    public readonly sessionId: string;
    public disposeCalls = 0;
    private snapshot: AgentSessionSnapshot;
    private readonly listeners = new Set<Listener>();

    public constructor(snapshot: AgentSessionSnapshot) {
        this.runnerId = snapshot.runnerId;
        this.transportId = snapshot.transportId;
        this.sessionId = snapshot.sessionId;
        this.snapshot = { ...snapshot };
    }

    public getSnapshot(): AgentSessionSnapshot {
        return { ...this.snapshot, acceptedCommands: [...this.snapshot.acceptedCommands] };
    }

    public onDidEvent(listener: Listener): { dispose(): void } {
        this.listeners.add(listener);
        return {
            dispose: () => {
                this.listeners.delete(listener);
            }
        };
    }

    public async submitPrompt(_prompt: AgentPrompt): Promise<AgentSessionSnapshot> {
        return this.getSnapshot();
    }

    public async submitCommand(_command: AgentCommand): Promise<AgentSessionSnapshot> {
        return this.getSnapshot();
    }

    public async cancel(): Promise<AgentSessionSnapshot> {
        return this.getSnapshot();
    }

    public async terminate(): Promise<AgentSessionSnapshot> {
        return this.getSnapshot();
    }

    public dispose(): void {
        this.disposeCalls += 1;
        this.listeners.clear();
    }

    public emit(event: AgentSessionEvent): void {
        this.snapshot = {
            ...event.snapshot,
            acceptedCommands: [...event.snapshot.acceptedCommands]
        };
        for (const listener of this.listeners) {
            listener(event);
        }
    }
}

class InMemorySessionStore implements PersistedAgentSessionStore {
    public readonly references: AgentSessionReference[] = [];
    public readonly snapshots = new Map<string, AgentSessionSnapshot>();

    public async list(): Promise<AgentSessionReference[]> {
        return [...this.references];
    }

    public async load(reference: AgentSessionReference): Promise<AgentSessionSnapshot | undefined> {
        return this.snapshots.get(reference.sessionId);
    }

    public async save(snapshot: AgentSessionSnapshot): Promise<void> {
        this.snapshots.set(snapshot.sessionId, {
            ...snapshot,
            acceptedCommands: [...snapshot.acceptedCommands]
        });
    }

    public async delete(reference: AgentSessionReference): Promise<void> {
        this.snapshots.delete(reference.sessionId);
    }
}

function createStartRequest(): AgentSessionStartRequest {
    return {
        missionId: 'mission-1',
        taskId: 'task-1',
        workingDirectory: '/tmp/work',
        initialPrompt: {
            source: 'engine',
            text: 'Complete the task.'
        }
    };
}

async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe('AgentSessionOrchestrator', () => {
    it('retains mission/task identity when session events omit identity fields', async () => {
        const store = new InMemorySessionStore();
        let fakeSession: FakeSession | undefined;

        const runner: AgentRunner = {
            id: 'fake-runner',
            transportId: 'direct',
            displayName: 'Fake Runner',
            capabilities: {
                attachableSessions: false,
                promptSubmission: true,
                structuredCommands: true,
                interruptible: true,
                interactiveInput: false,
                telemetry: false,
                mcpClient: false
            },
            isAvailable: async () => ({ available: true }),
            startSession: async () => {
                fakeSession = new FakeSession({
                    runnerId: 'fake-runner',
                    transportId: 'direct',
                    sessionId: 'session-1',
                    missionId: 'mission-1',
                    taskId: 'task-1',
                    phase: 'running',
                    acceptsPrompts: true,
                    acceptedCommands: ['interrupt'],
                    awaitingInput: false,
                    updatedAt: new Date().toISOString()
                });
                return fakeSession;
            }
        };

        const orchestrator = new AgentSessionOrchestrator({
            runners: [runner],
            store
        });
        const observed: AgentSessionEvent[] = [];
        orchestrator.onDidEvent((event) => {
            observed.push(event);
        });

        await orchestrator.startSession('fake-runner', createStartRequest());
        fakeSession?.emit({
            type: 'session.state-changed',
            snapshot: {
                runnerId: 'fake-runner',
                transportId: 'direct',
                sessionId: 'session-1',
                missionId: '',
                taskId: '',
                phase: 'running',
                acceptsPrompts: true,
                acceptedCommands: ['interrupt'],
                awaitingInput: false,
                updatedAt: new Date().toISOString()
            }
        });
        await flushMicrotasks();

        expect(observed).toHaveLength(1);
        expect(observed[0]?.snapshot.missionId).toBe('mission-1');
        expect(observed[0]?.snapshot.taskId).toBe('task-1');

        const snapshot = orchestrator.listSessions()[0];
        expect(snapshot?.missionId).toBe('mission-1');
        expect(snapshot?.taskId).toBe('task-1');

        const persisted = store.snapshots.get('session-1');
        expect(persisted?.missionId).toBe('mission-1');
        expect(persisted?.taskId).toBe('task-1');
    });

    it('materializes a terminated attachment when a runner cannot attach sessions', async () => {
        const store = new InMemorySessionStore();

        const runner: AgentRunner = {
            id: 'fake-runner',
            transportId: 'direct',
            displayName: 'Fake Runner',
            capabilities: {
                attachableSessions: false,
                promptSubmission: true,
                structuredCommands: true,
                interruptible: true,
                interactiveInput: false,
                telemetry: false,
                mcpClient: false
            },
            isAvailable: async () => ({ available: true }),
            startSession: async () => {
                throw new Error('unused in this test');
            }
        };

        const orchestrator = new AgentSessionOrchestrator({
            runners: [runner],
            store
        });
        const observed: AgentSessionEvent[] = [];
        orchestrator.onDidEvent((event) => {
            observed.push(event);
        });

        const attached = await orchestrator.attachSession({
            runnerId: 'fake-runner',
            transportId: 'direct',
            sessionId: 'session-missing'
        });

        const snapshot = attached.getSnapshot();
        expect(snapshot.phase).toBe('terminated');
        expect(snapshot.acceptsPrompts).toBe(false);
        expect(snapshot.failureMessage).toContain('no longer exists');

        expect(observed).toHaveLength(1);
        expect(observed[0]?.type).toBe('session.terminated');
        expect(observed[0]?.snapshot.sessionId).toBe('session-missing');

        const persisted = store.snapshots.get('session-missing');
        expect(persisted).toBeUndefined();
        expect(orchestrator.listSessions()).toEqual([]);
    });

    it('materializes a terminated attachment when the runner is unavailable', async () => {
        const store = new InMemorySessionStore();
        const orchestrator = new AgentSessionOrchestrator({
            runners: [],
            store
        });

        const attached = await orchestrator.attachSession({
            runnerId: 'missing-runner',
            transportId: 'terminal',
            sessionId: 'session-missing-runner'
        });

        const snapshot = attached.getSnapshot();
        expect(snapshot.phase).toBe('terminated');
        expect(snapshot.acceptsPrompts).toBe(false);
        expect(snapshot.failureMessage).toContain('no longer exists');
        expect(orchestrator.listSessions()).toEqual([]);
        expect(store.snapshots.get('session-missing-runner')).toBeUndefined();
    });

    it('terminates detached sessions without throwing', async () => {
        const store = new InMemorySessionStore();

        const snapshot: AgentSessionSnapshot = {
            runnerId: 'fake-runner',
            transportId: 'terminal',
            sessionId: 'session-detached',
            missionId: 'mission-1',
            taskId: 'task-1',
            phase: 'running',
            acceptsPrompts: true,
            acceptedCommands: ['interrupt'],
            awaitingInput: false,
            updatedAt: new Date().toISOString()
        };

        const detachedSession: AgentSession = {
            runnerId: 'fake-runner',
            transportId: 'terminal',
            sessionId: 'session-detached',
            getSnapshot: () => ({ ...snapshot, acceptedCommands: [...snapshot.acceptedCommands] }),
            onDidEvent: () => ({ dispose: () => undefined }),
            submitPrompt: async () => ({ ...snapshot, acceptedCommands: [...snapshot.acceptedCommands] }),
            submitCommand: async () => ({ ...snapshot, acceptedCommands: [...snapshot.acceptedCommands] }),
            cancel: async () => {
                throw new Error("Agent session 'session-detached' is not attached.");
            },
            terminate: async () => {
                throw new Error("Agent session 'session-detached' is not attached.");
            },
            dispose: () => undefined
        };

        const runner: AgentRunner = {
            id: 'fake-runner',
            transportId: 'terminal',
            displayName: 'Fake Runner',
            capabilities: {
                attachableSessions: true,
                promptSubmission: true,
                structuredCommands: true,
                interruptible: true,
                interactiveInput: false,
                telemetry: false,
                mcpClient: false
            },
            isAvailable: async () => ({ available: true }),
            startSession: async () => {
                throw new Error('unused in this test');
            },
            attachSession: async () => detachedSession
        };

        const orchestrator = new AgentSessionOrchestrator({
            runners: [runner],
            store
        });

        await orchestrator.attachSession({
            runnerId: 'fake-runner',
            transportId: 'terminal',
            sessionId: 'session-detached'
        });

        const terminated = await orchestrator.terminateSession('session-detached', 'cleanup detached runtime');
        expect(terminated.phase).toBe('terminated');
        expect(terminated.acceptsPrompts).toBe(false);
        expect(terminated.awaitingInput).toBe(false);
        expect(terminated.failureMessage).toBe('cleanup detached runtime');
        expect(orchestrator.listSessions()).toEqual([]);
        expect(store.snapshots.get('session-detached')).toBeUndefined();
    });

    it('releases terminal sessions after completion events', async () => {
        const store = new InMemorySessionStore();
        let fakeSession: FakeSession | undefined;

        const runner: AgentRunner = {
            id: 'fake-runner',
            transportId: 'direct',
            displayName: 'Fake Runner',
            capabilities: {
                attachableSessions: false,
                promptSubmission: true,
                structuredCommands: true,
                interruptible: true,
                interactiveInput: false,
                telemetry: false,
                mcpClient: false
            },
            isAvailable: async () => ({ available: true }),
            startSession: async () => {
                fakeSession = new FakeSession({
                    runnerId: 'fake-runner',
                    transportId: 'direct',
                    sessionId: 'session-1',
                    missionId: 'mission-1',
                    taskId: 'task-1',
                    phase: 'running',
                    acceptsPrompts: true,
                    acceptedCommands: ['interrupt'],
                    awaitingInput: false,
                    updatedAt: new Date().toISOString()
                });
                return fakeSession;
            }
        };

        const orchestrator = new AgentSessionOrchestrator({
            runners: [runner],
            store
        });

        await orchestrator.startSession('fake-runner', createStartRequest());
        fakeSession?.emit({
            type: 'session.completed',
            snapshot: {
                runnerId: 'fake-runner',
                transportId: 'direct',
                sessionId: 'session-1',
                missionId: 'mission-1',
                taskId: 'task-1',
                phase: 'completed',
                acceptsPrompts: false,
                acceptedCommands: [],
                awaitingInput: false,
                updatedAt: new Date().toISOString()
            }
        });
        await flushMicrotasks();

        expect(orchestrator.listSessions()).toEqual([]);
        expect(store.snapshots.get('session-1')).toBeUndefined();
        expect(fakeSession?.disposeCalls).toBe(1);
    });

    it('disposes active sessions when the orchestrator is disposed', async () => {
        let fakeSession: FakeSession | undefined;

        const runner: AgentRunner = {
            id: 'fake-runner',
            transportId: 'direct',
            displayName: 'Fake Runner',
            capabilities: {
                attachableSessions: false,
                promptSubmission: true,
                structuredCommands: true,
                interruptible: true,
                interactiveInput: false,
                telemetry: false,
                mcpClient: false
            },
            isAvailable: async () => ({ available: true }),
            startSession: async () => {
                fakeSession = new FakeSession({
                    runnerId: 'fake-runner',
                    transportId: 'direct',
                    sessionId: 'session-1',
                    missionId: 'mission-1',
                    taskId: 'task-1',
                    phase: 'running',
                    acceptsPrompts: true,
                    acceptedCommands: ['interrupt'],
                    awaitingInput: false,
                    updatedAt: new Date().toISOString()
                });
                return fakeSession;
            }
        };

        const orchestrator = new AgentSessionOrchestrator({
            runners: [runner]
        });

        await orchestrator.startSession('fake-runner', createStartRequest());
        orchestrator.dispose();

        expect(orchestrator.listSessions()).toEqual([]);
        expect(fakeSession?.disposeCalls).toBe(1);
    });
});

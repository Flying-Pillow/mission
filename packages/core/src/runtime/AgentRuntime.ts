import type {
    AgentLaunchRequest,
    AgentPrompt,
    AgentRuntimeError,
    AgentSessionEvent,
    AgentSessionId,
    AgentSessionReference,
    AgentSessionSnapshot,
    AgentSteerAction,
    AgentRuntimePrimitive
} from './AgentRuntimeTypes.js';

export interface AgentRuntime {
    // Runtime chooses the runner. `requestedRunnerId` is advisory only.
    launch(request: AgentLaunchRequest): Promise<AgentSessionSnapshot>;
    // Attach never returns undefined. Missing sessions normalize to a terminal snapshot.
    attach(reference: AgentSessionReference): Promise<AgentSessionSnapshot>;
    listSessions(filter?: { missionId?: string }): Promise<AgentSessionSnapshot[]>;
    getSession(sessionId: AgentSessionId): Promise<AgentSessionSnapshot | undefined>;
    // These operations reject with AgentRuntimeError for unsupported or invalid operations.
    prompt(sessionId: AgentSessionId, prompt: AgentPrompt): Promise<AgentSessionSnapshot>;
    steer(
        sessionId: AgentSessionId,
        action: AgentSteerAction,
        options?: {
            reason?: string;
            metadata?: Record<string, AgentRuntimePrimitive>;
        }
    ): Promise<AgentSessionSnapshot>;
    cancel(sessionId: AgentSessionId, reason?: string): Promise<AgentSessionSnapshot>;
    terminate(sessionId: AgentSessionId, reason?: string): Promise<AgentSessionSnapshot>;
    // Observe is the authoritative runtime event stream used for workflow reconciliation.
    observe(listener: (event: AgentSessionEvent) => void): { dispose(): void };
}

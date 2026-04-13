export type AgentRunnerId = string;
export type AgentSessionId = string;
export type AgentRuntimePrimitive = string | number | boolean | null;

export type AgentRuntimeErrorCode =
    | 'runner-not-available'
    | 'session-not-found'
    | 'prompt-not-accepted'
    | 'action-not-supported'
    | 'invalid-session-state'
    | 'launch-failed'
    | 'attach-failed';

export type AgentSessionStatus =
    | 'starting'
    | 'running'
    | 'paused'
    | 'awaiting-input'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'terminated';

export type AgentProgressState =
    | 'unknown'
    | 'working'
    | 'paused'
    | 'waiting-input'
    | 'blocked'
    | 'done'
    | 'failed';

export type AgentAttentionState =
    | 'none'
    | 'autonomous'
    | 'awaiting-operator'
    | 'awaiting-system'
    | 'paused';

export type AgentPromptSource = 'engine' | 'operator' | 'system';

export type AgentSteerAction =
    | 'pause'
    | 'resume'
    | 'checkpoint'
    | 'nudge'
    | 'finish';

export interface AgentProgressSnapshot {
    state: AgentProgressState;
    summary?: string;
    detail?: string;
    units?: {
        completed?: number;
        total?: number;
        unit?: string;
    };
    updatedAt: string;
}

export interface AgentSessionReference {
    runnerId: AgentRunnerId;
    sessionId: AgentSessionId;
    transport?: {
        kind: 'terminal';
        terminalSessionName: string;
        paneId?: string;
    };
}

export interface AgentTaskContext {
    taskId: string;
    stageId: string;
    title: string;
    description: string;
    instruction: string;
    acceptanceCriteria?: string[];
}

export interface AgentContextDocument {
    documentId: string;
    kind: 'spec' | 'brief' | 'artifact' | 'note';
    title: string;
    path?: string;
    summary?: string;
}

export interface AgentSpecificationContext {
    summary: string;
    documents: AgentContextDocument[];
}

export interface AgentResumePolicy {
    mode: 'new' | 'attach-or-create' | 'attach-only';
    previousSessionId?: AgentSessionId;
}

export interface AgentLaunchRequest {
    missionId: string;
    workingDirectory: string;
    task: AgentTaskContext;
    specification: AgentSpecificationContext;
    requestedRunnerId?: AgentRunnerId;
    resume: AgentResumePolicy;
    initialPrompt?: AgentPrompt;
    metadata?: Record<string, AgentRuntimePrimitive>;
}

export interface AgentPrompt {
    source: AgentPromptSource;
    text: string;
    title?: string;
    metadata?: Record<string, AgentRuntimePrimitive>;
}

export interface AgentSessionSnapshot {
    runnerId: AgentRunnerId;
    sessionId: AgentSessionId;
    workingDirectory: string;
    taskId: string;
    missionId: string;
    stageId: string;
    status: AgentSessionStatus;
    attention: AgentAttentionState;
    progress: AgentProgressSnapshot;
    waitingForInput: boolean;
    acceptsPrompts: boolean;
    acceptedActions: AgentSteerAction[];
    transport?: {
        kind: 'terminal';
        terminalSessionName: string;
        paneId?: string;
    };
    failureMessage?: string;
    startedAt: string;
    updatedAt: string;
    endedAt?: string;
}

export interface AgentRuntimeError extends Error {
    readonly code: AgentRuntimeErrorCode;
    readonly runnerId?: AgentRunnerId;
    readonly sessionId?: AgentSessionId;
}

export type AgentSessionEvent =
    | {
        type: 'session.started';
        snapshot: AgentSessionSnapshot;
    }
    | {
        type: 'session.attached';
        snapshot: AgentSessionSnapshot;
    }
    | {
        type: 'session.updated';
        snapshot: AgentSessionSnapshot;
    }
    | {
        type: 'session.message';
        channel: 'stdout' | 'stderr' | 'system' | 'agent';
        text: string;
        snapshot: AgentSessionSnapshot;
    }
    | {
        type: 'session.awaiting-input';
        snapshot: AgentSessionSnapshot;
    }
    | {
        type: 'session.completed';
        snapshot: AgentSessionSnapshot;
    }
    | {
        type: 'session.failed';
        reason: string;
        snapshot: AgentSessionSnapshot;
    }
    | {
        type: 'session.cancelled';
        reason?: string;
        snapshot: AgentSessionSnapshot;
    }
    | {
        type: 'session.terminated';
        reason?: string;
        snapshot: AgentSessionSnapshot;
    };

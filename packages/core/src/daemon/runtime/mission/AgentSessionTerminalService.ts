import * as path from 'node:path';
import { TerminalAgentTransport, type TerminalSessionHandle, type TerminalSessionSnapshot } from '../agent/TerminalAgentTransport.js';
import { MissionAgentEventEmitter } from '../agent/events.js';
import { FilesystemAdapter } from '../../../lib/FilesystemAdapter.js';
import type { MissionSelector } from '../../../types.js';
import type { MissionAgentTerminalState } from '../../protocol/contracts.js';

type AgentSessionTerminalInput = {
    sessionId?: string;
    data?: string;
    literal?: boolean;
    cols?: number;
    rows?: number;
};

type AgentSessionTerminalRecord = {
    workspaceRoot: string;
    missionId: string;
    missionDir: string;
    sessionId: string;
    terminalSessionName: string;
    sessionLogPath?: string;
    handle?: TerminalSessionHandle;
};

export type AgentSessionTerminalUpdate = {
    workspaceRoot: string;
    missionId: string;
    sessionId: string;
    state: MissionAgentTerminalState;
};

const agentSessionTerminalTransport = new TerminalAgentTransport();
const agentSessionTerminalRecords = new Map<string, AgentSessionTerminalRecord>();
const agentSessionTerminalSessions = new Map<string, AgentSessionTerminalRecord>();
const agentSessionTerminalEventEmitter = new MissionAgentEventEmitter<AgentSessionTerminalUpdate>();

TerminalAgentTransport.onDidSessionUpdate((event) => {
    const record = agentSessionTerminalSessions.get(event.sessionName);
    if (!record) {
        return;
    }

    agentSessionTerminalEventEmitter.fire({
        workspaceRoot: record.workspaceRoot,
        missionId: record.missionId,
        sessionId: record.sessionId,
        state: createAgentSessionTerminalStateFromSnapshot(record, event)
    });
});

export function observeAgentSessionTerminalUpdates(listener: (event: AgentSessionTerminalUpdate) => void): { dispose(): void } {
    return agentSessionTerminalEventEmitter.event(listener);
}

export async function readAgentSessionTerminalState(input: {
    surfacePath: string;
    selector?: MissionSelector;
    sessionId?: string;
}): Promise<MissionAgentTerminalState | null> {
    const resolved = await resolveAgentSessionTerminalRecord(input);
    if (!resolved) {
        return null;
    }
    return createAgentSessionTerminalState(resolved);
}

export async function sendAgentSessionTerminalInput(input: {
    surfacePath: string;
    selector?: MissionSelector;
    terminalInput: AgentSessionTerminalInput;
}): Promise<MissionAgentTerminalState | null> {
    const resolved = await resolveAgentSessionTerminalRecord({
        surfacePath: input.surfacePath,
        ...(input.selector ? { selector: input.selector } : {}),
        ...(input.terminalInput.sessionId ? { sessionId: input.terminalInput.sessionId } : {})
    });
    if (!resolved?.handle) {
        return resolved ? createAgentSessionTerminalState(resolved) : null;
    }

    if (typeof input.terminalInput.data === 'string' && input.terminalInput.data.length > 0) {
        await agentSessionTerminalTransport.sendKeys(resolved.handle, input.terminalInput.data, {
            ...(input.terminalInput.literal !== undefined ? { literal: input.terminalInput.literal } : {})
        });
    }
    if (input.terminalInput.cols && input.terminalInput.rows) {
        await agentSessionTerminalTransport.resizeSession(resolved.handle, input.terminalInput.cols, input.terminalInput.rows);
    }

    return createAgentSessionTerminalState(resolved);
}

async function resolveAgentSessionTerminalRecord(input: {
    surfacePath: string;
    selector?: MissionSelector;
    sessionId?: string;
}): Promise<AgentSessionTerminalRecord | undefined> {
    const workspaceRoot = path.resolve(input.surfacePath.trim());
    const missionId = input.selector?.missionId?.trim();
    const sessionId = input.sessionId?.trim();
    if (!workspaceRoot || !missionId || !sessionId) {
        return undefined;
    }

    const key = `${workspaceRoot}:${missionId}:${sessionId}`;
    const cached = agentSessionTerminalRecords.get(key);
    if (cached) {
        return attachAgentSessionTerminal(cached);
    }

    const adapter = new FilesystemAdapter(workspaceRoot);
    const mission = await adapter.resolveKnownMission({ missionId }).catch(() => undefined);
    if (!mission) {
        return undefined;
    }

    const eventLog = await adapter.readMissionRuntimeEventLog(mission.missionDir).catch(() => []);
    const startedEvent = [...eventLog].reverse().find((event) => {
        const payload = event.payload as { sessionId?: unknown; terminalSessionName?: unknown } | undefined;
        return event.type === 'session.started'
            && payload?.sessionId === sessionId
            && typeof payload.terminalSessionName === 'string'
            && payload.terminalSessionName.trim().length > 0;
    });
    const payload = startedEvent?.payload as {
        terminalSessionName?: string;
        sessionLogPath?: string;
    } | undefined;
    const terminalSessionName = payload?.terminalSessionName?.trim();
    if (!terminalSessionName) {
        return undefined;
    }

    const record: AgentSessionTerminalRecord = {
        workspaceRoot,
        missionId,
        missionDir: mission.missionDir,
        sessionId,
        terminalSessionName,
        ...(payload?.sessionLogPath?.trim() ? { sessionLogPath: payload.sessionLogPath.trim() } : {})
    };
    agentSessionTerminalRecords.set(key, record);
    return attachAgentSessionTerminal(record);
}

async function attachAgentSessionTerminal(record: AgentSessionTerminalRecord): Promise<AgentSessionTerminalRecord> {
    if (record.handle) {
        return record;
    }
    const handle = await agentSessionTerminalTransport.attachSession(record.terminalSessionName, {
        sharedSessionName: record.terminalSessionName
    });
    if (!handle) {
        return record;
    }
    const attached = {
        ...record,
        handle
    };
    agentSessionTerminalRecords.set(`${record.workspaceRoot}:${record.missionId}:${record.sessionId}`, attached);
    agentSessionTerminalSessions.set(handle.sessionName, attached);
    return attached;
}

async function createAgentSessionTerminalState(record: AgentSessionTerminalRecord): Promise<MissionAgentTerminalState> {
    if (record.handle) {
        const snapshot = await agentSessionTerminalTransport.readSnapshot(record.handle);
        return createAgentSessionTerminalStateFromSnapshot(record, snapshot);
    }

    const transcript = record.sessionLogPath
        ? await new FilesystemAdapter(record.workspaceRoot).readMissionSessionLog(record.missionDir, record.sessionLogPath) ?? ''
        : '';
    return {
        sessionId: record.sessionId,
        connected: false,
        dead: true,
        exitCode: null,
        screen: transcript,
        terminalHandle: {
            sessionName: record.terminalSessionName,
            paneId: 'detached'
        }
    };
}

function createAgentSessionTerminalStateFromSnapshot(
    record: AgentSessionTerminalRecord,
    snapshot: TerminalSessionSnapshot
): MissionAgentTerminalState {
    return {
        sessionId: record.sessionId,
        connected: snapshot.connected,
        dead: snapshot.dead,
        exitCode: snapshot.exitCode,
        screen: snapshot.screen,
        ...(snapshot.truncated ? { truncated: true } : {}),
        ...(typeof snapshot.chunk === 'string' ? { chunk: snapshot.chunk } : {}),
        terminalHandle: {
            sessionName: snapshot.sessionName,
            paneId: snapshot.paneId,
            ...(snapshot.sharedSessionName ? { sharedSessionName: snapshot.sharedSessionName } : {})
        }
    };
}
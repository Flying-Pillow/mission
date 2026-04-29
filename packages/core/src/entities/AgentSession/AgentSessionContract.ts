import type { EntitySchema } from '../Entity/EntitySchema.js';
import {
    missionAgentSessionEntityName,
    agentSessionIdentityPayloadSchema,
    agentSessionExecuteCommandPayloadSchema,
    agentSessionSendPromptPayloadSchema,
    agentSessionSendCommandPayloadSchema,
    agentSessionReadTerminalPayloadSchema,
    agentSessionSendTerminalInputPayloadSchema,
    missionAgentSessionSnapshotSchema,
    agentSessionTerminalSnapshotSchema,
    agentSessionCommandAcknowledgementSchema
} from './AgentSessionSchema.js';

export const agentSessionEntityContract: EntitySchema = {
    entity: missionAgentSessionEntityName,
    queries: {
        read: {
            payload: agentSessionIdentityPayloadSchema,
            result: missionAgentSessionSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    return missionAgentSessionSnapshotSchema.parse(service.requireAgentSession(await service.buildMissionSnapshot(mission, payload.missionId), payload.sessionId));
                } finally {
                    mission.dispose();
                }
            }
        },
        readTerminal: {
            payload: agentSessionReadTerminalPayloadSchema,
            result: agentSessionTerminalSnapshotSchema,
            execute: async (payload, context) => {
                const { readAgentSessionTerminalState } = await import('../../daemon/AgentSessionTerminal.js');
                const state = await readAgentSessionTerminalState({
                    surfacePath: context.surfacePath,
                    selector: { missionId: payload.missionId },
                    sessionId: payload.sessionId
                });
                if (!state) {
                    throw new Error(`AgentSession terminal for '${payload.sessionId}' is not available.`);
                }
                return agentSessionTerminalSnapshotSchema.parse({
                    missionId: payload.missionId,
                    sessionId: payload.sessionId,
                    connected: state.connected,
                    dead: state.dead,
                    exitCode: state.dead ? state.exitCode : null,
                    screen: state.screen,
                    ...(state.chunk ? { chunk: state.chunk } : {}),
                    ...(state.truncated ? { truncated: true } : {}),
                    ...(state.terminalHandle ? { terminalHandle: state.terminalHandle } : {})
                });
            }
        }
    },
    commands: {
        executeCommand: {
            payload: agentSessionExecuteCommandPayloadSchema,
            result: agentSessionCommandAcknowledgementSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    service.requireAgentSession(await service.buildMissionSnapshot(mission, payload.missionId), payload.sessionId);
                    switch (payload.commandId) {
                        case 'agentSession.complete':
                            await mission.completeAgentSession(payload.sessionId);
                            break;
                        case 'agentSession.cancel':
                            await mission.cancelAgentSession(payload.sessionId, service.getReason(payload.input));
                            break;
                        case 'agentSession.terminate':
                            await mission.terminateAgentSession(payload.sessionId, service.getReason(payload.input));
                            break;
                        default:
                            throw new Error(`AgentSession command '${payload.commandId}' is not implemented in the daemon.`);
                    }
                    return agentSessionCommandAcknowledgementSchema.parse({
                        ok: true,
                        entity: 'AgentSession',
                        method: 'executeCommand',
                        id: payload.sessionId,
                        missionId: payload.missionId,
                        sessionId: payload.sessionId,
                        commandId: payload.commandId
                    });
                } finally {
                    mission.dispose();
                }
            }
        },
        sendPrompt: {
            payload: agentSessionSendPromptPayloadSchema,
            result: agentSessionCommandAcknowledgementSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    service.requireAgentSession(await service.buildMissionSnapshot(mission, payload.missionId), payload.sessionId);
                    await mission.sendAgentSessionPrompt(payload.sessionId, service.normalizeAgentPrompt(payload.prompt));
                    return agentSessionCommandAcknowledgementSchema.parse({
                        ok: true,
                        entity: 'AgentSession',
                        method: 'sendPrompt',
                        id: payload.sessionId,
                        missionId: payload.missionId,
                        sessionId: payload.sessionId
                    });
                } finally {
                    mission.dispose();
                }
            }
        },
        sendCommand: {
            payload: agentSessionSendCommandPayloadSchema,
            result: agentSessionCommandAcknowledgementSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    service.requireAgentSession(await service.buildMissionSnapshot(mission, payload.missionId), payload.sessionId);
                    await mission.sendAgentSessionCommand(payload.sessionId, service.normalizeAgentCommand(payload.command));
                    return agentSessionCommandAcknowledgementSchema.parse({
                        ok: true,
                        entity: 'AgentSession',
                        method: 'sendCommand',
                        id: payload.sessionId,
                        missionId: payload.missionId,
                        sessionId: payload.sessionId
                    });
                } finally {
                    mission.dispose();
                }
            }
        },
        sendTerminalInput: {
            payload: agentSessionSendTerminalInputPayloadSchema,
            result: agentSessionTerminalSnapshotSchema,
            execute: async (payload, context) => {
                const { sendAgentSessionTerminalInput } = await import('../../daemon/AgentSessionTerminal.js');
                const state = await sendAgentSessionTerminalInput({
                    surfacePath: context.surfacePath,
                    selector: { missionId: payload.missionId },
                    terminalInput: {
                        sessionId: payload.sessionId,
                        ...(payload.data !== undefined ? { data: payload.data } : {}),
                        ...(payload.literal !== undefined ? { literal: payload.literal } : {}),
                        ...(payload.cols !== undefined ? { cols: payload.cols } : {}),
                        ...(payload.rows !== undefined ? { rows: payload.rows } : {})
                    }
                });
                if (!state) {
                    throw new Error(`AgentSession terminal for '${payload.sessionId}' is not available.`);
                }
                return agentSessionTerminalSnapshotSchema.parse({
                    missionId: payload.missionId,
                    sessionId: payload.sessionId,
                    connected: state.connected,
                    dead: state.dead,
                    exitCode: state.dead ? state.exitCode : null,
                    screen: state.screen,
                    ...(state.chunk ? { chunk: state.chunk } : {}),
                    ...(state.truncated ? { truncated: true } : {}),
                    ...(state.terminalHandle ? { terminalHandle: state.terminalHandle } : {})
                });
            }
        }
    }
};

async function loadMissionDaemon(context: Parameters<typeof import('../../daemon/MissionDaemon.js').requireMissionDaemon>[0]) {
    const { requireMissionDaemon } = await import('../../daemon/MissionDaemon.js');
    return requireMissionDaemon(context);
}

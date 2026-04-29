import type { EntitySchema } from '../Entity/EntitySchema.js';
import {
    missionEntityName,
    missionActionListSnapshotSchema,
    missionDocumentSnapshotSchema,
    missionWorktreeSnapshotSchema,
    missionSnapshotSchema,
    missionProjectionSnapshotSchema,
    missionReadPayloadSchema,
    missionReadProjectionPayloadSchema,
    missionListActionsPayloadSchema,
    missionReadDocumentPayloadSchema,
    missionReadWorktreePayloadSchema,
    missionReadTerminalPayloadSchema,
    missionEnsureTerminalPayloadSchema,
    missionSendTerminalInputPayloadSchema,
    missionCommandPayloadSchema,
    missionTaskCommandPayloadSchema,
    missionAgentSessionCommandPayloadSchema,
    missionExecuteActionPayloadSchema,
    missionWriteDocumentPayloadSchema,
    missionTerminalSnapshotSchema,
    missionCommandAcknowledgementSchema
} from './MissionSchema.js';
import type {
    MissionIdentityPayload,
    MissionCommandAcknowledgement
} from './MissionSchema.js';
import type { OperatorActionExecutionStep } from '../../types.js';

export const missionEntityContract: EntitySchema = {
    entity: missionEntityName,
    queries: {
        read: {
            payload: missionReadPayloadSchema,
            result: missionSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    return missionSnapshotSchema.parse(await service.buildMissionSnapshot(mission, payload.missionId));
                } finally {
                    mission.dispose();
                }
            }
        },
        readProjection: {
            payload: missionReadProjectionPayloadSchema,
            result: missionProjectionSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    const snapshot = await service.buildMissionSnapshot(mission, payload.missionId);
                    return missionProjectionSnapshotSchema.parse({
                        missionId: snapshot.mission.missionId,
                        ...(snapshot.status ? { status: snapshot.status } : {}),
                        ...(snapshot.workflow ? { workflow: snapshot.workflow } : {}),
                        actions: await service.buildMissionActionListSnapshot(mission, payload.missionId),
                        updatedAt: snapshot.mission.updatedAt
                    });
                } finally {
                    mission.dispose();
                }
            }
        },
        listActions: {
            payload: missionListActionsPayloadSchema,
            result: missionActionListSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    return missionActionListSnapshotSchema.parse({
                        ...(await service.buildMissionActionListSnapshot(mission, payload.missionId)),
                        ...(payload.context ? { context: payload.context } : {})
                    });
                } finally {
                    mission.dispose();
                }
            }
        },
        readDocument: {
            payload: missionReadDocumentPayloadSchema,
            result: missionDocumentSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    await service.assertMissionDocumentPath(payload.path, 'read', service.resolveControlRoot(payload, context));
                    return missionDocumentSnapshotSchema.parse(await service.readMissionDocument(payload.path));
                } finally {
                    mission.dispose();
                }
            }
        },
        readWorktree: {
            payload: missionReadWorktreePayloadSchema,
            result: missionWorktreeSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    const [path, { getMissionWorktreesPath }] = await Promise.all([
                        import('node:path'),
                        import(/* @vite-ignore */ '../../lib/repositoryPaths.js')
                    ]);
                    const rootPath = path.join(getMissionWorktreesPath(service.resolveControlRoot(payload, context)), payload.missionId);
                    return missionWorktreeSnapshotSchema.parse({
                        rootPath,
                        fetchedAt: new Date().toISOString(),
                        tree: await service.readDirectoryTree(rootPath, rootPath)
                    });
                } finally {
                    mission.dispose();
                }
            }
        },
        readTerminal: {
            payload: missionReadTerminalPayloadSchema,
            result: missionTerminalSnapshotSchema,
            execute: async (payload, context) => {
                const { readMissionTerminalState } = await import('../../daemon/MissionTerminal.js');
                const state = await readMissionTerminalState({
                    surfacePath: context.surfacePath,
                    selector: { missionId: payload.missionId }
                });
                if (!state) {
                    throw new Error(`Mission terminal for '${payload.missionId}' is not available.`);
                }
                return missionTerminalSnapshotSchema.parse({
                    missionId: payload.missionId,
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
        command: {
            payload: missionCommandPayloadSchema,
            result: missionCommandAcknowledgementSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    switch (payload.command.action) {
                        case 'pause':
                            await mission.pauseMission();
                            break;
                        case 'resume':
                            await mission.resumeMission();
                            break;
                        case 'panic':
                            await mission.panicStopMission();
                            break;
                        case 'clearPanic':
                            await mission.clearMissionPanic();
                            break;
                        case 'restartQueue':
                            await mission.restartLaunchQueue();
                            break;
                        case 'deliver':
                            await mission.deliver();
                            break;
                    }
                    return buildCommandAcknowledgement(payload, 'command');
                } finally {
                    mission.dispose();
                }
            }
        },
        taskCommand: {
            payload: missionTaskCommandPayloadSchema,
            result: missionCommandAcknowledgementSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const terminalSessionName = payload.command.action === 'start'
                    ? payload.command.terminalSessionName
                    : undefined;
                const mission = await service.loadRequiredMission(payload, context, terminalSessionName);
                try {
                    switch (payload.command.action) {
                        case 'start':
                            await mission.startTask(
                                payload.taskId,
                                payload.command.terminalSessionName?.trim()
                                    ? { terminalSessionName: payload.command.terminalSessionName.trim() }
                                    : {}
                            );
                            break;
                        case 'complete':
                            await mission.completeTask(payload.taskId);
                            break;
                        case 'reopen':
                            await mission.reopenTask(payload.taskId);
                            break;
                    }
                    return buildCommandAcknowledgement(payload, 'taskCommand', { taskId: payload.taskId });
                } finally {
                    mission.dispose();
                }
            }
        },
        sessionCommand: {
            payload: missionAgentSessionCommandPayloadSchema,
            result: missionCommandAcknowledgementSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    switch (payload.command.action) {
                        case 'complete':
                            await mission.completeAgentSession(payload.sessionId);
                            break;
                        case 'cancel':
                            await mission.cancelAgentSession(payload.sessionId, payload.command.reason);
                            break;
                        case 'terminate':
                            await mission.terminateAgentSession(payload.sessionId, payload.command.reason);
                            break;
                        case 'prompt':
                            await mission.sendAgentSessionPrompt(payload.sessionId, service.normalizeAgentPrompt(payload.command.prompt));
                            break;
                        case 'command':
                            await mission.sendAgentSessionCommand(payload.sessionId, service.normalizeAgentCommand(payload.command.command));
                            break;
                    }
                    return buildCommandAcknowledgement(payload, 'sessionCommand', { sessionId: payload.sessionId });
                } finally {
                    mission.dispose();
                }
            }
        },
        executeAction: {
            payload: missionExecuteActionPayloadSchema,
            result: missionCommandAcknowledgementSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context, payload.terminalSessionName);
                try {
                    await mission.executeAction(
                        payload.actionId,
                        (payload.steps ?? []) as OperatorActionExecutionStep[],
                        payload.terminalSessionName?.trim()
                            ? { terminalSessionName: payload.terminalSessionName.trim() }
                            : {}
                    );
                    return buildCommandAcknowledgement(payload, 'executeAction', { actionId: payload.actionId });
                } finally {
                    mission.dispose();
                }
            }
        },
        writeDocument: {
            payload: missionWriteDocumentPayloadSchema,
            result: missionDocumentSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
                try {
                    await service.assertMissionDocumentPath(payload.path, 'write', service.resolveControlRoot(payload, context));
                    return missionDocumentSnapshotSchema.parse(await service.writeMissionDocument(payload.path, payload.content));
                } finally {
                    mission.dispose();
                }
            }
        },
        ensureTerminal: {
            payload: missionEnsureTerminalPayloadSchema,
            result: missionTerminalSnapshotSchema,
            execute: async (payload, context) => {
                const { ensureMissionTerminalState } = await import('../../daemon/MissionTerminal.js');
                const state = await ensureMissionTerminalState({
                    surfacePath: context.surfacePath,
                    selector: { missionId: payload.missionId }
                });
                if (!state) {
                    throw new Error(`Mission terminal for '${payload.missionId}' is not available.`);
                }
                return missionTerminalSnapshotSchema.parse({
                    missionId: payload.missionId,
                    connected: state.connected,
                    dead: state.dead,
                    exitCode: state.dead ? state.exitCode : null,
                    screen: state.screen,
                    ...(state.chunk ? { chunk: state.chunk } : {}),
                    ...(state.truncated ? { truncated: true } : {}),
                    ...(state.terminalHandle ? { terminalHandle: state.terminalHandle } : {})
                });
            }
        },
        sendTerminalInput: {
            payload: missionSendTerminalInputPayloadSchema,
            result: missionTerminalSnapshotSchema,
            execute: async (payload, context) => {
                const { sendMissionTerminalInput } = await import('../../daemon/MissionTerminal.js');
                const state = await sendMissionTerminalInput({
                    surfacePath: context.surfacePath,
                    selector: { missionId: payload.missionId },
                    terminalInput: {
                        ...(payload.data !== undefined ? { data: payload.data } : {}),
                        ...(payload.literal !== undefined ? { literal: payload.literal } : {}),
                        ...(payload.cols !== undefined ? { cols: payload.cols } : {}),
                        ...(payload.rows !== undefined ? { rows: payload.rows } : {})
                    }
                });
                if (!state) {
                    throw new Error(`Mission terminal for '${payload.missionId}' is not available.`);
                }
                return missionTerminalSnapshotSchema.parse({
                    missionId: payload.missionId,
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

function buildCommandAcknowledgement(
    payload: MissionIdentityPayload,
    method: MissionCommandAcknowledgement['method'],
    identifiers: {
        taskId?: string;
        sessionId?: string;
        actionId?: string;
    } = {}
): MissionCommandAcknowledgement {
    return missionCommandAcknowledgementSchema.parse({
        ok: true,
        entity: 'Mission',
        method,
        id: payload.missionId,
        missionId: payload.missionId,
        ...identifiers
    });
}

async function loadMissionDaemon(context: Parameters<typeof import('../../daemon/MissionDaemon.js').requireMissionDaemon>[0]) {
    const { requireMissionDaemon } = await import('../../daemon/MissionDaemon.js');
    return requireMissionDaemon(context);
}

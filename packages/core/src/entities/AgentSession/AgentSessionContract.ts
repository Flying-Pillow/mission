import type { EntitySchema } from '../Entity/EntitySchema.js';
import { AgentSession } from './AgentSession.js';
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
    entityClass: AgentSession,
    methods: {
        read: {
            kind: 'query',
            payload: agentSessionIdentityPayloadSchema,
            result: missionAgentSessionSnapshotSchema,
            execution: 'class'
        },
        readTerminal: {
            kind: 'query',
            payload: agentSessionReadTerminalPayloadSchema,
            result: agentSessionTerminalSnapshotSchema,
            execution: 'class'
        },
        executeCommand: {
            kind: 'mutation',
            payload: agentSessionExecuteCommandPayloadSchema,
            result: agentSessionCommandAcknowledgementSchema,
            execution: 'class'
        },
        sendPrompt: {
            kind: 'mutation',
            payload: agentSessionSendPromptPayloadSchema,
            result: agentSessionCommandAcknowledgementSchema,
            execution: 'class'
        },
        sendCommand: {
            kind: 'mutation',
            payload: agentSessionSendCommandPayloadSchema,
            result: agentSessionCommandAcknowledgementSchema,
            execution: 'class'
        },
        sendTerminalInput: {
            kind: 'mutation',
            payload: agentSessionSendTerminalInputPayloadSchema,
            result: agentSessionTerminalSnapshotSchema,
            execution: 'class'
        }
    }
};

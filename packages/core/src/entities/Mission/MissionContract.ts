import type { EntitySchema } from '../Entity/EntitySchema.js';
import { Mission } from './Mission.js';
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
export const missionEntityContract: EntitySchema = {
    entity: missionEntityName,
    entityClass: Mission,
    methods: {
        read: {
            kind: 'query',
            payload: missionReadPayloadSchema,
            result: missionSnapshotSchema,
            execution: 'class'
        },
        readProjection: {
            kind: 'query',
            payload: missionReadProjectionPayloadSchema,
            result: missionProjectionSnapshotSchema,
            execution: 'class'
        },
        listActions: {
            kind: 'query',
            payload: missionListActionsPayloadSchema,
            result: missionActionListSnapshotSchema,
            execution: 'class'
        },
        readDocument: {
            kind: 'query',
            payload: missionReadDocumentPayloadSchema,
            result: missionDocumentSnapshotSchema,
            execution: 'class'
        },
        readWorktree: {
            kind: 'query',
            payload: missionReadWorktreePayloadSchema,
            result: missionWorktreeSnapshotSchema,
            execution: 'class'
        },
        readTerminal: {
            kind: 'query',
            payload: missionReadTerminalPayloadSchema,
            result: missionTerminalSnapshotSchema,
            execution: 'class'
        },
        command: {
            kind: 'mutation',
            payload: missionCommandPayloadSchema,
            result: missionCommandAcknowledgementSchema,
            execution: 'class'
        },
        taskCommand: {
            kind: 'mutation',
            payload: missionTaskCommandPayloadSchema,
            result: missionCommandAcknowledgementSchema,
            execution: 'class'
        },
        sessionCommand: {
            kind: 'mutation',
            payload: missionAgentSessionCommandPayloadSchema,
            result: missionCommandAcknowledgementSchema,
            execution: 'class'
        },
        executeAction: {
            kind: 'mutation',
            payload: missionExecuteActionPayloadSchema,
            result: missionCommandAcknowledgementSchema,
            execution: 'class'
        },
        writeDocument: {
            kind: 'mutation',
            payload: missionWriteDocumentPayloadSchema,
            result: missionDocumentSnapshotSchema,
            execution: 'class'
        },
        ensureTerminal: {
            kind: 'mutation',
            payload: missionEnsureTerminalPayloadSchema,
            result: missionTerminalSnapshotSchema,
            execution: 'class'
        },
        sendTerminalInput: {
            kind: 'mutation',
            payload: missionSendTerminalInputPayloadSchema,
            result: missionTerminalSnapshotSchema,
            execution: 'class'
        }
    }
};

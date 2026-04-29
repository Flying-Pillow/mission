import type { EntitySchema } from '../Entity/EntitySchema.js';
import { Task } from './Task.js';
import {
    missionTaskEntityName,
    taskIdentityPayloadSchema,
    taskExecuteCommandPayloadSchema,
    missionTaskSnapshotSchema,
    taskCommandAcknowledgementSchema
} from './TaskSchema.js';

export const taskEntityContract: EntitySchema = {
    entity: missionTaskEntityName,
    entityClass: Task,
    methods: {
        read: {
            kind: 'query',
            payload: taskIdentityPayloadSchema,
            result: missionTaskSnapshotSchema,
            execution: 'class'
        },
        executeCommand: {
            kind: 'mutation',
            payload: taskExecuteCommandPayloadSchema,
            result: taskCommandAcknowledgementSchema,
            execution: 'class'
        }
    }
};

import { z } from 'zod/v4';
import type { EntityContract } from '../Entity/EntityContract.js';
import {
    githubIssueDetailSchema,
    repositoryAddPayloadSchema,
    repositoryEntityName,
    repositoryFindPayloadSchema,
    repositoryGetIssuePayloadSchema,
    repositoryListIssuesPayloadSchema,
    repositoryMissionStartAcknowledgementSchema,
    repositoryReadPayloadSchema,
    repositorySnapshotSchema,
    repositoryStartMissionFromBriefPayloadSchema,
    repositoryStartMissionFromIssuePayloadSchema,
    trackedIssueSummarySchema,
    type RepositoryReadPayload
} from './RepositorySchema.js';

type RepositoryEntity = typeof import('./Repository.js')['Repository'];

export const repositoryEntityContract: EntityContract = {
    entity: repositoryEntityName,
    queries: {
        find: {
            payload: repositoryFindPayloadSchema,
            result: z.array(repositorySnapshotSchema),
            execute: async (payload, context) => (await loadRepositoryEntity()).find(payload, context)
        },
        read: {
            payload: repositoryReadPayloadSchema,
            result: repositorySnapshotSchema,
            execute: async (payload) => (await resolveRepository(payload, 'read')).read(payload)
        },
        listIssues: {
            payload: repositoryListIssuesPayloadSchema,
            result: z.array(trackedIssueSummarySchema),
            execute: async (payload, context) => (await resolveRepository(payload, 'listIssues')).listIssues(payload, context)
        },
        getIssue: {
            payload: repositoryGetIssuePayloadSchema,
            result: githubIssueDetailSchema,
            execute: async (payload, context) => (await resolveRepository(payload, 'getIssue')).getIssue(payload, context)
        }
    },
    commands: {
        add: {
            payload: repositoryAddPayloadSchema,
            result: repositorySnapshotSchema,
            execute: async (payload, context) => (await loadRepositoryEntity()).add(payload, context)
        },
        startMissionFromIssue: {
            payload: repositoryStartMissionFromIssuePayloadSchema,
            result: repositoryMissionStartAcknowledgementSchema,
            execute: async (payload, context) => (await resolveRepository(payload, 'startMissionFromIssue')).startMissionFromIssue(payload, context)
        },
        startMissionFromBrief: {
            payload: repositoryStartMissionFromBriefPayloadSchema,
            result: repositoryMissionStartAcknowledgementSchema,
            execute: async (payload, context) => (await resolveRepository(payload, 'startMissionFromBrief')).startMissionFromBrief(payload, context)
        }
    }
};

async function resolveRepository(payload: RepositoryReadPayload, method: string): Promise<InstanceType<RepositoryEntity>> {
    const RepositoryClass = await loadRepositoryEntity();
    const repository = await RepositoryClass.resolve({
        repositoryId: payload.repositoryId,
        ...(payload.repositoryRootPath ? { repositoryRootPath: payload.repositoryRootPath } : {})
    });
    if (!repository) {
        throw new Error(`Entity '${repositoryEntityName}' could not be resolved for method '${method}'.`);
    }
    return repository;
}

async function loadRepositoryEntity(): Promise<RepositoryEntity> {
    return (await import('./Repository.js')).Repository;
}
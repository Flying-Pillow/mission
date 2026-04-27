import { z } from 'zod/v4';
import type { EntityContract } from '../Entity/EntityContract.js';
import {
    RepositorySettingsSchema,
    createDefaultRepositorySettings
} from './RepositorySettings.js';
import { WorkflowGlobalSettingsSchema } from '../../workflow/WorkflowSchema.js';
import { createDefaultWorkflowSettings } from '../../workflow/mission/workflow.js';
import {
    missionEntityTypeSchema,
    missionSnapshotSchema
} from '../Mission/MissionContract.js';
import { entityCommandAcknowledgementSchema } from '../Entity/EntityContract.js';

export const repositoryWorkflowConfigurationSchema = WorkflowGlobalSettingsSchema;

export const repositoryEntityName = 'Repository' as const;

export const repositoryInputSchema = z.object({
    repositoryRootPath: z.string().trim().min(1),
    label: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    githubRepository: z.string().trim().min(1).optional(),
    settings: RepositorySettingsSchema.optional(),
    workflowConfiguration: repositoryWorkflowConfigurationSchema.optional(),
    isInitialized: z.boolean().optional()
}).strict();

export const repositorySchema = z.object({
    repositoryId: z.string().trim().min(1),
    repositoryRootPath: z.string().trim().min(1),
    ownerId: z.string().trim().min(1),
    repoName: z.string().trim().min(1),
    label: z.string().trim().min(1),
    description: z.string(),
    githubRepository: z.string().trim().min(1).optional(),
    settings: RepositorySettingsSchema,
    workflowConfiguration: repositoryWorkflowConfigurationSchema,
    isInitialized: z.boolean()
}).strict();

export const missionReferenceSchema = z.object({
    missionId: z.string().trim().min(1),
    title: z.string().trim().min(1),
    branchRef: z.string().trim().min(1),
    createdAt: z.string().trim().min(1),
    issueId: z.number().int().positive().optional()
}).strict();

export const repositoryIdentityPayloadSchema = z.object({
    repositoryId: z.string().trim().min(1),
    repositoryRootPath: z.string().trim().min(1).optional()
}).strict();

export const repositoryFindPayloadSchema = z.object({}).strict();

export const repositoryRegistrationInputSchema = z.object({
    repositoryPath: z.string().trim().min(1)
}).strict();

export const repositoryAddPayloadSchema = repositoryRegistrationInputSchema;

export const repositoryReadPayloadSchema = repositoryIdentityPayloadSchema;

export const repositoryListIssuesPayloadSchema = repositoryIdentityPayloadSchema;

export const repositoryGetIssuePayloadSchema = repositoryIdentityPayloadSchema.extend({
    issueNumber: z.coerce.number().int().positive()
}).strict();

export const missionFromIssueInputSchema = z.object({
    issueNumber: z.coerce.number().int().positive()
}).strict();

export const missionFromBriefInputSchema = z.object({
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
    type: missionEntityTypeSchema
}).strict();

export const repositoryStartMissionFromIssuePayloadSchema = repositoryIdentityPayloadSchema.extend(
    missionFromIssueInputSchema.shape
).strict();

export const repositoryStartMissionFromBriefPayloadSchema = repositoryIdentityPayloadSchema.extend(
    missionFromBriefInputSchema.shape
).strict();

export const trackedIssueSummarySchema = z.object({
    number: z.number().int().positive(),
    title: z.string().trim().min(1),
    url: z.string().trim().min(1),
    updatedAt: z.string().trim().min(1).optional(),
    labels: z.array(z.string()),
    assignees: z.array(z.string())
}).strict();

export const githubIssueDetailSchema = z.object({
    number: z.number().int().positive(),
    title: z.string().trim().min(1),
    body: z.string(),
    url: z.string().trim().min(1).optional(),
    updatedAt: z.string().trim().min(1).optional(),
    labels: z.array(z.string()),
    assignees: z.array(z.string())
}).strict();

export const repositorySnapshotSchema = z.object({
    repository: repositorySchema,
    operationalMode: z.string().trim().min(1).optional(),
    controlRoot: z.string().trim().min(1).optional(),
    currentBranch: z.string().trim().min(1).optional(),
    settingsComplete: z.boolean().optional(),
    githubRepository: z.string().trim().min(1).optional(),
    missions: z.array(missionReferenceSchema),
    selectedMissionId: z.string().trim().min(1).optional(),
    selectedMission: missionSnapshotSchema.optional(),
    selectedIssue: githubIssueDetailSchema.optional()
}).strict();

export const repositoryMissionStartMethodSchema = z.enum([
    'startMissionFromIssue',
    'startMissionFromBrief'
]);

export const repositoryMissionStartAcknowledgementSchema = entityCommandAcknowledgementSchema.extend({
    entity: z.literal(repositoryEntityName),
    method: repositoryMissionStartMethodSchema,
    id: z.string().trim().min(1)
}).strict();

export const repositoryRemoteQueryPayloadSchemas = {
    find: repositoryFindPayloadSchema,
    read: repositoryReadPayloadSchema,
    listIssues: repositoryListIssuesPayloadSchema,
    getIssue: repositoryGetIssuePayloadSchema
} as const;

export const repositoryRemoteCommandPayloadSchemas = {
    add: repositoryAddPayloadSchema,
    startMissionFromIssue: repositoryStartMissionFromIssuePayloadSchema,
    startMissionFromBrief: repositoryStartMissionFromBriefPayloadSchema
} as const;

export const repositoryRemoteQueryResultSchemas = {
    find: z.array(repositorySnapshotSchema),
    read: repositorySnapshotSchema,
    listIssues: z.array(trackedIssueSummarySchema),
    getIssue: githubIssueDetailSchema
} as const;

export const repositoryRemoteCommandResultSchemas = {
    add: repositorySnapshotSchema,
    startMissionFromIssue: repositoryMissionStartAcknowledgementSchema,
    startMissionFromBrief: repositoryMissionStartAcknowledgementSchema
} as const;

export type RepositoryInput = z.infer<typeof repositoryInputSchema>;
export type RepositoryData = z.infer<typeof repositorySchema>;
export type Repository = RepositoryData;
export type MissionReference = z.infer<typeof missionReferenceSchema>;
export type RepositoryFindPayload = z.infer<typeof repositoryFindPayloadSchema>;
export type RepositoryAddPayload = z.infer<typeof repositoryAddPayloadSchema>;
export type RepositoryReadPayload = z.infer<typeof repositoryReadPayloadSchema>;
export type RepositoryListIssuesPayload = z.infer<typeof repositoryListIssuesPayloadSchema>;
export type RepositoryGetIssuePayload = z.infer<typeof repositoryGetIssuePayloadSchema>;
export type RepositoryStartMissionFromIssuePayload = z.infer<typeof repositoryStartMissionFromIssuePayloadSchema>;
export type RepositoryStartMissionFromBriefPayload = z.infer<typeof repositoryStartMissionFromBriefPayloadSchema>;
export type RepositorySnapshot = z.infer<typeof repositorySnapshotSchema>;
export type GitHubIssueDetail = z.infer<typeof githubIssueDetailSchema>;
export type TrackedIssueSummary = z.infer<typeof trackedIssueSummarySchema>;
export type RepositoryMissionStartAcknowledgement = z.infer<typeof repositoryMissionStartAcknowledgementSchema>;

type RepositoryEntity = typeof import('./Repository.js')['Repository'];

export function createDefaultRepositoryConfiguration(): Pick<RepositoryData, 'settings' | 'workflowConfiguration' | 'isInitialized'> {
    const settings = createDefaultRepositorySettings();
    return {
        settings,
        workflowConfiguration: createDefaultWorkflowSettings(),
        isInitialized: false
    };
}

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
    return (await import(/* @vite-ignore */ './Repository.js')).Repository;
}

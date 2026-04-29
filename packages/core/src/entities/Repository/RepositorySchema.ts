import { z } from 'zod/v4';
import {
    RepositorySettingsSchema,
    createDefaultRepositorySettings
} from './RepositorySettings.js';
import { WorkflowGlobalSettingsSchema } from '../../workflow/WorkflowSchema.js';
import { createDefaultWorkflowSettings } from '../../workflow/mission/workflow.js';
import {
    missionEntityTypeSchema,
    missionSnapshotSchema
} from '../Mission/MissionSchema.js';
import { entityCommandAcknowledgementSchema } from '../Entity/EntitySchema.js';

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

export const repositoryStorageSchema = z.object({
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

export const repositoryDataSchema = repositoryStorageSchema;
export const repositorySchema = repositoryDataSchema;

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

export const repositoryGitHubCheckoutInputSchema = z.object({
    githubRepository: z.string().trim().min(1),
    destinationPath: z.string().trim().min(1)
}).strict();

export const repositoryAddPayloadSchema = z.union([
    repositoryRegistrationInputSchema,
    repositoryGitHubCheckoutInputSchema
]);

export const repositoryRemovePayloadSchema = repositoryIdentityPayloadSchema;

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
    repository: repositoryDataSchema,
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

export const repositoryRemoveAcknowledgementSchema = entityCommandAcknowledgementSchema.extend({
    entity: z.literal(repositoryEntityName),
    method: z.literal('remove'),
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
    remove: repositoryRemovePayloadSchema,
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
    remove: repositoryRemoveAcknowledgementSchema,
    startMissionFromIssue: repositoryMissionStartAcknowledgementSchema,
    startMissionFromBrief: repositoryMissionStartAcknowledgementSchema
} as const;

export type RepositoryInput = z.infer<typeof repositoryInputSchema>;
export type RepositoryStorage = z.infer<typeof repositoryStorageSchema>;
export type RepositoryData = z.infer<typeof repositoryDataSchema>;
export type Repository = RepositoryData;
export type MissionReference = z.infer<typeof missionReferenceSchema>;
export type RepositoryFindPayload = z.infer<typeof repositoryFindPayloadSchema>;
export type RepositoryAddPayload = z.infer<typeof repositoryAddPayloadSchema>;
export type RepositoryRemovePayload = z.infer<typeof repositoryRemovePayloadSchema>;
export type RepositoryReadPayload = z.infer<typeof repositoryReadPayloadSchema>;
export type RepositoryListIssuesPayload = z.infer<typeof repositoryListIssuesPayloadSchema>;
export type RepositoryGetIssuePayload = z.infer<typeof repositoryGetIssuePayloadSchema>;
export type RepositoryStartMissionFromIssuePayload = z.infer<typeof repositoryStartMissionFromIssuePayloadSchema>;
export type RepositoryStartMissionFromBriefPayload = z.infer<typeof repositoryStartMissionFromBriefPayloadSchema>;
export type RepositorySnapshot = z.infer<typeof repositorySnapshotSchema>;
export type GitHubIssueDetail = z.infer<typeof githubIssueDetailSchema>;
export type TrackedIssueSummary = z.infer<typeof trackedIssueSummarySchema>;
export type RepositoryMissionStartAcknowledgement = z.infer<typeof repositoryMissionStartAcknowledgementSchema>;
export type RepositoryRemoveAcknowledgement = z.infer<typeof repositoryRemoveAcknowledgementSchema>;

export function createDefaultRepositoryConfiguration(): Pick<RepositoryData, 'settings' | 'workflowConfiguration' | 'isInitialized'> {
    const settings = createDefaultRepositorySettings();
    return {
        settings,
        workflowConfiguration: createDefaultWorkflowSettings(),
        isInitialized: false
    };
}

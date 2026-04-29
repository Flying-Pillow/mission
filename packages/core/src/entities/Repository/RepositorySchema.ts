import { z } from 'zod/v4';
import { WorkflowGlobalSettingsSchema } from '../../workflow/WorkflowSchema.js';
import { createDefaultWorkflowSettings } from '../../workflow/mission/workflow.js';
import {
    missionEntityTypeSchema,
    missionSnapshotSchema
} from '../Mission/MissionSchema.js';
import {
    entityCommandAcknowledgementSchema,
    entityIdSchema
} from '../Entity/EntitySchema.js';

export const repositoryWorkflowConfigurationSchema = WorkflowGlobalSettingsSchema;

export const repositoryEntityName = 'Repository' as const;

const defaultMissionsRoot = 'missions';

const airportPaneIdSchema = z.enum(['tower', 'briefingRoom', 'runway']);
const paneTargetKindSchema = z.enum([
    'empty',
    'repository',
    'mission',
    'task',
    'artifact',
    'agentSession'
]);
const paneModeSchema = z.enum(['view', 'control']);

const paneBindingSchema = z.object({
    targetKind: paneTargetKindSchema,
    targetId: z.string().trim().min(1).optional(),
    mode: paneModeSchema.optional()
}).strict();

const repositoryAirportIntentSchema = z.object({
    panes: z.object({
        briefingRoom: paneBindingSchema.optional(),
        runway: paneBindingSchema.optional()
    }).strict().optional(),
    focus: z.object({
        intentPaneId: airportPaneIdSchema.optional()
    }).strict().optional()
}).strict();

export const RepositorySettingsSchema = z.object({
    missionsRoot: z.string().trim().min(1),
    trackingProvider: z.literal('github'),
    instructionsPath: z.string().trim().min(1),
    skillsPath: z.string().trim().min(1),
    agentRunner: z.enum(['copilot-cli', 'pi']),
    defaultAgentMode: z.enum(['interactive', 'autonomous']).optional(),
    defaultModel: z.string().trim().min(1).optional(),
    airport: repositoryAirportIntentSchema.optional()
}).strict();

export type RepositorySettings = z.infer<typeof RepositorySettingsSchema>;
export type MissionAgentRunner = 'copilot-cli' | 'pi';
export type MissionDefaultAgentMode = 'interactive' | 'autonomous';

const defaultRepositorySettings: RepositorySettings = {
    missionsRoot: defaultMissionsRoot,
    trackingProvider: 'github',
    instructionsPath: '.agents',
    skillsPath: '.agents/skills',
    agentRunner: 'copilot-cli'
};

export function createDefaultRepositorySettings(): RepositorySettings {
    return structuredClone(defaultRepositorySettings);
}

export const repositoryInputSchema = z.object({
    repositoryRootPath: z.string().trim().min(1),
    githubRepository: z.string().trim().min(1).optional(),
    settings: RepositorySettingsSchema.optional(),
    workflowConfiguration: repositoryWorkflowConfigurationSchema.optional(),
    isInitialized: z.boolean().optional()
}).strict();

export const repositoryStorageSchema = z.object({
    id: entityIdSchema,
    repositoryRootPath: z.string().trim().min(1),
    ownerId: z.string().trim().min(1),
    repoName: z.string().trim().min(1),
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
    id: entityIdSchema,
    repositoryRootPath: z.string().trim().min(1).optional()
}).strict();

export const repositoryFindPayloadSchema = z.object({}).strict();

export const repositoryLocalAddInputSchema = z.object({
    repositoryPath: z.string().trim().min(1)
}).strict();

export const repositoryGitHubCheckoutInputSchema = z.object({
    githubRepository: z.string().trim().min(1),
    destinationPath: z.string().trim().min(1)
}).strict();

export const repositoryAddPayloadSchema = z.union([
    repositoryLocalAddInputSchema,
    repositoryGitHubCheckoutInputSchema
]);

export const repositoryRemovePayloadSchema = repositoryIdentityPayloadSchema;

export const repositoryReadPayloadSchema = repositoryIdentityPayloadSchema;

export const repositoryPreparePayloadSchema = repositoryIdentityPayloadSchema;

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

export const repositoryPrepareResultSchema = z.object({
    kind: z.literal('repository-bootstrap'),
    state: z.literal('pull-request-opened'),
    branchRef: z.string().trim().min(1),
    baseBranch: z.string().trim().min(1),
    pullRequestUrl: z.string().trim().min(1),
    controlDirectoryPath: z.string().trim().min(1),
    settingsPath: z.string().trim().min(1),
    worktreesPath: z.string().trim().min(1),
    missionsPath: z.string().trim().min(1)
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
    prepare: repositoryPreparePayloadSchema,
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
    prepare: repositoryPrepareResultSchema,
    startMissionFromIssue: repositoryMissionStartAcknowledgementSchema,
    startMissionFromBrief: repositoryMissionStartAcknowledgementSchema
} as const;

export type RepositoryInput = z.infer<typeof repositoryInputSchema>;
export type RepositoryStorage = z.infer<typeof repositoryStorageSchema>;
export type RepositoryData = z.infer<typeof repositoryDataSchema>;
export type MissionReference = z.infer<typeof missionReferenceSchema>;
export type RepositoryFindPayload = z.infer<typeof repositoryFindPayloadSchema>;
export type RepositoryAddPayload = z.infer<typeof repositoryAddPayloadSchema>;
export type RepositoryRemovePayload = z.infer<typeof repositoryRemovePayloadSchema>;
export type RepositoryPreparePayload = z.infer<typeof repositoryPreparePayloadSchema>;
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
export type RepositoryPrepareResult = z.infer<typeof repositoryPrepareResultSchema>;

export function createDefaultRepositoryConfiguration(): Pick<RepositoryData, 'settings' | 'workflowConfiguration' | 'isInitialized'> {
    const settings = createDefaultRepositorySettings();
    return {
        settings,
        workflowConfiguration: createDefaultWorkflowSettings(),
        isInitialized: false
    };
}

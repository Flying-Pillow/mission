import { z } from 'zod/v4';
import { repositorySnapshotSchema } from '../Repository/RepositorySchema.js';

export const gitHubRepositoryEntityName = 'GitHubRepository' as const;

export const githubVisibleRepositorySchema = z.object({
    fullName: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    topics: z.array(z.string().trim().min(1)),
    homepageUrl: z.string().trim().url().nullable().optional(),
    license: z.object({
        key: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).optional(),
        spdxId: z.string().trim().min(1).optional(),
        url: z.string().trim().url().nullable().optional()
    }).strict().nullable().optional(),
    ownerLogin: z.string().trim().min(1).optional(),
    ownerType: z.string().trim().min(1).optional(),
    ownerUrl: z.string().trim().url().optional(),
    htmlUrl: z.string().trim().url().optional(),
    visibility: z.enum(['private', 'public', 'internal']),
    defaultBranch: z.string().trim().min(1).optional(),
    archived: z.boolean(),
    starsCount: z.number().int().nonnegative().optional(),
    forksCount: z.number().int().nonnegative().optional(),
    watchersCount: z.number().int().nonnegative().optional(),
    subscribersCount: z.number().int().nonnegative().optional(),
    openIssuesCount: z.number().int().nonnegative().optional(),
    openPullRequestsCount: z.number().int().nonnegative().optional(),
    closedIssuesCount: z.number().int().nonnegative().optional(),
    commitsCount: z.number().int().nonnegative().optional(),
    releasesCount: z.number().int().nonnegative().optional(),
    workflowRunsCount: z.number().int().nonnegative().optional(),
    createdAt: z.string().trim().min(1).optional(),
    updatedAt: z.string().trim().min(1).optional(),
    pushedAt: z.string().trim().min(1).optional()
}).strict();

export const gitHubRepositoryFindPayloadSchema = z.object({}).strict();

export const gitHubRepositoryClonePayloadSchema = z.object({
    githubRepository: z.string().trim().min(1),
    destinationPath: z.string().trim().min(1)
}).strict();

export const gitHubRepositoryRemoteQueryResultSchemas = {
    find: z.array(githubVisibleRepositorySchema)
} as const;

export const gitHubRepositoryRemoteCommandResultSchemas = {
    clone: repositorySnapshotSchema
} as const;

export type GitHubRepositoryFindPayload = z.infer<typeof gitHubRepositoryFindPayloadSchema>;
export type GitHubRepositoryClonePayload = z.infer<typeof gitHubRepositoryClonePayloadSchema>;
export type GitHubVisibleRepositorySummary = z.infer<typeof githubVisibleRepositorySchema>;
export type GitHubVisibleRepository = GitHubVisibleRepositorySummary;
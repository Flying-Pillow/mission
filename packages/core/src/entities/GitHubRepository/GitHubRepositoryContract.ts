import { z } from 'zod/v4';
import type { EntityContract } from '../Entity/EntityContract.js';
import { repositorySnapshotSchema } from '../Repository/RepositoryContract.js';

export const gitHubRepositoryEntityName = 'GitHubRepository' as const;

export const githubVisibleRepositorySchema = z.object({
    fullName: z.string().trim().min(1),
    ownerLogin: z.string().trim().min(1).optional(),
    htmlUrl: z.string().trim().url().optional(),
    visibility: z.enum(['private', 'public']),
    archived: z.boolean()
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
export type GitHubVisibleRepository = z.infer<typeof githubVisibleRepositorySchema>;

type GitHubRepositoryEntity = typeof import('./GitHubRepository.js')['GitHubRepository'];

export const gitHubRepositoryEntityContract: EntityContract = {
    entity: gitHubRepositoryEntityName,
    queries: {
        find: {
            payload: gitHubRepositoryFindPayloadSchema,
            result: z.array(githubVisibleRepositorySchema),
            execute: async (payload, context) => (await loadGitHubRepositoryEntity()).find(payload, context)
        }
    },
    commands: {
        clone: {
            payload: gitHubRepositoryClonePayloadSchema,
            result: repositorySnapshotSchema,
            execute: async (payload, context) => (await loadGitHubRepositoryEntity()).clone(payload, context)
        }
    }
};

async function loadGitHubRepositoryEntity(): Promise<GitHubRepositoryEntity> {
    return (await import(/* @vite-ignore */ './GitHubRepository.js')).GitHubRepository;
}
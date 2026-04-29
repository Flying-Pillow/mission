import { z } from 'zod/v4';
import type { EntitySchema } from '../Entity/EntitySchema.js';
import {
    gitHubRepositoryClonePayloadSchema,
    gitHubRepositoryEntityName,
    gitHubRepositoryFindPayloadSchema,
    githubVisibleRepositorySchema
} from './GitHubRepositorySchema.js';
import { repositorySnapshotSchema } from '../Repository/RepositorySchema.js';

type GitHubRepositoryEntity = typeof import('./GitHubRepository.js')['GitHubRepository'];

export const gitHubRepositoryEntityContract: EntitySchema = {
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
    return (await import('./GitHubRepository.js')).GitHubRepository;
}
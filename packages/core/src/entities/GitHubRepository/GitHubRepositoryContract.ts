import { z } from 'zod/v4';
import type { EntitySchema } from '../Entity/EntitySchema.js';
import { GitHubRepository } from './GitHubRepository.js';
import {
    gitHubRepositoryClonePayloadSchema,
    gitHubRepositoryEntityName,
    gitHubRepositoryFindPayloadSchema,
    githubVisibleRepositorySchema
} from './GitHubRepositorySchema.js';
import { repositorySnapshotSchema } from '../Repository/RepositorySchema.js';

export const gitHubRepositoryEntityContract: EntitySchema = {
    entity: gitHubRepositoryEntityName,
    entityClass: GitHubRepository,
    methods: {
        find: {
            kind: 'query',
            payload: gitHubRepositoryFindPayloadSchema,
            result: z.array(githubVisibleRepositorySchema),
            execution: 'class'
        },
        clone: {
            kind: 'mutation',
            payload: gitHubRepositoryClonePayloadSchema,
            result: repositorySnapshotSchema,
            execution: 'class'
        }
    }
};
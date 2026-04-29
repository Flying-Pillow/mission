import type { EntitySchema } from '../Entity/EntitySchema.js';
import { Repository } from './Repository.js';
import {
    githubIssueDetailSchema,
    repositoryAddPayloadSchema,
    repositoryDataSchema,
    repositoryEntityName,
    repositoryFindPayloadSchema,
    repositoryGetIssuePayloadSchema,
    repositoryListIssuesPayloadSchema,
    repositoryMissionStartAcknowledgementSchema,
    repositoryPreparePayloadSchema,
    repositoryPrepareResultSchema,
    repositoryRemoveAcknowledgementSchema,
    repositoryRemovePayloadSchema,
    repositoryReadPayloadSchema,
    repositorySnapshotSchema,
    repositoryStartMissionFromBriefPayloadSchema,
    repositoryStartMissionFromIssuePayloadSchema,
    trackedIssueSummarySchema
} from './RepositorySchema.js';

export const repositoryContract: EntitySchema = {
    entity: repositoryEntityName,
    entityClass: Repository,
    properties: Object.fromEntries(
        Object.entries(repositoryDataSchema.shape).map(([name, schema]) => [
            name,
            {
                schema,
                readonly: true
            }
        ])
    ),
    methods: {
        find: {
            kind: 'query',
            payload: repositoryFindPayloadSchema,
            result: repositorySnapshotSchema.array(),
            execution: 'class'
        },
        read: {
            kind: 'query',
            payload: repositoryReadPayloadSchema,
            result: repositorySnapshotSchema,
            execution: 'entity'
        },
        listIssues: {
            kind: 'query',
            payload: repositoryListIssuesPayloadSchema,
            result: trackedIssueSummarySchema.array(),
            execution: 'entity'
        },
        getIssue: {
            kind: 'query',
            payload: repositoryGetIssuePayloadSchema,
            result: githubIssueDetailSchema,
            execution: 'entity'
        },
        add: {
            kind: 'mutation',
            payload: repositoryAddPayloadSchema,
            result: repositorySnapshotSchema,
            execution: 'class',
            ui: {
                label: 'Add Repository',
                iconHint: 'folder-plus',
                presentationOrder: 0
            }
        },
        remove: {
            kind: 'mutation',
            payload: repositoryRemovePayloadSchema,
            result: repositoryRemoveAcknowledgementSchema,
            execution: 'entity',
            ui: {
                label: 'Remove Repository',
                variant: 'destructive',
                iconHint: 'trash-2',
                presentationOrder: 90
            }
        },
        prepare: {
            kind: 'mutation',
            payload: repositoryPreparePayloadSchema,
            result: repositoryPrepareResultSchema,
            execution: 'entity',
            ui: {
                label: 'Prepare Repository',
                iconHint: 'git-pull-request-create',
                presentationOrder: 5
            }
        },
        startMissionFromIssue: {
            kind: 'mutation',
            payload: repositoryStartMissionFromIssuePayloadSchema,
            result: repositoryMissionStartAcknowledgementSchema,
            execution: 'entity',
            ui: {
                label: 'Start Mission From Issue',
                iconHint: 'circle-play',
                presentationOrder: 10
            }
        },
        startMissionFromBrief: {
            kind: 'mutation',
            payload: repositoryStartMissionFromBriefPayloadSchema,
            result: repositoryMissionStartAcknowledgementSchema,
            execution: 'entity',
            ui: {
                label: 'Start Mission From Brief',
                iconHint: 'file-plus-2',
                presentationOrder: 20
            }
        }
    },
    events: {
        missionStarted: {
            payload: repositoryMissionStartAcknowledgementSchema
        }
    }
};
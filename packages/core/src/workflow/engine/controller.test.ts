import { describe, expect, it } from 'vitest';
import type { MissionDescriptor } from '../../types.js';
import type { FilesystemAdapter } from '../../lib/FilesystemAdapter.js';
import {
    createMissionWorkflowConfigurationSnapshot,
    createMissionRuntimeRecord,
    ingestMissionWorkflowEvent,
    MissionWorkflowController,
    type MissionRuntimeRecord,
    type MissionWorkflowEvent
} from './index.js';
import { DEFAULT_WORKFLOW_VERSION, createDefaultWorkflowSettings } from './defaultWorkflow.js';
import type { MissionWorkflowRequestExecutor } from './requestExecutor.js';

describe('MissionWorkflowController', () => {
    it('executes machine-emitted generation requests while creating a mission runtime record', async () => {
        const adapter = createAdapter();
        const executor = createRequestExecutor();
        const controller = new MissionWorkflowController({
            adapter,
            descriptor: createDescriptor(),
            workflow: createDefaultWorkflowSettings(),
            requestExecutor: executor
        });

        const document = await controller.startFromDraft({
            occurredAt: '2026-04-14T09:00:00.000Z',
            source: 'human',
            startMission: false
        });

        expect(adapter.getPersistedDocument()?.eventLog.map((event) => event.type)).toEqual([
            'mission.created',
            'tasks.generated'
        ]);
        expect(document.runtime.tasks).toContainEqual(expect.objectContaining({
            taskId: 'prd/01',
            stageId: 'prd'
        }));
        expect(executor.getExecutedRequestTypes()).toEqual(['tasks.request-generation']);
    });

    it('replays machine-derived generation requests during refresh recovery', async () => {
        const adapter = createAdapter();
        const configuration = createMissionWorkflowConfigurationSnapshot({
            createdAt: '2026-04-14T09:00:00.000Z',
            workflowVersion: DEFAULT_WORKFLOW_VERSION,
            workflow: createDefaultWorkflowSettings()
        });
        adapter.setPersistedDocument(
            ingestMissionWorkflowEvent(
                createMissionRuntimeRecord({
                    missionId: 'mission-42',
                    configuration,
                    createdAt: configuration.createdAt
                }),
                {
                    eventId: 'mission-42:mission-created',
                    type: 'mission.created',
                    occurredAt: '2026-04-14T09:00:00.000Z',
                    source: 'human'
                }
            ).document
        );

        const executor = createRequestExecutor();
        const controller = new MissionWorkflowController({
            adapter,
            descriptor: createDescriptor(),
            workflow: createDefaultWorkflowSettings(),
            requestExecutor: executor
        });

        const document = await controller.refresh();

        expect(document?.runtime.tasks).toContainEqual(expect.objectContaining({
            taskId: 'prd/01',
            stageId: 'prd'
        }));
        expect(executor.getExecutedRequestTypes()).toEqual(['tasks.request-generation']);
    });
});

function createDescriptor(): MissionDescriptor {
    return {
        missionId: 'mission-42',
        missionDir: '/tmp/mission-42',
        branchRef: 'mission/42-first-class-state-machine',
        createdAt: '2026-04-14T09:00:00.000Z',
        brief: {
            title: 'State machine cleanup',
            body: 'Remove duplicated workflow rules.',
            type: 'refactor'
        }
    } as MissionDescriptor;
}

function createAdapter() {
    let persisted: MissionRuntimeRecord | undefined;

    return {
        readMissionRuntimeRecord: async () => persisted,
        writeMissionRuntimeRecord: async (_missionDir: string, document: MissionRuntimeRecord) => {
            persisted = document;
        },
        getPersistedDocument: () => persisted,
        setPersistedDocument: (document: MissionRuntimeRecord | undefined) => {
            persisted = document;
        }
    } as unknown as FilesystemAdapter & {
        getPersistedDocument(): MissionRuntimeRecord | undefined;
        setPersistedDocument(document: MissionRuntimeRecord | undefined): void;
    };
}

function createRequestExecutor() {
    const executedRequestTypes: string[] = [];

    return {
        executeRequests: async (input: { requests: Array<{ type: string }> }) => {
            executedRequestTypes.push(...input.requests.map((request) => request.type));
            return input.requests.flatMap((request) =>
                request.type === 'tasks.request-generation'
                    ? [createGeneratedTasksEvent('prd', '2026-04-14T09:00:01.000Z')]
                    : []
            );
        },
        normalizePersistedSessionIdentity: <T>(session: T) => session,
        reconcileSessions: async () => [],
        listRuntimeSessions: () => [],
        getRuntimeSession: () => undefined,
        attachSession: async () => {
            throw new Error('not implemented for test');
        },
        startSession: async () => {
            throw new Error('not implemented for test');
        },
        cancelRuntimeSession: async () => [],
        promptRuntimeSession: async () => [],
        commandRuntimeSession: async () => [],
        terminateRuntimeSession: async () => [],
        getExecutedRequestTypes: () => executedRequestTypes
    } as unknown as MissionWorkflowRequestExecutor & {
        getExecutedRequestTypes(): string[];
    };
}

function createGeneratedTasksEvent(stageId: string, occurredAt: string): MissionWorkflowEvent {
    return {
        eventId: `tasks.generated:${stageId}:${occurredAt}`,
        type: 'tasks.generated',
        occurredAt,
        source: 'daemon',
        stageId,
        tasks: [{
            taskId: 'prd/01',
            title: 'Draft PRD',
            instruction: 'Draft the PRD.',
            dependsOn: []
        }]
    };
}
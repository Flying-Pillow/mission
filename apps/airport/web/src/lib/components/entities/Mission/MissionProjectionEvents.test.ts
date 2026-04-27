import { describe, expect, it } from 'vitest';
import { Mission } from './Mission.svelte.js';
import type {
    AgentSessionCommandAcknowledgement,
    ArtifactCommandAcknowledgement,
    MissionAgentSessionSnapshot,
    MissionArtifactSnapshot,
    MissionActionListSnapshot,
    MissionCommandAcknowledgement,
    MissionSnapshot,
    MissionStageSnapshot,
    MissionTaskSnapshot,
    StageCommandAcknowledgement,
    TaskCommandAcknowledgement
} from '@flying-pillow/mission-core/entities';
import type { MissionChildEntityCommandGateway, MissionCommandGateway } from './Mission.svelte.js';

describe('Mission projection reconciliation', () => {
    it('reconciles targeted child entity snapshots without replacing unrelated mirrors', () => {
        const mission = new Mission(createMissionSnapshot(), async () => createMissionSnapshot());
        mission.setRouteState({
            projectionSnapshot: {
                missionId: 'mission-29',
                status: {
                    missionId: 'mission-29',
                    title: 'Mission 29',
                    artifacts: [createArtifactSnapshot('verify', 'VERIFY.md')],
                    workflow: {
                        lifecycle: 'running',
                        currentStageId: 'implementation',
                        stages: [createStageSnapshot({
                            lifecycle: 'running',
                            tasks: [
                                createTaskSnapshot('task-1', 'ready'),
                                createTaskSnapshot('task-2', 'pending')
                            ]
                        })]
                    }
                },
                workflow: {
                    lifecycle: 'running',
                    currentStageId: 'implementation',
                    stages: [createStageSnapshot({
                        lifecycle: 'running',
                        tasks: [
                            createTaskSnapshot('task-1', 'ready'),
                            createTaskSnapshot('task-2', 'pending')
                        ]
                    })]
                },
                updatedAt: '2026-04-26T15:00:00.000Z'
            }
        });

        mission.applyTaskSnapshot(createTaskSnapshot('task-1', 'completed'));
        mission.applyArtifactSnapshot(createArtifactSnapshot('verify', 'Verification Evidence'));
        mission.applyAgentSessionSnapshot(createSessionSnapshot('session-1', 'completed'));

        expect(mission.getTask('task-1')?.lifecycle).toBe('completed');
        expect(mission.getTask('task-2')?.lifecycle).toBe('pending');
        expect(mission.getArtifact('VERIFY.md')?.label).toBe('Verification Evidence');
        expect(mission.getSession('session-1')?.lifecycleState).toBe('completed');
    });

    it('reconciles Stage snapshots as authoritative stage child projections', () => {
        const mission = new Mission(createMissionSnapshot(), async () => createMissionSnapshot());

        mission.applyStageSnapshot(createStageSnapshot({
            lifecycle: 'completed',
            tasks: [createTaskSnapshot('task-1', 'completed')]
        }));

        expect(mission.getStage('implementation')?.lifecycle).toBe('completed');
        expect(mission.getTask('task-1')?.lifecycle).toBe('completed');
        expect(mission.getTask('task-2')).toBeUndefined();
    });

    it('exposes Mission entity commands from the entity snapshot', () => {
        const mission = new Mission(
            {
                ...createMissionSnapshot(),
                mission: {
                    ...createMissionSnapshot().mission,
                    commands: [{ commandId: 'mission.pause', label: 'Pause Mission', disabled: false }]
                }
            },
            async () => createMissionSnapshot()
        );

        expect(mission.commands).toEqual([
            {
                commandId: 'mission.pause',
                label: 'Pause Mission',
                disabled: false
            }
        ]);
    });

    it('reads a preselected placeholder artifact with the reconciled artifact id', async () => {
        const readArtifactDocumentCalls: string[] = [];
        const mission = new Mission(
            createMissionSnapshot(),
            async () => createMissionSnapshot(),
            createMissionCommandGateway({ missionId: 'mission-29', actions: [] }),
            createChildEntityCommandGateway(readArtifactDocumentCalls)
        );
        const placeholderArtifact = mission.resolveArtifact({
            filePath: 'PRD.md',
            label: 'Requirements',
            stageId: 'prd'
        });

        mission.applyArtifactSnapshot({
            artifactId: 'mission-29:prd',
            kind: 'stage',
            label: 'Requirements',
            fileName: 'PRD.md',
            relativePath: 'PRD.md',
            stageId: 'prd'
        });

        await placeholderArtifact.read({ executionContext: 'render' });

        expect(readArtifactDocumentCalls).toEqual(['mission-29:prd']);
    });
});

function createMissionCommandGateway(actions: MissionActionListSnapshot): MissionCommandGateway {
    return {
        pauseMission: async () => createMissionAcknowledgement('command'),
        resumeMission: async () => createMissionAcknowledgement('command'),
        panicMission: async () => createMissionAcknowledgement('command'),
        clearMissionPanic: async () => createMissionAcknowledgement('command'),
        restartMissionQueue: async () => createMissionAcknowledgement('command'),
        deliverMission: async () => createMissionAcknowledgement('command'),
        getMissionProjection: async () => ({
            missionId: 'mission-29'
        }),
        getMissionActions: async () => actions,
        executeMissionAction: async () => createMissionAcknowledgement('executeAction'),
        readMissionDocument: async () => ({
            filePath: '/repo/root/README.md',
            content: ''
        }),
        writeMissionDocument: async () => ({
            filePath: '/repo/root/README.md',
            content: ''
        }),
        getMissionWorktree: async () => ({
            rootPath: '/repo/root',
            fetchedAt: '2026-04-27T00:00:00.000Z',
            tree: []
        })
    };
}

function createChildEntityCommandGateway(readArtifactDocumentCalls: string[]): MissionChildEntityCommandGateway {
    return {
        executeStageCommand: async () => createStageAcknowledgement(),
        executeTaskCommand: async () => createTaskAcknowledgement(),
        executeArtifactCommand: async () => createArtifactAcknowledgement(),
        executeAgentSessionCommand: async () => createAgentSessionAcknowledgement('executeCommand'),
        sendAgentSessionPrompt: async () => createAgentSessionAcknowledgement('sendPrompt'),
        sendAgentSessionCommand: async () => createAgentSessionAcknowledgement('sendCommand'),
        readArtifactDocument: async (input) => {
            readArtifactDocumentCalls.push(input.artifactId);
            return {
                filePath: 'PRD.md',
                content: '# PRD'
            };
        },
        writeArtifactDocument: async () => ({
            filePath: 'PRD.md',
            content: '# PRD'
        })
    };
}

function createStageAcknowledgement(): StageCommandAcknowledgement {
    return {
        ok: true,
        entity: 'Stage',
        method: 'executeCommand',
        id: 'stage-1',
        missionId: 'mission-29',
        stageId: 'stage-1',
        commandId: 'stage.generateTasks'
    };
}

function createTaskAcknowledgement(): TaskCommandAcknowledgement {
    return {
        ok: true,
        entity: 'Task',
        method: 'executeCommand',
        id: 'task-1',
        missionId: 'mission-29',
        taskId: 'task-1',
        commandId: 'task.start'
    };
}

function createArtifactAcknowledgement(): ArtifactCommandAcknowledgement {
    return {
        ok: true,
        entity: 'Artifact',
        method: 'executeCommand',
        id: 'artifact-1',
        missionId: 'mission-29',
        artifactId: 'artifact-1',
        commandId: 'artifact.review'
    };
}

function createAgentSessionAcknowledgement(method: AgentSessionCommandAcknowledgement['method']): AgentSessionCommandAcknowledgement {
    return {
        ok: true,
        entity: 'AgentSession',
        method,
        id: 'session-1',
        missionId: 'mission-29',
        sessionId: 'session-1',
        ...(method === 'executeCommand' ? { commandId: 'agentSession.cancel' } : {})
    };
}

function createMissionAcknowledgement(method: MissionCommandAcknowledgement['method']): MissionCommandAcknowledgement {
    return {
        ok: true,
        entity: 'Mission',
        method,
        id: 'mission-29',
        missionId: 'mission-29'
    };
}

function createMissionSnapshot(): MissionSnapshot {
    const stages = [createStageSnapshot({
        lifecycle: 'running',
        tasks: [
            createTaskSnapshot('task-1', 'ready'),
            createTaskSnapshot('task-2', 'pending')
        ]
    })];
    return {
        mission: {
            missionId: 'mission-29',
            title: 'Mission 29',
            artifacts: [createArtifactSnapshot('verify', 'VERIFY.md')],
            stages,
            agentSessions: [createSessionSnapshot('session-1', 'running')]
        },
        status: {
            missionId: 'mission-29',
            title: 'Mission 29',
            artifacts: [createArtifactSnapshot('verify', 'VERIFY.md')],
            workflow: {
                lifecycle: 'running',
                currentStageId: 'implementation',
                stages
            }
        },
        workflow: {
            lifecycle: 'running',
            currentStageId: 'implementation',
            stages
        },
        stages,
        tasks: stages.flatMap((stage) => stage.tasks),
        artifacts: [createArtifactSnapshot('verify', 'VERIFY.md')],
        agentSessions: [createSessionSnapshot('session-1', 'running')]
    };
}

function createStageSnapshot(input: {
    lifecycle: string;
    tasks: MissionTaskSnapshot[];
}): MissionStageSnapshot {
    return {
        stageId: 'implementation',
        lifecycle: input.lifecycle,
        isCurrentStage: true,
        artifacts: [createArtifactSnapshot('verify', 'VERIFY.md')],
        tasks: input.tasks
    };
}

function createTaskSnapshot(taskId: string, lifecycle: string): MissionTaskSnapshot {
    return {
        taskId,
        stageId: 'implementation',
        sequence: taskId === 'task-1' ? 1 : 2,
        title: taskId === 'task-1' ? 'Task One' : 'Task Two',
        instruction: 'Do the work.',
        lifecycle,
        dependsOn: [],
        waitingOnTaskIds: [],
        agentRunner: 'copilot-cli',
        retries: 0
    };
}

function createArtifactSnapshot(artifactId: string, label: string): MissionArtifactSnapshot {
    return {
        artifactId,
        kind: 'mission',
        label,
        fileName: 'VERIFY.md',
        relativePath: 'VERIFY.md'
    };
}

function createSessionSnapshot(
    sessionId: string,
    lifecycleState: MissionAgentSessionSnapshot['lifecycleState']
): MissionAgentSessionSnapshot {
    return {
        sessionId,
        runnerId: 'copilot-cli',
        runnerLabel: 'Copilot CLI',
        lifecycleState
    };
}

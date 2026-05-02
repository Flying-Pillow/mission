import { describe, expect, it } from 'vitest';
import { MissionContract } from './MissionContract.js';
import { MissionDataSchema, MissionSnapshotSchema } from './MissionSchema.js';
import { AgentSessionDataSchema } from '../AgentSession/AgentSessionSchema.js';
import { ArtifactDataSchema } from '../Artifact/ArtifactSchema.js';
import { StageDataSchema } from '../Stage/StageSchema.js';
import { TaskDataSchema } from '../Task/TaskSchema.js';

const artifact = ArtifactDataSchema.parse({
    id: 'artifact:mission-1/mission:brief',
    kind: 'mission',
    label: 'Brief',
    fileName: 'BRIEF.md',
    key: 'brief',
    relativePath: 'BRIEF.md'
});

const task = TaskDataSchema.parse({
    id: 'task:mission-1/implementation/01',
    taskId: 'implementation/01',
    stageId: 'implementation',
    sequence: 1,
    title: 'Implement task',
    instruction: 'Ship it.',
    lifecycle: 'ready',
    dependsOn: [],
    waitingOnTaskIds: [],
    agentRunner: 'copilot-cli',
    retries: 0,
    fileName: '01.md',
    relativePath: 'implementation/tasks/01.md'
});

const stage = StageDataSchema.parse({
    id: 'stage:mission-1/implementation',
    stageId: 'implementation',
    lifecycle: 'ready',
    isCurrentStage: true,
    artifacts: [],
    tasks: [task]
});

const agentSession = AgentSessionDataSchema.parse({
    id: 'agent_session:mission-1/session-1',
    sessionId: 'session-1',
    runnerId: 'copilot-cli',
    transportId: 'terminal',
    runnerLabel: 'Copilot CLI',
    lifecycleState: 'running',
    terminalHandle: {
        sessionName: 'mission-agent-session',
        paneId: 'terminal_1'
    },
    taskId: 'implementation/01',
    context: {
        artifacts: [],
        instructions: []
    },
    runtimeMessages: []
});

const missionData = {
    id: 'mission:mission-1',
    missionId: 'mission-1',
    title: 'Mission entity strict schema',
    type: 'refactor',
    branchRef: 'mission/mission-1',
    missionDir: '/mission/.mission/missions/mission-1',
    missionRootDir: '/mission',
    lifecycle: 'running',
    currentStageId: 'implementation',
    artifacts: [artifact],
    stages: [stage],
    agentSessions: [agentSession]
};

describe('Mission schemas', () => {
    it('composes Mission data from the four child Entity schemas', () => {
        const parsed = MissionDataSchema.parse(missionData);

        expect(parsed.artifacts[0]).toEqual(artifact);
        expect(parsed.stages[0]).toEqual(stage);
        expect(parsed.stages[0]?.tasks[0]).toEqual(task);
        expect(parsed.agentSessions[0]).toEqual(agentSession);
    });

    it('rejects stale child AgentSession runtime terminal fields', () => {
        expect(() => MissionDataSchema.parse({
            ...missionData,
            agentSessions: [{
                ...agentSession,
                terminalSessionName: 'mission-agent-session'
            }]
        })).toThrow();
    });

    it('keeps Mission read as an aggregate snapshot contract', () => {
        const snapshot = MissionSnapshotSchema.parse({
            mission: missionData,
            stages: [stage],
            tasks: [task],
            artifacts: [artifact],
            agentSessions: [agentSession]
        });

        expect(MissionContract.methods?.read?.result).toBe(MissionSnapshotSchema);
        expect(snapshot.mission.missionId).toBe('mission-1');
    });
});

import { describe, expect, it } from 'vitest';
import { buildAgentExecutionSignalLaunchContext } from './AgentExecutionSignalLaunchContext.js';
import { createAgentExecutionProtocolDescriptor } from '../../../../entities/AgentExecution/AgentExecutionProtocolDescriptor.js';

describe('AgentExecutionSignalLaunchContext', () => {
    it('builds mandatory stdout marker instructions without transport env', () => {
        const context = buildAgentExecutionSignalLaunchContext({
            missionId: 'mission-31',
            taskId: 'task-6',
            agentExecutionId: 'session-1',
            protocolDescriptor: createAgentExecutionProtocolDescriptor({
                scope: {
                    kind: 'task',
                    missionId: 'mission-31',
                    taskId: 'task-6'
                },
                messages: []
            })
        });

        expect(context.launchEnv).toEqual({});
        expect(context.sessionInstructions).toContain('Agent execution structured interaction is mandatory');
        expect(context.sessionInstructions).toContain('task::');
        expect(context.sessionInstructions).toContain('missionId: mission-31');
        expect(context.sessionInstructions).toContain('taskId: task-6');
        expect(context.sessionInstructions).toContain('agentExecutionId: session-1');
        expect(context.sessionInstructions).toContain('progress: Progress');
    });
});
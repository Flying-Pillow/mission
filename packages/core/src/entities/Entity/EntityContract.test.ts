import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod/v4';
import { createEntityChannel } from './Entity.js';
import {
    agentSessionEntityReferenceSchema,
    agentSessionExecuteCommandPayloadSchema,
    agentSessionRemoteCommandPayloadSchemas,
    agentSessionRemoteQueryPayloadSchemas,
    missionAgentPromptSchema,
    missionAgentSessionSnapshotSchema
} from '../AgentSession/AgentSessionSchema.js';
import {
    artifactEntityReferenceSchema,
    artifactExecuteCommandPayloadSchema,
    artifactIdentityPayloadSchema,
    artifactRemoteCommandPayloadSchemas,
    artifactRemoteQueryPayloadSchemas,
    missionArtifactSnapshotSchema
} from '../Artifact/ArtifactSchema.js';
import {
    stageEntityReferenceSchema,
    stageExecuteCommandPayloadSchema,
    stageRemoteCommandPayloadSchemas,
    stageRemoteQueryPayloadSchemas,
    missionStageSnapshotSchema
} from '../Stage/StageSchema.js';
import {
    taskCommandAcknowledgementSchema,
    taskEntityReferenceSchema,
    taskExecuteCommandPayloadSchema,
    taskIdentityPayloadSchema,
    taskRemoteCommandPayloadSchemas,
    taskRemoteQueryPayloadSchemas,
    missionTaskSnapshotSchema
} from '../Task/TaskSchema.js';
import { missionChildEntityReferenceSchema } from '../Mission/MissionSchema.js';
import {
    entityCommandDescriptorSchema,
    entityEventEnvelopeSchema
} from './EntitySchema.js';

describe('child entity command contract schemas', () => {
    it('validates strict command descriptors with input and confirmation metadata', () => {
        const descriptor = entityCommandDescriptorSchema.parse({
            commandId: 'task.rework',
            label: 'Send Back',
            description: 'Return this task for corrective work.',
            disabled: false,
            variant: 'destructive',
            iconHint: 'undo-2',
            confirmation: {
                required: true,
                prompt: 'Send this task back?'
            },
            input: {
                kind: 'text',
                label: 'Reason',
                required: true,
                multiline: true
            },
            presentationOrder: 30
        });

        expect(descriptor.commandId).toBe('task.rework');
        expect(descriptor.confirmation?.required).toBe(true);

        expect(() => entityCommandDescriptorSchema.parse({
            commandId: 'task.rework',
            label: 'Send Back',
            scope: 'task'
        })).toThrow(ZodError);
    });

    it('validates addressed entity event envelopes without entity-specific payload unions', () => {
        const event = entityEventEnvelopeSchema.parse({
            eventId: 'event-1',
            entityId: 'mission:mission-29',
            channel: createEntityChannel('mission:mission-29', 'snapshot'),
            eventName: 'snapshot.changed',
            type: 'mission.snapshot.changed',
            occurredAt: '2026-04-26T15:00:00.000Z',
            missionId: 'mission-29',
            payload: {
                reference: {
                    entity: 'Mission',
                    missionId: 'mission-29'
                },
                snapshot: {
                    mission: {
                        missionId: 'mission-29',
                        artifacts: [],
                        stages: []
                    },
                    stages: [],
                    tasks: [],
                    artifacts: [],
                    agentSessions: []
                }
            }
        });

        expect(event.entityId).toBe('mission:mission-29');
        expect(event.eventName).toBe('snapshot.changed');
        expect(event.payload).toEqual(expect.objectContaining({ reference: expect.any(Object) }));
    });

    it('rejects unaddressed entity event envelopes', () => {
        expect(() => entityEventEnvelopeSchema.parse({
            eventId: 'event-2',
            type: 'mission.snapshot.changed',
            occurredAt: '2026-04-26T15:00:00.000Z',
            payload: {}
        })).toThrow(ZodError);
    });

    it('validates child entity references as typed references', () => {
        expect(stageEntityReferenceSchema.parse({
            entity: 'Stage',
            missionId: 'mission-29',
            stageId: 'implementation'
        })).toMatchObject({ entity: 'Stage' });

        expect(taskEntityReferenceSchema.parse({
            entity: 'Task',
            missionId: 'mission-29',
            taskId: 'implementation/13-create-child-entity-command-contracts'
        })).toMatchObject({ entity: 'Task' });

        expect(artifactEntityReferenceSchema.parse({
            entity: 'Artifact',
            missionId: 'mission-29',
            artifactId: '03-IMPLEMENTATION/VERIFY.md'
        })).toMatchObject({ entity: 'Artifact' });

        expect(agentSessionEntityReferenceSchema.parse({
            entity: 'AgentSession',
            missionId: 'mission-29',
            sessionId: 'session-1'
        })).toMatchObject({ entity: 'AgentSession' });

        expect(missionChildEntityReferenceSchema.parse({
            entity: 'Task',
            missionId: 'mission-29',
            taskId: 'implementation/13-create-child-entity-command-contracts'
        })).toMatchObject({ entity: 'Task' });
    });

    it('validates child snapshots from first-class child schema modules', () => {
        const task = missionTaskSnapshotSchema.parse({
            taskId: 'implementation/13-create-child-entity-command-contracts',
            stageId: 'implementation',
            sequence: 13,
            title: 'Create Child Entity Command Contracts',
            instruction: 'Split child schemas.',
            lifecycle: 'running',
            dependsOn: [],
            waitingOnTaskIds: [],
            agentRunner: 'copilot-cli',
            retries: 0,
            commands: [{ commandId: 'task.start', label: 'Start Ready Task', disabled: false }]
        });

        const artifact = missionArtifactSnapshotSchema.parse({
            artifactId: '03-IMPLEMENTATION/VERIFY.md',
            kind: 'mission',
            label: 'Verify',
            fileName: 'VERIFY.md',
            commands: []
        });

        expect(missionStageSnapshotSchema.parse({
            stageId: 'implementation',
            lifecycle: 'running',
            isCurrentStage: true,
            artifacts: [artifact],
            tasks: [task],
            commands: [{ commandId: 'stage.generateTasks', label: 'Generate Tasks', disabled: true }]
        })).toMatchObject({ stageId: 'implementation' });

        expect(missionAgentSessionSnapshotSchema.parse({
            sessionId: 'session-1',
            runnerId: 'copilot-cli',
            runnerLabel: 'Copilot CLI',
            lifecycleState: 'running',
            scope: {
                kind: 'slice',
                taskId: 'implementation/13-create-child-entity-command-contracts'
            },
            telemetry: {
                tokenUsage: {
                    input: 12,
                    output: 34,
                    total: 46
                }
            },
            failureMessage: 'terminal command exited with status 1.',
            commands: [{ commandId: 'agentSession.cancel', label: 'Cancel', disabled: false }]
        })).toMatchObject({ sessionId: 'session-1' });
    });

    it('keeps Task command payloads strict and free of actionbar filtering context', () => {
        const identity = taskIdentityPayloadSchema.parse({
            missionId: 'mission-29',
            taskId: 'implementation/13-create-child-entity-command-contracts'
        });

        expect(identity.taskId).toBe('implementation/13-create-child-entity-command-contracts');
        expect(taskExecuteCommandPayloadSchema.parse({
            ...identity,
            commandId: 'task.start',
            input: { terminalSessionName: 'task-13' }
        })).toMatchObject({ commandId: 'task.start' });

        expect(() => taskIdentityPayloadSchema.parse({
            ...identity,
            stageId: 'implementation'
        })).toThrow(ZodError);

        expect(() => taskExecuteCommandPayloadSchema.parse({
            ...identity,
            commandId: 'task.start',
            context: { scope: 'task', taskId: identity.taskId }
        })).toThrow(ZodError);
    });

    it('uses stable artifact identity instead of untyped artifact paths', () => {
        expect(artifactIdentityPayloadSchema.parse({
            missionId: 'mission-29',
            artifactId: '03-IMPLEMENTATION/VERIFY.md'
        })).toMatchObject({ artifactId: '03-IMPLEMENTATION/VERIFY.md' });

        expect(artifactExecuteCommandPayloadSchema.parse({
            missionId: 'mission-29',
            artifactId: '03-IMPLEMENTATION/VERIFY.md',
            commandId: 'artifact.review'
        })).toMatchObject({ commandId: 'artifact.review' });

        expect(() => artifactIdentityPayloadSchema.parse({
            missionId: 'mission-29',
            artifactPath: '03-IMPLEMENTATION/VERIFY.md'
        })).toThrow(ZodError);
    });

    it('validates child-specific command acknowledgement result schemas', () => {
        expect(taskCommandAcknowledgementSchema.parse({
            ok: true,
            entity: 'Task',
            method: 'executeCommand',
            id: 'implementation/13-create-child-entity-command-contracts',
            missionId: 'mission-29',
            taskId: 'implementation/13-create-child-entity-command-contracts',
            commandId: 'task.start'
        })).toMatchObject({ entity: 'Task', commandId: 'task.start' });
    });

    it('publishes child entity remote payload maps from the canonical schema surface', () => {
        expect(Object.keys(stageRemoteQueryPayloadSchemas)).toEqual(['read']);
        expect(stageRemoteCommandPayloadSchemas).toHaveProperty('executeCommand');
        expect(Object.keys(taskRemoteQueryPayloadSchemas)).toEqual(['read']);
        expect(taskRemoteCommandPayloadSchemas).toHaveProperty('executeCommand');
        expect(Object.keys(artifactRemoteQueryPayloadSchemas)).toEqual(['read', 'readDocument']);
        expect(artifactRemoteCommandPayloadSchemas).toHaveProperty('writeDocument');
        expect(Object.keys(agentSessionRemoteQueryPayloadSchemas)).toEqual(['read', 'readTerminal']);
        expect(agentSessionRemoteCommandPayloadSchemas).toHaveProperty('sendPrompt');
        expect(agentSessionRemoteCommandPayloadSchemas).toHaveProperty('sendTerminalInput');

        expect(stageExecuteCommandPayloadSchema.parse({
            missionId: 'mission-29',
            stageId: 'implementation',
            commandId: 'stage.generateTasks'
        })).toMatchObject({ commandId: 'stage.generateTasks' });

        expect(agentSessionExecuteCommandPayloadSchema.parse({
            missionId: 'mission-29',
            sessionId: 'session-1',
            commandId: 'session.cancel'
        })).toMatchObject({ commandId: 'session.cancel' });

        expect(missionAgentPromptSchema.parse({
            source: 'operator',
            text: 'Please continue.'
        })).toMatchObject({ source: 'operator' });
    });
});

// /apps/airport/web/src/lib/client/entities/Mission.svelte.ts: OO browser entity for a mission runtime snapshot and its live agent sessions.
import type { EntityCommandInvocation, EntityQueryInvocation, EntityRemoteResult } from '@flying-pillow/mission-core/daemon/protocol/entityRemote';
import {
    AgentSessionCommandAcknowledgementSchema,
    type AgentSessionCommandAcknowledgementType,
    type AgentSessionCommandType,
    type AgentSessionPromptType,
    type AgentSessionDataType
} from '@flying-pillow/mission-core/entities/AgentSession/AgentSessionSchema';
import {
    ArtifactBodySnapshotSchema,
    type ArtifactBodySnapshotType,
    type ArtifactBodyType,
    type ArtifactDataType
} from '@flying-pillow/mission-core/entities/Artifact/ArtifactSchema';
import type { EntityCommandDescriptorType } from '@flying-pillow/mission-core/entities/Entity/EntitySchema';
import {
    MissionCommandAcknowledgementSchema,
    MissionDocumentSnapshotSchema,
    MissionControlViewSnapshotSchema,
    MissionWorktreeSnapshotSchema,
    type MissionCommandAcknowledgementType,
    type MissionControlViewSnapshotType,
    type MissionDocumentSnapshotType,
    type MissionSnapshotType,
    type MissionStatusSnapshotType
} from '@flying-pillow/mission-core/entities/Mission/MissionSchema';
import {
    StageCommandAcknowledgementSchema,
    type StageDataType,
    type StageCommandAcknowledgementType
} from '@flying-pillow/mission-core/entities/Stage/StageSchema';
import {
    TaskCommandAcknowledgementSchema,
    type TaskDataType,
    type TaskCommandAcknowledgementType
} from '@flying-pillow/mission-core/entities/Task/TaskSchema';
import { AgentSession } from '$lib/components/entities/AgentSession/AgentSession.svelte.js';
import {
    Artifact,
    type ArtifactSnapshot
} from '$lib/components/entities/Artifact/Artifact.svelte.js';
import { EntityRegistry, type EntityModel } from '$lib/components/entities/shared/EntityModel.svelte.js';
import { Stage } from '$lib/components/entities/Stage/Stage.svelte.js';
import type { MissionFileTreeResponse } from '$lib/types/mission-file-tree';
import {
    Task,
    type TaskSnapshot
} from '$lib/components/entities/Task/Task.svelte.js';

export type MissionDataLoader = (missionId: string) => Promise<MissionSnapshotType>;
type MissionQueryExecutionContext = 'event' | 'render';
type EntityCommandExecutor = (input: EntityCommandInvocation) => Promise<EntityRemoteResult>;
type EntityQueryExecutor = (
    input: EntityQueryInvocation,
    context?: MissionQueryExecutionContext
) => Promise<EntityRemoteResult>;

export type MissionGatewayDependencies = {
    repositoryRootPath?: string;
    commandRemote: EntityCommandExecutor;
    queryRemote: EntityQueryExecutor;
};

type MissionCommandGateway = {
    executeMissionCommand(input: {
        missionId: string;
        commandId: string;
        input?: unknown;
    }): Promise<MissionCommandAcknowledgementType>;
    getMissionControlView(input: {
        missionId: string;
        executionContext?: MissionQueryExecutionContext;
    }): Promise<MissionControlViewSnapshotType>;
    readMissionDocument(input: {
        missionId: string;
        path: string;
        executionContext?: MissionQueryExecutionContext;
    }): Promise<MissionDocumentSnapshotType>;
    writeMissionDocument(input: {
        missionId: string;
        path: string;
        content: string;
    }): Promise<MissionDocumentSnapshotType>;
    getMissionWorktree(input: {
        missionId: string;
        executionContext?: MissionQueryExecutionContext;
    }): Promise<MissionFileTreeResponse>;
};

type MissionChildEntityCommandGateway = {
    executeStageCommand(input: {
        missionId: string;
        stageId: string;
        commandId: string;
        input?: unknown;
    }): Promise<StageCommandAcknowledgementType>;
    executeTaskCommand(input: {
        missionId: string;
        taskId: string;
        commandId: string;
        input?: unknown;
    }): Promise<TaskCommandAcknowledgementType>;
    executeAgentSessionCommand(input: {
        missionId: string;
        sessionId: string;
        commandId: string;
        input?: unknown;
    }): Promise<AgentSessionCommandAcknowledgementType>;
    sendAgentSessionPrompt(input: {
        missionId: string;
        sessionId: string;
        prompt: AgentSessionPromptType;
    }): Promise<AgentSessionCommandAcknowledgementType>;
    sendAgentSessionCommand(input: {
        missionId: string;
        sessionId: string;
        command: AgentSessionCommandType;
    }): Promise<AgentSessionCommandAcknowledgementType>;
    readArtifactDocument(input: {
        missionId: string;
        artifactId: string;
        executionContext?: MissionQueryExecutionContext;
    }): Promise<ArtifactBodySnapshotType>;
    writeArtifactDocument(input: {
        missionId: string;
        artifactId: string;
        body: ArtifactBodyType;
    }): Promise<ArtifactBodySnapshotType>;
};

export type MissionDependencies = {
    snapshot: MissionSnapshotType;
    loadData: MissionDataLoader;
    gatewayDependencies: MissionGatewayDependencies;
};

const missionEntityName = 'Mission';
const stageEntityName = 'Stage';
const taskEntityName = 'Task';
const artifactEntityName = 'Artifact';
const agentSessionEntityName = 'AgentSession';

function createMissionCommandGateway(input: MissionGatewayDependencies): MissionCommandGateway {
    const repositoryRootPath = input.repositoryRootPath?.trim() || undefined;
    const { commandRemote, queryRemote } = input;

    return {
        executeMissionCommand: async ({ missionId, commandId, input: commandInput }) => sendMissionCommand(commandRemote, {
            missionId,
            commandId,
            ...(commandInput !== undefined ? { input: commandInput } : {})
        }, repositoryRootPath),
        getMissionControlView: async ({ missionId, executionContext }) => {
            const normalizedMissionId = requireMissionId(missionId, 'Mission control view queries require a missionId.');
            return MissionControlViewSnapshotSchema.parse(await queryRemote({
                entity: missionEntityName,
                method: 'readControlView',
                payload: buildMissionPayload(normalizedMissionId, repositoryRootPath)
            }, executionContext));
        },
        readMissionDocument: async ({ missionId, path, executionContext }) => {
            const normalizedMissionId = requireMissionId(missionId, 'Mission document queries require missionId and path.');
            const normalizedPath = path.trim();
            if (!normalizedPath) {
                throw new Error('Mission document queries require missionId and path.');
            }

            return MissionDocumentSnapshotSchema.parse(await queryRemote({
                entity: missionEntityName,
                method: 'readDocument',
                payload: {
                    ...buildMissionPayload(normalizedMissionId, repositoryRootPath),
                    path: normalizedPath
                }
            }, executionContext));
        },
        writeMissionDocument: async ({ missionId, path, content }) => {
            const normalizedMissionId = requireMissionId(missionId, 'Mission document commands require missionId and path.');
            const normalizedPath = path.trim();
            if (!normalizedPath) {
                throw new Error('Mission document commands require missionId and path.');
            }

            return MissionDocumentSnapshotSchema.parse(await commandRemote({
                entity: missionEntityName,
                method: 'writeDocument',
                payload: {
                    ...buildMissionPayload(normalizedMissionId, repositoryRootPath),
                    path: normalizedPath,
                    content
                }
            }));
        },
        getMissionWorktree: async ({ missionId, executionContext }) => {
            const normalizedMissionId = requireMissionId(missionId, 'Mission worktree queries require a missionId.');
            return MissionWorktreeSnapshotSchema.parse(await queryRemote({
                entity: missionEntityName,
                method: 'readWorktree',
                payload: buildMissionPayload(normalizedMissionId, repositoryRootPath)
            }, executionContext));
        }
    };
}

function createMissionChildEntityCommandGateway(input: MissionGatewayDependencies): MissionChildEntityCommandGateway {
    const repositoryRootPath = input.repositoryRootPath?.trim() || undefined;
    const { commandRemote, queryRemote } = input;

    return {
        executeStageCommand: async ({ missionId, stageId, commandId, input: commandInput }) => {
            const normalizedMissionId = requireMissionId(missionId, 'Stage commands require missionId, stageId, and commandId.');
            const normalizedStageId = requireNonEmptyValue(stageId, 'Stage commands require missionId, stageId, and commandId.');
            const normalizedCommandId = requireNonEmptyValue(commandId, 'Stage commands require missionId, stageId, and commandId.');
            return StageCommandAcknowledgementSchema.parse(await commandRemote({
                entity: stageEntityName,
                method: 'command',
                payload: {
                    ...buildMissionPayload(normalizedMissionId, repositoryRootPath),
                    stageId: normalizedStageId,
                    commandId: normalizedCommandId,
                    ...(commandInput !== undefined ? { input: commandInput } : {})
                }
            }));
        },
        executeTaskCommand: async ({ missionId, taskId, commandId, input: commandInput }) => {
            const normalizedMissionId = requireMissionId(missionId, 'Task commands require missionId, taskId, and commandId.');
            const normalizedTaskId = requireNonEmptyValue(taskId, 'Task commands require missionId, taskId, and commandId.');
            const normalizedCommandId = requireNonEmptyValue(commandId, 'Task commands require missionId, taskId, and commandId.');
            return TaskCommandAcknowledgementSchema.parse(await commandRemote({
                entity: taskEntityName,
                method: 'command',
                payload: {
                    ...buildMissionPayload(normalizedMissionId, repositoryRootPath),
                    taskId: normalizedTaskId,
                    commandId: normalizedCommandId,
                    ...(commandInput !== undefined ? { input: commandInput } : {})
                }
            }));
        },
        executeAgentSessionCommand: async ({ missionId, sessionId, commandId, input: commandInput }) => {
            const normalizedMissionId = requireMissionId(missionId, 'AgentSession commands require missionId, sessionId, and commandId.');
            const normalizedSessionId = requireNonEmptyValue(sessionId, 'AgentSession commands require missionId, sessionId, and commandId.');
            const normalizedCommandId = requireNonEmptyValue(commandId, 'AgentSession commands require missionId, sessionId, and commandId.');
            return AgentSessionCommandAcknowledgementSchema.parse(await commandRemote({
                entity: agentSessionEntityName,
                method: 'command',
                payload: {
                    ...buildMissionPayload(normalizedMissionId, repositoryRootPath),
                    sessionId: normalizedSessionId,
                    commandId: normalizedCommandId,
                    ...(commandInput !== undefined ? { input: commandInput } : {})
                }
            }));
        },
        sendAgentSessionPrompt: async ({ missionId, sessionId, prompt }) => {
            const normalizedMissionId = requireMissionId(missionId, 'AgentSession prompt commands require missionId and sessionId.');
            const normalizedSessionId = requireNonEmptyValue(sessionId, 'AgentSession prompt commands require missionId and sessionId.');
            return AgentSessionCommandAcknowledgementSchema.parse(await commandRemote({
                entity: agentSessionEntityName,
                method: 'sendPrompt',
                payload: {
                    ...buildMissionPayload(normalizedMissionId, repositoryRootPath),
                    sessionId: normalizedSessionId,
                    prompt
                }
            }));
        },
        sendAgentSessionCommand: async ({ missionId, sessionId, command }) => {
            const normalizedMissionId = requireMissionId(missionId, 'AgentSession terminal commands require missionId and sessionId.');
            const normalizedSessionId = requireNonEmptyValue(sessionId, 'AgentSession terminal commands require missionId and sessionId.');
            return AgentSessionCommandAcknowledgementSchema.parse(await commandRemote({
                entity: agentSessionEntityName,
                method: 'sendCommand',
                payload: {
                    ...buildMissionPayload(normalizedMissionId, repositoryRootPath),
                    sessionId: normalizedSessionId,
                    command
                }
            }));
        },
        readArtifactDocument: async ({ missionId, artifactId, executionContext }) => {
            const normalizedMissionId = requireMissionId(missionId, 'Artifact body queries require missionId and artifactId.');
            const normalizedArtifactId = requireNonEmptyValue(artifactId, 'Artifact body queries require missionId and artifactId.');
            return ArtifactBodySnapshotSchema.parse(await queryRemote({
                entity: artifactEntityName,
                method: 'readDocument',
                payload: {
                    ...buildMissionPayload(normalizedMissionId, repositoryRootPath),
                    artifactId: normalizedArtifactId
                }
            }, executionContext));
        },
        writeArtifactDocument: async ({ missionId, artifactId, body }) => {
            const normalizedMissionId = requireMissionId(missionId, 'Artifact body commands require missionId and artifactId.');
            const normalizedArtifactId = requireNonEmptyValue(artifactId, 'Artifact body commands require missionId and artifactId.');
            return ArtifactBodySnapshotSchema.parse(await commandRemote({
                entity: artifactEntityName,
                method: 'writeDocument',
                payload: {
                    ...buildMissionPayload(normalizedMissionId, repositoryRootPath),
                    artifactId: normalizedArtifactId,
                    body
                }
            }));
        }
    };
}

export class Mission implements EntityModel<MissionSnapshotType> {
    private readonly loadData: MissionDataLoader;
    private readonly commandGateway: MissionCommandGateway;
    private readonly childCommands: MissionChildEntityCommandGateway;
    private snapshotState = $state<MissionSnapshotType | undefined>();
    private controlViewSnapshotState = $state<MissionControlViewSnapshotType | undefined>();
    private worktreePathState = $state<string | undefined>();
    private readonly sessions = new EntityRegistry<string, AgentSessionDataType, AgentSession>();
    private readonly stages = new EntityRegistry<string, StageDataType, Stage>();
    private readonly tasks = new EntityRegistry<string, TaskSnapshot, Task>();
    private readonly artifacts = new EntityRegistry<string, ArtifactSnapshot, Artifact>();

    public constructor(input: MissionDependencies) {
        this.snapshot = input.snapshot;
        this.loadData = input.loadData;
        this.commandGateway = createMissionCommandGateway(input.gatewayDependencies);
        this.childCommands = createMissionChildEntityCommandGateway(input.gatewayDependencies);
        this.applySessionSnapshots(input.snapshot.agentSessions);
        this.applyTaskSnapshots(input.snapshot);
        this.applyStageSnapshots(input.snapshot);
        this.applyArtifactSnapshots(input.snapshot);
    }

    private get snapshot(): MissionSnapshotType {
        const snapshot = this.snapshotState;
        if (!snapshot) {
            throw new Error('Mission snapshot is not initialized.');
        }

        return snapshot;
    }

    private set snapshot(snapshot: MissionSnapshotType) {
        this.snapshotState = structuredClone(snapshot);
    }

    public get missionId(): string {
        return this.snapshot.mission.missionId;
    }

    public get id(): string {
        return this.missionId;
    }

    public get entityName(): 'Mission' {
        return 'Mission';
    }

    public get entityId(): string {
        return this.missionId;
    }

    public get operationalMode(): string | undefined {
        return this.snapshot.status?.operationalMode ?? this.snapshot.mission.operationalMode;
    }

    public get workflowLifecycle(): string | undefined {
        return this.snapshot.workflow?.lifecycle ?? this.snapshot.status?.workflow?.lifecycle;
    }

    public get workflowUpdatedAt(): string | undefined {
        return this.snapshot.workflow?.updatedAt ?? this.snapshot.status?.workflow?.updatedAt;
    }

    public get controlViewSnapshot(): MissionControlViewSnapshotType | undefined {
        const snapshot = $state.snapshot(this.controlViewSnapshotState);
        return snapshot ? structuredClone(snapshot) : undefined;
    }

    public get missionWorktreePath(): string | undefined {
        return this.worktreePathState;
    }

    public get commands(): EntityCommandDescriptorType[] {
        const commands = this.snapshot.mission.commands;
        if (commands) {
            return structuredClone($state.snapshot(commands));
        }

        return [];
    }

    public setRouteState(input: {
        controlViewSnapshot?: MissionControlViewSnapshotType;
        worktreePath?: string;
    }): this {
        this.worktreePathState = input.worktreePath?.trim() || undefined;

        if (!input.controlViewSnapshot) {
            this.controlViewSnapshotState = undefined;
            return this;
        }

        return this.applyControlViewSnapshot(input.controlViewSnapshot);
    }

    public async pause(): Promise<this> {
        return this.runCommandAndRefresh(this.commandGateway.executeMissionCommand({ missionId: this.missionId, commandId: 'mission.pause' }));
    }

    public async resume(): Promise<this> {
        return this.runCommandAndRefresh(this.commandGateway.executeMissionCommand({ missionId: this.missionId, commandId: 'mission.resume' }));
    }

    public async panic(): Promise<this> {
        return this.runCommandAndRefresh(this.commandGateway.executeMissionCommand({ missionId: this.missionId, commandId: 'mission.panic' }));
    }

    public async clearPanic(): Promise<this> {
        return this.runCommandAndRefresh(this.commandGateway.executeMissionCommand({ missionId: this.missionId, commandId: 'mission.clearPanic' }));
    }

    public async restartQueue(): Promise<this> {
        return this.runCommandAndRefresh(this.commandGateway.executeMissionCommand({ missionId: this.missionId, commandId: 'mission.restartQueue' }));
    }

    public async deliver(): Promise<this> {
        return this.runCommandAndRefresh(this.commandGateway.executeMissionCommand({ missionId: this.missionId, commandId: 'mission.deliver' }));
    }

    public async getControlViewSnapshot(input: {
        executionContext?: MissionQueryExecutionContext;
    } = {}): Promise<MissionControlViewSnapshotType> {
        const snapshot = await this.commandGateway.getMissionControlView({
            missionId: this.missionId,
            ...(input.executionContext ? { executionContext: input.executionContext } : {})
        });
        this.applyControlViewSnapshot(snapshot);
        return snapshot;
    }

    public async executeCommand(commandId: string, input?: unknown): Promise<void> {
        await this.commandGateway.executeMissionCommand({
            missionId: this.missionId,
            commandId,
            ...(input !== undefined ? { input } : {})
        });
        await this.refresh();
    }

    public async readDocument(path: string, input: {
        executionContext?: MissionQueryExecutionContext;
    } = {}): Promise<MissionDocumentSnapshotType> {
        return this.commandGateway.readMissionDocument({
            missionId: this.missionId,
            path,
            ...(input.executionContext ? { executionContext: input.executionContext } : {})
        });
    }

    public async writeDocument(
        path: string,
        content: string
    ): Promise<MissionDocumentSnapshotType> {
        return this.commandGateway.writeMissionDocument({
            missionId: this.missionId,
            path,
            content
        });
    }

    public async getWorktree(input: {
        executionContext?: MissionQueryExecutionContext;
    } = {}): Promise<MissionFileTreeResponse> {
        return this.commandGateway.getMissionWorktree({
            missionId: this.missionId,
            ...(input.executionContext ? { executionContext: input.executionContext } : {})
        });
    }

    public listStages(): Stage[] {
        return this.stages.values();
    }

    public getStage(stageId: string): Stage | undefined {
        return this.stages.get(stageId);
    }

    public listSessions(): AgentSession[] {
        return this.sessions.values();
    }

    public listArtifacts(): Artifact[] {
        return this.artifacts.values();
    }

    public listTasks(): Task[] {
        return this.tasks.values();
    }

    public getTask(taskId: string): Task | undefined {
        return this.tasks.get(taskId);
    }

    public listTasksForStage(stageId: string): Task[] {
        return this.getStage(stageId)?.listTasks() ?? [];
    }

    public getSession(sessionId: string): AgentSession | undefined {
        return this.sessions.get(sessionId);
    }

    public getArtifact(filePath: string): Artifact | undefined {
        return this.artifacts.get(filePath);
    }

    public resolveArtifact(input: {
        filePath: string;
        label?: string;
        stageId?: string;
        taskId?: string;
    }): Artifact {
        const snapshot = toArtifactIdentitySnapshot(input);
        const existingArtifact = this.getArtifact(snapshot.filePath);

        if (existingArtifact) {
            return existingArtifact;
        }

        return this.createArtifactEntity(snapshot);
    }

    public async refresh(): Promise<this> {
        this.applySnapshot(await this.loadData(this.missionId));
        return this;
    }

    public updateFromData(snapshot: MissionSnapshotType): this {
        this.snapshot = snapshot;
        this.applySessionSnapshots(snapshot.agentSessions);
        this.applyTaskSnapshots(snapshot);
        this.applyStageSnapshots(snapshot);
        this.applyArtifactSnapshots(snapshot);
        return this;
    }

    public applyMissionStatus(status: MissionStatusSnapshotType): this {
        const controlViewSnapshot = this.controlViewSnapshot;
        if (!controlViewSnapshot) {
            return this;
        }

        return this.applyControlViewSnapshot({
            ...controlViewSnapshot,
            status: structuredClone(status)
        });
    }

    public applyMissionSnapshot(snapshot: MissionSnapshotType): this {
        return this.applySnapshot(snapshot);
    }

    public applyStageSnapshot(snapshot: StageDataType): this {
        const nextStages = upsertById(
            this.stages.values().map((stage) => stage.toData()),
            snapshot,
            (stage) => stage.stageId
        );

        this.applyStageSnapshotsFromStages(nextStages);
        this.applyTaskSnapshotsForStage(snapshot);
        this.applyArtifactDataSnapshotsForStage(snapshot);
        this.updateControlViewStageSnapshot(snapshot);
        return this;
    }

    public applyTaskSnapshot(snapshot: TaskDataType): this {
        this.applyTaskDataSnapshot(snapshot);
        this.updateControlViewTaskSnapshot(snapshot);
        return this;
    }

    public applyArtifactSnapshot(snapshot: ArtifactDataType): this {
        this.applyArtifactControlViewSnapshot(snapshot);
        this.updateControlViewArtifactSnapshot(snapshot);
        return this;
    }

    public applyControlViewSnapshot(snapshot: MissionControlViewSnapshotType): this {
        this.controlViewSnapshotState = structuredClone(snapshot);

        const stageSnapshots = snapshot.workflow?.stages ?? snapshot.status?.workflow?.stages;
        if (stageSnapshots) {
            this.applyTaskSnapshotsFromStages(stageSnapshots);
            this.applyStageSnapshotsFromStages(stageSnapshots);
        }

        const artifactSnapshots = snapshot.status?.artifacts
            ?? stageSnapshots?.flatMap((stage) => stage.artifacts);
        if (artifactSnapshots) {
            this.applyArtifactDataSnapshots(artifactSnapshots);
        }

        return this;
    }

    public applyAgentSessionSnapshot(snapshot: AgentSessionDataType): this {
        const nextSessions = [
            ...this.sessions
                .values()
                .map((session) => session.toData())
                .filter((session) => session.sessionId !== snapshot.sessionId),
            snapshot
        ];

        this.applySessionSnapshots(nextSessions);
        return this;
    }

    public applySnapshot(snapshot: MissionSnapshotType): this {
        return this.updateFromData(snapshot);
    }

    public toData(): MissionSnapshotType {
        return {
            ...structuredClone($state.snapshot(this.snapshot)),
            agentSessions: this.listSessions().map((session) => session.toData())
        };
    }

    public toJSON(): MissionSnapshotType {
        return this.toData();
    }

    private applySessionSnapshots(sessionSnapshots: AgentSessionDataType[]): void {
        this.sessions.reconcile(
            sessionSnapshots,
            (sessionSnapshot) => sessionSnapshot.sessionId,
            (sessionSnapshot) => new AgentSession(sessionSnapshot, {
                executeCommand: async (sessionId, commandId, input) => {
                    await this.childCommands.executeAgentSessionCommand({
                        missionId: this.missionId,
                        sessionId,
                        commandId,
                        ...(input !== undefined ? { input } : {})
                    });
                    await this.refresh();
                },
                sendPrompt: async (sessionId, prompt) => {
                    await this.childCommands.sendAgentSessionPrompt({
                        missionId: this.missionId,
                        sessionId,
                        prompt
                    });
                    await this.refresh();
                },
                sendCommand: async (sessionId, command) => {
                    await this.childCommands.sendAgentSessionCommand({
                        missionId: this.missionId,
                        sessionId,
                        command
                    });
                    await this.refresh();
                }
            })
        );
    }

    private applyTaskSnapshots(snapshot: MissionSnapshotType): void {
        this.applyTaskSnapshotsFromStages(snapshot.stages);
    }

    private applyTaskSnapshotsFromStages(stages: StageDataType[]): void {
        const taskSnapshots: TaskSnapshot[] = stages.flatMap((stage) =>
            stage.tasks.map((task) => ({
                stageId: stage.stageId,
                task
            }))
        );

        this.tasks.reconcile(
            taskSnapshots,
            (taskSnapshot) => taskSnapshot.task.taskId,
            (taskSnapshot) => new Task(taskSnapshot, {
                executeCommand: async (taskId, commandId, input) => {
                    await this.childCommands.executeTaskCommand({
                        missionId: this.missionId,
                        taskId,
                        commandId,
                        ...(input !== undefined ? { input } : {})
                    });
                    await this.refresh();
                }
            })
        );
    }

    private applyTaskSnapshotsForStage(stage: StageDataType): void {
        const taskSnapshots = [
            ...this.tasks
                .values()
                .map((task) => task.toData())
                .filter((task) => task.stageId !== stage.stageId),
            ...stage.tasks.map((task) => ({
                stageId: stage.stageId,
                task
            }))
        ];

        this.reconcileTaskSnapshots(taskSnapshots);
    }

    private applyTaskDataSnapshot(task: TaskDataType): void {
        const nextTaskSnapshot: TaskSnapshot = {
            stageId: task.stageId,
            task
        };
        const taskSnapshots = upsertById(
            this.tasks.values().map((knownTask) => knownTask.toData()),
            nextTaskSnapshot,
            (snapshot) => snapshot.task.taskId
        );

        this.reconcileTaskSnapshots(taskSnapshots);
    }

    private reconcileTaskSnapshots(taskSnapshots: TaskSnapshot[]): void {
        this.tasks.reconcile(
            taskSnapshots,
            (taskSnapshot) => taskSnapshot.task.taskId,
            (taskSnapshot) => new Task(taskSnapshot, {
                executeCommand: async (taskId, commandId, input) => {
                    await this.childCommands.executeTaskCommand({
                        missionId: this.missionId,
                        taskId,
                        commandId,
                        ...(input !== undefined ? { input } : {})
                    });
                    await this.refresh();
                }
            })
        );
    }

    private applyStageSnapshots(snapshot: MissionSnapshotType): void {
        this.applyStageSnapshotsFromStages(snapshot.stages);
    }

    private applyStageSnapshotsFromStages(stages: StageDataType[]): void {
        this.stages.reconcile(
            stages,
            (stage) => stage.stageId,
            (stage) => new Stage(stage, {
                resolveTask: (taskId) => this.tasks.get(taskId),
                executeCommand: async (stageId, commandId, input) => {
                    await this.childCommands.executeStageCommand({
                        missionId: this.missionId,
                        stageId,
                        commandId,
                        ...(input !== undefined ? { input } : {})
                    });
                    await this.refresh();
                }
            })
        );
    }

    private applyArtifactSnapshots(snapshot: MissionSnapshotType): void {
        this.applyArtifactDataSnapshots(snapshot.artifacts);
    }

    private applyArtifactDataSnapshots(artifacts: ArtifactDataType[]): void {
        const artifactSnapshots: ArtifactSnapshot[] = artifacts.map(toArtifactSnapshot);

        this.reconcileArtifactSnapshots(artifactSnapshots);
    }

    private applyArtifactDataSnapshotsForStage(stage: StageDataType): void {
        const artifactSnapshots = [
            ...this.artifacts
                .values()
                .map((artifact) => artifact.toData())
                .filter((artifact) => artifact.stageId !== stage.stageId),
            ...stage.artifacts.map(toArtifactSnapshot)
        ];

        this.reconcileArtifactSnapshots(artifactSnapshots);
    }

    private applyArtifactControlViewSnapshot(snapshot: ArtifactDataType): void {
        const artifactSnapshot = toArtifactSnapshot(snapshot);
        const artifactSnapshots = upsertById(
            this.artifacts.values().map((artifact) => artifact.toData()),
            artifactSnapshot,
            (artifact) => artifact.artifactId
        );

        this.reconcileArtifactSnapshots(artifactSnapshots);
    }

    private reconcileArtifactSnapshots(artifactSnapshots: ArtifactSnapshot[]): void {
        this.artifacts.reconcile(
            artifactSnapshots,
            (artifactSnapshot) => artifactSnapshot.filePath,
            (artifactSnapshot) => this.createArtifactEntity(artifactSnapshot)
        );
    }

    private updateControlViewStageSnapshot(snapshot: StageDataType): void {
        this.updateControlViewWorkflowStages((stages) => upsertById(stages, snapshot, (stage) => stage.stageId));
    }

    private updateControlViewTaskSnapshot(snapshot: TaskDataType): void {
        this.updateControlViewWorkflowStages((stages) => stages.map((stage) => {
            if (stage.stageId !== snapshot.stageId) {
                return {
                    ...stage,
                    tasks: stage.tasks.filter((task) => task.taskId !== snapshot.taskId)
                };
            }

            return {
                ...stage,
                tasks: upsertById(stage.tasks, snapshot, (task) => task.taskId)
            };
        }));
    }

    private updateControlViewArtifactSnapshot(snapshot: ArtifactDataType): void {
        const controlViewSnapshot = this.controlViewSnapshot;
        if (!controlViewSnapshot) {
            return;
        }

        const statusArtifacts = controlViewSnapshot.status?.artifacts;
        this.applyControlViewSnapshot({
            ...controlViewSnapshot,
            ...(controlViewSnapshot.status
                ? {
                    status: {
                        ...controlViewSnapshot.status,
                        artifacts: statusArtifacts
                            ? upsertById(statusArtifacts, snapshot, (artifact) => artifact.artifactId)
                            : [snapshot]
                    }
                }
                : {})
        });
    }

    private updateControlViewWorkflowStages(
        updateStages: (stages: StageDataType[]) => StageDataType[]
    ): void {
        const controlViewSnapshot = this.controlViewSnapshot;
        if (!controlViewSnapshot) {
            return;
        }

        const hasWorkflowStages = controlViewSnapshot.workflow?.stages !== undefined;
        const hasStatusWorkflowStages = controlViewSnapshot.status?.workflow?.stages !== undefined;
        if (!hasWorkflowStages && !hasStatusWorkflowStages) {
            return;
        }

        this.applyControlViewSnapshot({
            ...controlViewSnapshot,
            ...(controlViewSnapshot.workflow && hasWorkflowStages
                ? {
                    workflow: {
                        ...controlViewSnapshot.workflow,
                        stages: updateStages(controlViewSnapshot.workflow.stages as StageDataType[])
                    }
                }
                : {}),
            ...(controlViewSnapshot.status?.workflow && hasStatusWorkflowStages
                ? {
                    status: {
                        ...controlViewSnapshot.status,
                        workflow: {
                            ...controlViewSnapshot.status.workflow,
                            stages: updateStages(controlViewSnapshot.status.workflow.stages as StageDataType[])
                        }
                    }
                }
                : {})
        });
    }

    private createArtifactEntity(snapshot: ArtifactSnapshot): Artifact {
        return new Artifact(snapshot, {
            readDocument: async (filePath, input) => {
                const artifactId = this.getArtifact(filePath)?.artifactId ?? snapshot.artifactId;
                return this.childCommands.readArtifactDocument({
                    missionId: this.missionId,
                    artifactId,
                    ...(input?.executionContext ? { executionContext: input.executionContext } : {})
                });
            },
            writeDocument: async (filePath, body) => {
                const artifactId = this.getArtifact(filePath)?.artifactId ?? snapshot.artifactId;
                return this.childCommands.writeArtifactDocument({
                    missionId: this.missionId,
                    artifactId,
                    body
                });
            }
        });
    }

    private async runCommandAndRefresh(command: Promise<MissionCommandAcknowledgementType>): Promise<this> {
        await command;
        await this.refresh();
        return this;
    }
}

function upsertById<T>(dataItems: T[], snapshot: T, selectId: (snapshot: T) => string): T[] {
    const nextId = selectId(snapshot);
    let replaced = false;
    const nextSnapshots = dataItems.map((candidate) => {
        if (selectId(candidate) !== nextId) {
            return candidate;
        }

        replaced = true;
        return snapshot;
    });

    return replaced ? nextSnapshots : [...nextSnapshots, snapshot];
}

function toArtifactIdentitySnapshot(input: {
    filePath: string;
    label?: string;
    stageId?: string;
    taskId?: string;
}): ArtifactSnapshot {
    return {
        artifactId: input.filePath,
        filePath: input.filePath,
        mimeType: resolveArtifactMimeType(input.filePath),
        ...(input.label?.trim() ? { label: input.label.trim() } : {}),
        ...(input.stageId?.trim() ? { stageId: input.stageId.trim() } : {}),
        ...(input.taskId?.trim() ? { taskId: input.taskId.trim() } : {})
    };
}

function requireMissionId(missionId: string, message: string): string {
    return requireNonEmptyValue(missionId, message);
}

function requireNonEmptyValue(value: string, message: string): string {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
        throw new Error(message);
    }

    return normalizedValue;
}

function buildMissionPayload(missionId: string, repositoryRootPath?: string): { missionId: string; repositoryRootPath?: string } {
    return {
        missionId,
        ...(repositoryRootPath ? { repositoryRootPath } : {})
    };
}

function sendMissionCommand(
    commandRemote: EntityCommandExecutor,
    input: {
        missionId: string;
        commandId: string;
        input?: unknown;
    },
    repositoryRootPath?: string
): Promise<MissionCommandAcknowledgementType> {
    const normalizedMissionId = requireMissionId(input.missionId, 'Mission commands require a missionId and commandId.');
    const normalizedCommandId = requireNonEmptyValue(input.commandId, 'Mission commands require a missionId and commandId.');

    return MissionCommandAcknowledgementSchema.parseAsync(commandRemote({
        entity: missionEntityName,
        method: 'command',
        payload: {
            ...buildMissionPayload(normalizedMissionId, repositoryRootPath),
            commandId: normalizedCommandId,
            ...(input.input !== undefined ? { input: input.input } : {})
        }
    }));
}

function toArtifactSnapshot(artifact: ArtifactDataType): ArtifactSnapshot {
    return {
        artifactId: artifact.artifactId,
        filePath: artifact.filePath ?? artifact.relativePath ?? artifact.artifactId,
        mimeType: artifact.mimeType,
        label: artifact.label,
        ...(artifact.stageId ? { stageId: artifact.stageId } : {}),
        ...(artifact.taskId ? { taskId: artifact.taskId } : {}),
        ...(artifact.commands ? { commands: artifact.commands } : {})
    };
}

function resolveArtifactMimeType(filePath: string): string {
    const normalizedPath = filePath.toLowerCase();
    if (normalizedPath.endsWith('.md') || normalizedPath.endsWith('.markdown')) {
        return 'text/markdown';
    }
    if (normalizedPath.endsWith('.json')) {
        return 'application/json';
    }
    if (normalizedPath.endsWith('.txt')) {
        return 'text/plain';
    }
    return 'application/octet-stream';
}


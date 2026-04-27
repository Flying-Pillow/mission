import type {
    EntityCommandInvocation,
    EntityFormInvocation,
    EntityQueryInvocation,
    EntityRemoteResult
} from './protocol/entityRemote.js';
import {
    executeEntityContractCommand,
    executeEntityContractQuery,
    type EntityContract,
    type EntityContractContext
} from '../entities/Entity/EntityContract.js';
import { MissionDaemonService } from './runtime/mission/MissionDaemonService.js';
import { agentSessionEntityContract } from '../entities/AgentSession/AgentSessionContract.js';
import { artifactEntityContract } from '../entities/Artifact/ArtifactContract.js';
import { gitHubRepositoryEntityContract } from '../entities/GitHubRepository/GitHubRepositoryContract.js';
import { missionEntityContract } from '../entities/Mission/MissionContract.js';
import { repositoryEntityContract } from '../entities/Repository/RepositoryContract.js';
import { stageEntityContract } from '../entities/Stage/StageContract.js';
import { taskEntityContract } from '../entities/Task/TaskContract.js';

const entityContracts = [
    missionEntityContract,
    stageEntityContract,
    taskEntityContract,
    artifactEntityContract,
    agentSessionEntityContract,
    repositoryEntityContract,
    gitHubRepositoryEntityContract
] as const satisfies readonly EntityContract[];

const entityContractsByName = new Map<string, EntityContract>(
    entityContracts.map((contract) => [contract.entity, contract])
);

const missionService = new MissionDaemonService();
const missionOwnedEntities = new Set(['Mission', 'Stage', 'Task', 'Artifact', 'AgentSession']);

export async function executeEntityQueryInDaemon(
    input: EntityQueryInvocation,
    context: EntityContractContext
): Promise<EntityRemoteResult> {
    assertDaemonContext(context);
    return executeEntityContractQuery(resolveEntityContract(input.entity), input, withEntityServices(input.entity, context));
}

export async function executeEntityCommandInDaemon(
    input: EntityCommandInvocation | EntityFormInvocation,
    context: EntityContractContext
): Promise<EntityRemoteResult> {
    assertDaemonContext(context);
    const result = await executeEntityContractCommand(resolveEntityContract(input.entity), input, withEntityServices(input.entity, context));
    await hydrateStartedRepositoryMission(input, context, result);
    return result;
}

function withMissionService(context: EntityContractContext): EntityContractContext {
    return {
        ...context,
        missionService: context.missionService ?? missionService
    };
}

function withEntityServices(entity: string, context: EntityContractContext): EntityContractContext {
    return missionOwnedEntities.has(entity) ? withMissionService(context) : context;
}

function resolveEntityContract(entity: string): EntityContract {
    const contract = entityContractsByName.get(entity);
    if (!contract) {
        throw new Error(`Entity '${entity}' is not implemented in the daemon.`);
    }
    return contract;
}

async function hydrateStartedRepositoryMission(
    input: EntityCommandInvocation | EntityFormInvocation,
    context: EntityContractContext,
    result: EntityRemoteResult
): Promise<void> {
    if (!context.missionService || input.entity !== 'Repository') {
        return;
    }
    if (input.method !== 'startMissionFromIssue' && input.method !== 'startMissionFromBrief') {
        return;
    }
    if (!isRecord(result) || typeof result['id'] !== 'string' || !result['id'].trim()) {
        return;
    }

    const payload = isRecord(input.payload) ? input.payload : {};
    const repositoryRootPath = typeof payload['repositoryRootPath'] === 'string' && payload['repositoryRootPath'].trim()
        ? payload['repositoryRootPath'].trim()
        : context.surfacePath;
    await context.missionService.loadRequiredMissionRuntime(
        {
            missionId: result['id'].trim(),
            repositoryRootPath
        },
        { surfacePath: repositoryRootPath }
    );
}

function isRecord(input: unknown): input is Record<string, unknown> {
    return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function assertDaemonContext(context: { surfacePath: string }): void {
    if (!context.surfacePath.trim()) {
        throw new Error('Entity daemon dispatch requires a surfacePath context.');
    }
}

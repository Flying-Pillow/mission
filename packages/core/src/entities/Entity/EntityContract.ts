import { z } from 'zod/v4';
import type {
    EntityCommandInvocation,
    EntityFormInvocation,
    EntityQueryInvocation,
    EntityRemoteResult
} from '../../daemon/protocol/entityRemote.js';
import type { MissionDaemonService } from '../../daemon/runtime/mission/MissionDaemonService.js';

export type EntityContractContext = {
    surfacePath: string;
    authToken?: string;
    missionService?: MissionDaemonService;
};

export type EntityMethodContract = {
    payload: z.ZodType;
    result: z.ZodType;
    execute(payload: any, context: EntityContractContext): Promise<unknown> | unknown;
};

export type EntityContract = {
    entity: string;
    queries: Record<string, EntityMethodContract>;
    commands: Record<string, EntityMethodContract>;
};

export async function executeEntityContractQuery(
    contract: EntityContract,
    input: EntityQueryInvocation,
    context: EntityContractContext
): Promise<EntityRemoteResult> {
    return executeEntityContractMethod('Query', contract.queries, input, context);
}

export async function executeEntityContractCommand(
    contract: EntityContract,
    input: EntityCommandInvocation | EntityFormInvocation,
    context: EntityContractContext
): Promise<EntityRemoteResult> {
    return executeEntityContractMethod('Command', contract.commands, input, context);
}

async function executeEntityContractMethod(
    kind: 'Query' | 'Command',
    methods: Record<string, EntityMethodContract>,
    input: EntityQueryInvocation | EntityCommandInvocation | EntityFormInvocation,
    context: EntityContractContext
): Promise<EntityRemoteResult> {
    const method = methods[input.method];
    if (!method) {
        throw new Error(`${kind} method '${input.entity}.${input.method}' is not implemented in the daemon.`);
    }

    const payload = method.payload.parse(input.payload ?? {});
    return method.result.parse(await method.execute(payload, context));
}

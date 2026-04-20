import * as fs from 'node:fs/promises';
import { error as kitError, json } from '@sveltejs/kit';
import { missionRuntimeRouteParamsSchema } from '@flying-pillow/mission-core';
import { z } from 'zod';
import { AirportWebGateway } from '$lib/server/gateway/AirportWebGateway.server';
import type { RequestHandler } from './$types';

const missionDocumentQuerySchema = z.object({
    path: z.string().trim().min(1)
});

const missionDocumentWriteSchema = z.object({
    path: z.string().trim().min(1),
    content: z.string()
});

export const GET: RequestHandler = async ({ locals, params, url }) => {
    const { missionId } = missionRuntimeRouteParamsSchema.parse(params);
    const { path } = missionDocumentQuerySchema.parse({
        path: url.searchParams.get('path')
    });
    const gateway = new AirportWebGateway(locals);
    const status = await gateway.getMissionOperatorStatus(missionId);

    validateMissionArtifactPath(status, missionId, path);

    return json(await readMissionDocument(path), {
        headers: {
            'cache-control': 'no-store'
        }
    });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
    const { missionId } = missionRuntimeRouteParamsSchema.parse(params);
    const body = missionDocumentWriteSchema.parse(await request.json());
    const gateway = new AirportWebGateway(locals);
    const status = await gateway.getMissionOperatorStatus(missionId);

    validateMissionArtifactPath(status, missionId, body.path);

    return json(await writeMissionDocument(body.path, body.content), {
        headers: {
            'cache-control': 'no-store'
        }
    });
};

async function readMissionDocument(filePath: string): Promise<{
    filePath: string;
    content: string;
    updatedAt?: string;
}> {
    const content = await fs.readFile(filePath, 'utf8');
    const stats = await fs.stat(filePath);
    return {
        filePath,
        content,
        updatedAt: stats.mtime.toISOString()
    };
}

async function writeMissionDocument(filePath: string, content: string): Promise<{
    filePath: string;
    content: string;
    updatedAt?: string;
}> {
    await fs.writeFile(filePath, content, 'utf8');
    const stats = await fs.stat(filePath);
    return {
        filePath,
        content,
        updatedAt: stats.mtime.toISOString()
    };
}

function validateMissionArtifactPath(
    status: Awaited<ReturnType<AirportWebGateway['getMissionOperatorStatus']>>,
    missionId: string,
    filePath: string
): void {
    const normalizedMissionId = missionId.trim();
    const normalizedPath = filePath.trim();
    const artifacts = Object.values(status.system?.state.domain.artifacts ?? {});
    const allowed = artifacts.some((artifact) =>
        artifact.missionId === normalizedMissionId && artifact.filePath === normalizedPath
    );

    if (!allowed) {
        throw kitError(404, `Artifact '${normalizedPath}' is not part of mission '${normalizedMissionId}'.`);
    }
}
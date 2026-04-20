import { error as kitError } from '@sveltejs/kit';
import {
    missionRuntimeRouteParamsSchema,
    repositoryRuntimeRouteParamsSchema
} from '@flying-pillow/mission-core';
import { AirportWebGateway } from '$lib/server/gateway/AirportWebGateway.server';
import type { MissionControlSnapshot } from '$lib/types/mission-control';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params }) => {
    const { repositoryId } = repositoryRuntimeRouteParamsSchema.parse(params);
    const { missionId } = missionRuntimeRouteParamsSchema.parse(params);

    try {
        const gateway = new AirportWebGateway(locals);
        const airportHome = await gateway.getAirportHomeSnapshot();
        const repositorySurface = await gateway.getRepositorySurfaceSnapshot({
            repositoryId,
            repositoryRootPath: repositoryId,
            selectedMissionId: missionId
        });
        const missionControl = await gateway.getMissionControlSnapshot({
            missionId,
            surfacePath: repositorySurface.repository.repositoryRootPath
        });

        const snapshot: MissionControlSnapshot = missionControl;

        return {
            airportRepositories: airportHome.repositories,
            repositorySurface,
            missionControl: snapshot,
            repositoryId,
            missionId,
        };
    } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        throw kitError(404, message);
    }
};
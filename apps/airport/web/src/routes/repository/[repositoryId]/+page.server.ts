// /apps/airport/web/src/routes/repository/[repositoryId]/+page.server.ts: Loads repository-scoped mission data and handles mission selection redirects.
import { error as kitError, redirect, type Actions } from '@sveltejs/kit';
import {
    repositoryRuntimeRouteParamsSchema
} from '@flying-pillow/mission-core';
import { AirportWebGateway } from '$lib/server/gateway/AirportWebGateway.server';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params, url }) => {
    const { repositoryId } = repositoryRuntimeRouteParamsSchema.parse(params);
    const missionId = url.searchParams.get('missionId')?.trim() || undefined;

    if (missionId) {
        throw redirect(
            303,
            `/repository/${encodeURIComponent(repositoryId)}/missions/${encodeURIComponent(missionId)}`
        );
    }

    try {
        const gateway = new AirportWebGateway(locals);
        const airportHome = await gateway.getAirportHomeSnapshot();

        return {
            airportRepositories: airportHome.repositories,
            repositorySurface: await gateway.getRepositorySurfaceSnapshot({
                repositoryId,
                repositoryRootPath: repositoryId
            }),
            repositoryId,
        };
    } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        throw kitError(404, message);
    }
};

export const actions: Actions = {
    selectMission: async ({ params, request }) => {
        const { repositoryId } = repositoryRuntimeRouteParamsSchema.parse(params);
        const formData = await request.formData();
        const missionId = String(formData.get('missionId') ?? '').trim();
        throw redirect(
            303,
            missionId
                ? `/repository/${encodeURIComponent(repositoryId)}/missions/${encodeURIComponent(missionId)}`
                : `/repository/${encodeURIComponent(repositoryId)}`
        );
    }
};
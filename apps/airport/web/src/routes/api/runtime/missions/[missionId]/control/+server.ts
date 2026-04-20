import { json } from '@sveltejs/kit';
import { missionRuntimeRouteParamsSchema } from '@flying-pillow/mission-core';
import { AirportWebGateway } from '$lib/server/gateway/AirportWebGateway.server';
import type { MissionControlSnapshot } from '$lib/types/mission-control';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
    const { missionId } = missionRuntimeRouteParamsSchema.parse(params);
    const gateway = new AirportWebGateway(locals);

    const snapshot: MissionControlSnapshot = await gateway.getMissionControlSnapshot({
        missionId
    });

    return json(snapshot, {
        headers: {
            'cache-control': 'no-store'
        }
    });
};
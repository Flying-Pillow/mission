import { json } from '@sveltejs/kit';
import {
    missionRuntimeRouteParamsSchema,
    missionTerminalInputSchema
} from '@flying-pillow/mission-core';
import { AirportWebGateway } from '$lib/server/gateway/AirportWebGateway.server';
import {
    isStaleMissionTerminalDaemonError,
    resolveMissionTerminalRuntimeError,
    restartMissionTerminalDaemon
} from '$lib/server/mission-terminal-errors';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
    const { missionId } = missionRuntimeRouteParamsSchema.parse(params);

    try {
        const snapshot = await readMissionTerminalSnapshot(locals, missionId);

        return json(snapshot, {
            headers: {
                'cache-control': 'no-store'
            }
        });
    } catch (error) {
        const runtimeError = resolveMissionTerminalRuntimeError(error);
        return json({ message: runtimeError.message }, {
            status: runtimeError.status,
            headers: {
                'cache-control': 'no-store'
            }
        });
    }
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
    const { missionId } = missionRuntimeRouteParamsSchema.parse(params);
    const body = missionTerminalInputSchema.parse(await request.json());

    try {
        const snapshot = await sendMissionTerminalInput(locals, {
            missionId,
            ...(body.data !== undefined ? { data: body.data } : {}),
            ...(body.literal !== undefined ? { literal: body.literal } : {}),
            ...(body.cols !== undefined ? { cols: body.cols } : {}),
            ...(body.rows !== undefined ? { rows: body.rows } : {})
        });

        return json(snapshot, {
            headers: {
                'cache-control': 'no-store'
            }
        });
    } catch (error) {
        const runtimeError = resolveMissionTerminalRuntimeError(error);
        return json({ message: runtimeError.message }, {
            status: runtimeError.status,
            headers: {
                'cache-control': 'no-store'
            }
        });
    }
};

async function readMissionTerminalSnapshot(locals: App.Locals, missionId: string) {
    const gateway = new AirportWebGateway(locals);
    try {
        return await gateway.getMissionTerminalSnapshot({ missionId });
    } catch (error) {
        if (!isStaleMissionTerminalDaemonError(error)) {
            throw error;
        }

        await restartMissionTerminalDaemon({ locals });
        return await new AirportWebGateway(locals).getMissionTerminalSnapshot({ missionId });
    }
}

async function sendMissionTerminalInput(
    locals: App.Locals,
    input: {
        missionId: string;
        data?: string;
        literal?: boolean;
        cols?: number;
        rows?: number;
    }
) {
    const gateway = new AirportWebGateway(locals);
    try {
        return await gateway.sendMissionTerminalInput(input);
    } catch (error) {
        if (!isStaleMissionTerminalDaemonError(error)) {
            throw error;
        }

        await restartMissionTerminalDaemon({ locals });
        return await new AirportWebGateway(locals).sendMissionTerminalInput(input);
    }
}
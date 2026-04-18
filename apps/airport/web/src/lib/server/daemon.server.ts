import {
    connectAirportControl,
    type DaemonClient,
    resolveAirportControlRuntimeMode
} from '@flying-pillow/mission-core';

export function resolveRequestAuthToken(locals?: App.Locals): string | undefined {
    const authToken = locals?.githubAuthToken?.trim();
    return authToken && authToken.length > 0 ? authToken : undefined;
}

export function resolveSurfacePath(): string {
    const configuredSurfacePath = process.env['MISSION_SURFACE_PATH']?.trim();
    if (configuredSurfacePath && configuredSurfacePath.length > 0) {
        return configuredSurfacePath;
    }

    return process.cwd();
}

export async function connectAuthenticatedDaemonClient(input: {
    locals?: App.Locals;
    authToken?: string;
} = {}): Promise<{
    client: DaemonClient;
    dispose: () => void;
}> {
    const authToken = input.authToken?.trim() || resolveRequestAuthToken(input.locals);
    const client = await connectAirportControl({
        surfacePath: resolveSurfacePath(),
        runtimeMode: resolveAirportControlRuntimeMode(import.meta.url),
        allowStart: true,
        ...(authToken ? { authToken } : {})
    });

    return {
        client,
        dispose: () => client.dispose()
    };
}
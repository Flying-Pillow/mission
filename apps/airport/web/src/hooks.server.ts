// /apps/airport/web/src/hooks.server.ts: Initializes daemon connectivity state and GitHub-backed app context for each request.
import { redirect, type Handle } from '@sveltejs/kit';
import {
    readGithubAuthToken
} from '$lib/server/github-auth.server';
import {
    getDaemonRuntimeState,
    readCachedDaemonSystemStatus,
    type DaemonRuntimeState,
} from '$lib/server/daemon.server';
import type { SystemStatus } from '@flying-pillow/mission-core';

type GithubStatus = 'connected' | 'disconnected' | 'unknown';

const DAEMON_STATE_REQUEST_TIMEOUT_MS = 1_500;
const GITHUB_STATE_REQUEST_TIMEOUT_MS = 1_000;

function resolveSurfacePath(): string {
    const configuredSurfacePath = process.env['MISSION_SURFACE_PATH']?.trim();
    if (configuredSurfacePath && configuredSurfacePath.length > 0) {
        return configuredSurfacePath;
    }

    return process.cwd();
}

async function ensureDaemonState(): Promise<DaemonRuntimeState> {
    return getDaemonRuntimeState({
        surfacePath: resolveSurfacePath(),
        allowStart: true,
        timeoutMs: DAEMON_STATE_REQUEST_TIMEOUT_MS,
    });
}

void ensureDaemonState().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[airport-web] Mission daemon startup check failed: ${message}`);
});

function resolveGithubStatus(systemStatus?: SystemStatus): GithubStatus {
    if (systemStatus?.github.authenticated) {
        return 'connected';
    }
    if (systemStatus?.github.cliAvailable) {
        return 'disconnected';
    }
    return 'unknown';
}

function resolveGitHubContext(systemStatus?: SystemStatus): {
    githubStatus: GithubStatus;
    user?: App.AppContext['user'];
} {
    const githubStatus = resolveGithubStatus(systemStatus);
    const githubUser = systemStatus?.github.user?.trim();
    const githubEmail = systemStatus?.github.email?.trim();
    const githubAvatarUrl = systemStatus?.github.avatarUrl?.trim();

    return {
        githubStatus,
        ...(githubUser
            ? {
                user: {
                    name: githubUser,
                    ...(githubEmail ? { email: githubEmail } : {}),
                    ...(githubAvatarUrl ? { avatarUrl: githubAvatarUrl } : {}),
                    githubStatus
                }
            }
            : {})
    };
}

export const handle: Handle = async ({ event, resolve }) => {
    const daemonState = await ensureDaemonState();
    const githubAuthToken = await readGithubAuthToken(event.cookies);
    const daemonSystemStatus = daemonState.running
        ? await readCachedDaemonSystemStatus({
            surfacePath: resolveSurfacePath(),
            ...(githubAuthToken ? { authToken: githubAuthToken } : {}),
            timeoutMs: GITHUB_STATE_REQUEST_TIMEOUT_MS,
        })
        : undefined;
    const githubContext = resolveGitHubContext(daemonSystemStatus);

    event.locals.githubAuthToken = githubAuthToken;
    event.locals.appContext = {
        daemon: daemonState,
        githubStatus: githubContext.githubStatus,
        ...(githubContext.user ? { user: githubContext.user } : {})
    };

    const pathname = event.url.pathname;
    const isRootPage = pathname === '/';
    const isApiRequest = pathname.startsWith('/api/');
    const isAuthRequest = pathname.startsWith('/auth/');

    if (!daemonState.running && !isRootPage && !isApiRequest && !isAuthRequest) {
        throw redirect(303, '/');
    }

    return resolve(event);
};

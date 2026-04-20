// /apps/airport/web/src/lib/server/daemon.server.ts: Resolves authenticated Mission daemon connections for SvelteKit server routes.
import {
    connectAirportControl,
    type DaemonClient,
    type SystemStatus,
    resolveAirportControlRuntimeMode
} from '@flying-pillow/mission-core';

const DAEMON_CLIENT_IDLE_TIMEOUT_MS = 15_000;
const DAEMON_HEALTH_CACHE_TTL_MS = 3_000;
const DAEMON_RECOVERY_BACKOFF_MS = [0, 2_000, 5_000, 15_000, 30_000, 60_000] as const;

export type DaemonRuntimeState = {
    running: boolean;
    startedByHook: boolean;
    message: string;
    endpointPath?: string;
    lastCheckedAt: string;
    nextRetryAt?: string;
    failureCount?: number;
};

type DaemonRecoveryRecord = {
    state: DaemonRuntimeState;
    checkedAtMs: number;
    consecutiveFailures: number;
    nextRetryAtMs: number;
};

type SharedDaemonClientEntry = {
    clientPromise: Promise<DaemonClient>;
    client?: DaemonClient;
    activeLeases: number;
    idleTimer?: ReturnType<typeof setTimeout>;
};

const sharedDaemonClients = new Map<string, SharedDaemonClientEntry>();
let daemonRecoveryRecord: DaemonRecoveryRecord | undefined;
let daemonRecoveryCheck: Promise<DaemonRuntimeState> | undefined;

export class DaemonUnavailableError extends Error {
    public readonly runtimeState: DaemonRuntimeState;

    public constructor(runtimeState: DaemonRuntimeState) {
        super(runtimeState.message);
        this.name = 'DaemonUnavailableError';
        this.runtimeState = runtimeState;
    }
}

export function isDaemonUnavailableError(error: unknown): error is DaemonUnavailableError {
    return error instanceof DaemonUnavailableError;
}

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

export async function readCachedDaemonSystemStatus(input: {
    locals?: App.Locals;
    authToken?: string;
    surfacePath?: string;
    timeoutMs?: number;
} = {}): Promise<SystemStatus | undefined> {
    const authToken = input.authToken?.trim() || resolveRequestAuthToken(input.locals);
    const surfacePath = input.surfacePath?.trim() || resolveSurfacePath();
    const timeoutMs = input.timeoutMs ?? 1_000;

    try {
        const daemon = await connectDedicatedAuthenticatedDaemonClient({
            surfacePath,
            allowStart: false,
            ...(authToken ? { authToken } : {})
        });
        try {
            return await daemon.client.request<SystemStatus>('system.status', undefined, { timeoutMs });
        } finally {
            daemon.dispose();
        }
    } catch {
        return undefined;
    }
}

export async function getDaemonRuntimeState(input: {
    locals?: App.Locals;
    authToken?: string;
    allowStart?: boolean;
    surfacePath?: string;
    timeoutMs?: number;
} = {}): Promise<DaemonRuntimeState> {
    const authToken = input.authToken?.trim() || resolveRequestAuthToken(input.locals);
    const surfacePath = input.surfacePath?.trim() || resolveSurfacePath();
    const allowStart = input.allowStart ?? true;
    const now = Date.now();
    const timeoutMs = input.timeoutMs ?? 0;

    if (daemonRecoveryRecord && now - daemonRecoveryRecord.checkedAtMs < DAEMON_HEALTH_CACHE_TTL_MS) {
        return daemonRecoveryRecord.state;
    }

    if (daemonRecoveryCheck) {
        return timeoutMs > 0
            ? await raceDaemonRuntimeState(daemonRecoveryCheck, timeoutMs, now)
            : daemonRecoveryCheck;
    }

    daemonRecoveryCheck = checkDaemonRuntimeState({
        surfacePath,
        allowStart,
        ...(authToken ? { authToken } : {})
    }).finally(() => {
        daemonRecoveryCheck = undefined;
    });

    return timeoutMs > 0
        ? await raceDaemonRuntimeState(daemonRecoveryCheck, timeoutMs, now)
        : daemonRecoveryCheck;
}

async function raceDaemonRuntimeState(
    runtimeStatePromise: Promise<DaemonRuntimeState>,
    timeoutMs: number,
    checkedAtMs: number
): Promise<DaemonRuntimeState> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            runtimeStatePromise,
            new Promise<DaemonRuntimeState>((resolve) => {
                timer = setTimeout(() => {
                    resolve(buildPendingDaemonState(checkedAtMs));
                }, timeoutMs);
            })
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

function clearSharedDaemonClient(surfacePath: string, authToken?: string): void {
    const key = createDaemonClientKey(surfacePath, authToken);
    const entry = sharedDaemonClients.get(key);
    if (!entry) {
        return;
    }

    if (entry.idleTimer) {
        clearTimeout(entry.idleTimer);
    }
    sharedDaemonClients.delete(key);
    entry.client?.dispose();
}

function rememberDaemonRuntimeState(input: {
    state: DaemonRuntimeState;
    checkedAtMs: number;
    consecutiveFailures: number;
    nextRetryAtMs: number;
}): DaemonRuntimeState {
    daemonRecoveryRecord = {
        state: input.state,
        checkedAtMs: input.checkedAtMs,
        consecutiveFailures: input.consecutiveFailures,
        nextRetryAtMs: input.nextRetryAtMs
    };

    return input.state;
}

async function checkDaemonRuntimeState(input: {
    surfacePath: string;
    allowStart: boolean;
    authToken?: string;
}): Promise<DaemonRuntimeState> {
    const now = Date.now();
    const authToken = input.authToken?.trim();

    try {
        const daemon = await connectDedicatedAuthenticatedDaemonClient({
            surfacePath: input.surfacePath,
            allowStart: false,
            ...(authToken ? { authToken } : {})
        });
        try {
            return rememberDaemonRuntimeState({
                state: {
                    running: true,
                    startedByHook: false,
                    message: 'Mission daemon connected.',
                    lastCheckedAt: new Date(now).toISOString(),
                    failureCount: 0
                },
                checkedAtMs: now,
                consecutiveFailures: 0,
                nextRetryAtMs: 0
            });
        } finally {
            daemon.dispose();
        }
    } catch (probeError) {
        clearSharedDaemonClient(input.surfacePath, authToken);

        const previousFailures = daemonRecoveryRecord?.consecutiveFailures ?? 0;
        const nextRetryAtMs = daemonRecoveryRecord?.nextRetryAtMs ?? 0;

        if (!input.allowStart || now < nextRetryAtMs) {
            const state = buildUnavailableDaemonState({
                error: probeError,
                checkedAtMs: now,
                startedByHook: false,
                consecutiveFailures: previousFailures,
                nextRetryAtMs
            });
            return rememberDaemonRuntimeState({
                state,
                checkedAtMs: now,
                consecutiveFailures: previousFailures,
                nextRetryAtMs
            });
        }

        try {
            const daemon = await connectDedicatedAuthenticatedDaemonClient({
                surfacePath: input.surfacePath,
                allowStart: true,
                ...(authToken ? { authToken } : {})
            });
            try {
                return rememberDaemonRuntimeState({
                    state: {
                        running: true,
                        startedByHook: true,
                        message: 'Mission daemon recovered and connected.',
                        lastCheckedAt: new Date(now).toISOString(),
                        failureCount: 0
                    },
                    checkedAtMs: now,
                    consecutiveFailures: 0,
                    nextRetryAtMs: 0
                });
            } finally {
                daemon.dispose();
            }
        } catch (recoveryError) {
            clearSharedDaemonClient(input.surfacePath, authToken);
            const consecutiveFailures = previousFailures + 1;
            const recoveryBackoffMs = DAEMON_RECOVERY_BACKOFF_MS[
                Math.min(consecutiveFailures - 1, DAEMON_RECOVERY_BACKOFF_MS.length - 1)
            ];
            const scheduledRetryAtMs = now + recoveryBackoffMs;
            const state = buildUnavailableDaemonState({
                error: recoveryError,
                checkedAtMs: now,
                startedByHook: true,
                consecutiveFailures,
                nextRetryAtMs: scheduledRetryAtMs
            });
            return rememberDaemonRuntimeState({
                state,
                checkedAtMs: now,
                consecutiveFailures,
                nextRetryAtMs: scheduledRetryAtMs
            });
        }
    }
}

function buildUnavailableDaemonState(input: {
    error: unknown;
    checkedAtMs: number;
    startedByHook: boolean;
    consecutiveFailures: number;
    nextRetryAtMs: number;
}): DaemonRuntimeState {
    const reason = input.error instanceof Error ? input.error.message : String(input.error);
    const nextRetryAt = input.nextRetryAtMs > input.checkedAtMs
        ? new Date(input.nextRetryAtMs).toISOString()
        : undefined;

    return {
        running: false,
        startedByHook: input.startedByHook,
        message: nextRetryAt
            ? `Mission daemon is unavailable: ${reason}. The web app will retry recovery after ${nextRetryAt}.`
            : `Mission daemon is unavailable: ${reason}`,
        lastCheckedAt: new Date(input.checkedAtMs).toISOString(),
        ...(nextRetryAt ? { nextRetryAt } : {}),
        ...(input.consecutiveFailures > 0 ? { failureCount: input.consecutiveFailures } : {})
    };
}

function buildPendingDaemonState(checkedAtMs: number): DaemonRuntimeState {
    const lastKnownState = daemonRecoveryRecord?.state;
    const lastKnownFailureCount = daemonRecoveryRecord?.consecutiveFailures
        ?? lastKnownState?.failureCount
        ?? 0;

    return {
        running: false,
        startedByHook: true,
        message: lastKnownState?.message
            ?? 'Mission daemon recovery is still in progress. The web app will keep retrying automatically.',
        lastCheckedAt: new Date(checkedAtMs).toISOString(),
        ...(lastKnownState?.nextRetryAt ? { nextRetryAt: lastKnownState.nextRetryAt } : {}),
        ...(lastKnownFailureCount > 0 ? { failureCount: lastKnownFailureCount } : {})
    };
}

export async function connectAuthenticatedDaemonClient(input: {
    locals?: App.Locals;
    authToken?: string;
    allowStart?: boolean;
    surfacePath?: string;
} = {}): Promise<{
    client: DaemonClient;
    dispose: () => void;
}> {
    const authToken = input.authToken?.trim() || resolveRequestAuthToken(input.locals);
    const surfacePath = input.surfacePath?.trim() || resolveSurfacePath();
    const allowStart = input.allowStart ?? false;

    try {
        if (allowStart) {
            const daemonState = await getDaemonRuntimeState({
                surfacePath,
                allowStart,
                ...(authToken ? { authToken } : {}),
                ...(input.locals ? { locals: input.locals } : {})
            });
            if (!daemonState.running) {
                throw new DaemonUnavailableError(daemonState);
            }
        }

        const lease = await acquireSharedDaemonClient({
            surfacePath,
            allowStart: false,
            ...(authToken ? { authToken } : {})
        });

        return {
            client: lease.client,
            dispose: lease.dispose
        };
    } catch (error) {
        if (allowStart && !isDaemonUnavailableError(error)) {
            clearSharedDaemonClient(surfacePath, authToken);
            const daemonState = await getDaemonRuntimeState({
                surfacePath,
                allowStart,
                ...(authToken ? { authToken } : {}),
                ...(input.locals ? { locals: input.locals } : {})
            });
            if (!daemonState.running) {
                throw new DaemonUnavailableError(daemonState);
            }

            const lease = await acquireSharedDaemonClient({
                surfacePath,
                allowStart: false,
                ...(authToken ? { authToken } : {})
            });
            return {
                client: lease.client,
                dispose: lease.dispose
            };
        }
        throw error;
    }
}

export async function connectDedicatedAuthenticatedDaemonClient(input: {
    locals?: App.Locals;
    authToken?: string;
    allowStart?: boolean;
    surfacePath?: string;
} = {}): Promise<{
    client: DaemonClient;
    dispose: () => void;
}> {
    const authToken = input.authToken?.trim() || resolveRequestAuthToken(input.locals);
    const surfacePath = input.surfacePath?.trim() || resolveSurfacePath();
    const allowStart = input.allowStart ?? false;

    try {
        if (allowStart) {
            const daemonState = await getDaemonRuntimeState({
                surfacePath,
                allowStart,
                ...(authToken ? { authToken } : {}),
                ...(input.locals ? { locals: input.locals } : {})
            });
            if (!daemonState.running) {
                throw new DaemonUnavailableError(daemonState);
            }
        }

        const client = await connectAirportControl({
            surfacePath,
            runtimeMode: resolveAirportControlRuntimeMode(import.meta.url),
            allowStart: false,
            ...(authToken ? { authToken } : {})
        });

        return {
            client,
            dispose: () => {
                client.dispose();
            }
        };
    } catch (error) {
        if (allowStart && !isDaemonUnavailableError(error)) {
            const daemonState = await getDaemonRuntimeState({
                surfacePath,
                allowStart,
                ...(authToken ? { authToken } : {}),
                ...(input.locals ? { locals: input.locals } : {})
            });
            if (!daemonState.running) {
                throw new DaemonUnavailableError(daemonState);
            }

            const client = await connectAirportControl({
                surfacePath,
                runtimeMode: resolveAirportControlRuntimeMode(import.meta.url),
                allowStart: false,
                ...(authToken ? { authToken } : {})
            });
            return {
                client,
                dispose: () => {
                    client.dispose();
                }
            };
        }
        throw error;
    }
}

async function acquireSharedDaemonClient(input: {
    surfacePath: string;
    allowStart: boolean;
    authToken?: string;
}): Promise<{
    client: DaemonClient;
    dispose: () => void;
}> {
    const key = createDaemonClientKey(input.surfacePath, input.authToken);
    let entry = sharedDaemonClients.get(key);
    if (!entry) {
        const newEntry: SharedDaemonClientEntry = {
            clientPromise: connectAirportControl({
                surfacePath: input.surfacePath,
                runtimeMode: resolveAirportControlRuntimeMode(import.meta.url),
                allowStart: input.allowStart,
                ...(input.authToken ? { authToken: input.authToken } : {})
            }),
            activeLeases: 0
        };
        sharedDaemonClients.set(key, newEntry);
        newEntry.clientPromise = newEntry.clientPromise.then(
            (client) => {
                newEntry.client = client;
                return client;
            },
            (error) => {
                sharedDaemonClients.delete(key);
                throw error;
            }
        );
        entry = newEntry;
    }

    if (entry.idleTimer) {
        clearTimeout(entry.idleTimer);
        entry.idleTimer = undefined;
    }

    entry.activeLeases += 1;
    let client: DaemonClient;
    try {
        client = await entry.clientPromise;
        await client.connect({ surfacePath: input.surfacePath });
    } catch (error) {
        sharedDaemonClients.delete(key);
        entry.client?.dispose();
        throw error;
    }

    let disposed = false;
    return {
        client,
        dispose: () => {
            if (disposed) {
                return;
            }
            disposed = true;

            const currentEntry = sharedDaemonClients.get(key);
            if (!currentEntry) {
                return;
            }

            currentEntry.activeLeases = Math.max(0, currentEntry.activeLeases - 1);
            if (currentEntry.activeLeases > 0 || currentEntry.idleTimer) {
                return;
            }

            currentEntry.idleTimer = setTimeout(() => {
                const idleEntry = sharedDaemonClients.get(key);
                if (!idleEntry || idleEntry.activeLeases > 0) {
                    return;
                }

                sharedDaemonClients.delete(key);
                idleEntry.client?.dispose();
            }, DAEMON_CLIENT_IDLE_TIMEOUT_MS);
        }
    };
}

function createDaemonClientKey(surfacePath: string, authToken?: string): string {
    return JSON.stringify({
        surfacePath,
        authToken: authToken?.trim() || ''
    });
}
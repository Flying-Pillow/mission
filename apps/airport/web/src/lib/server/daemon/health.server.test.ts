import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clearSharedDaemonClient = vi.fn();
const openDaemonConnection = vi.fn();

vi.mock('./shared-client.server', () => ({
    clearSharedDaemonClient
}));

vi.mock('./transport.server', () => ({
    openDaemonConnection
}));

describe('getDaemonRuntimeState', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-04T10:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('keeps the last known healthy state while a fresh daemon probe is still pending', async () => {
        openDaemonConnection.mockResolvedValueOnce({
            client: {},
            dispose: vi.fn()
        });

        const { getDaemonRuntimeState } = await import('./health.server');

        await expect(
            getDaemonRuntimeState({
                surfacePath: '/mission',
                allowStart: true
            })
        ).resolves.toMatchObject({
            running: true,
            startedByHook: false
        });

        vi.setSystemTime(new Date('2026-05-04T10:00:03.100Z'));
        openDaemonConnection.mockImplementationOnce(
            () => new Promise(() => { })
        );

        const pendingStatePromise = getDaemonRuntimeState({
            surfacePath: '/mission',
            allowStart: true,
            timeoutMs: 10
        });

        await vi.advanceTimersByTimeAsync(10);

        await expect(pendingStatePromise).resolves.toMatchObject({
            running: true,
            startedByHook: false
        });
    });
});
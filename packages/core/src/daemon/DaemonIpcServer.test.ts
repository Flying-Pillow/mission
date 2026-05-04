import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { getDaemonLockPath, getDaemonRuntimePath } from './daemonPaths.js';
import { MissionRegistry } from './MissionRegistry.js';
import { executeEntityCommandInDaemon } from '../entities/Entity/EntityRemote.js';
import { startMissionDaemon } from './DaemonIpcServer.js';

vi.mock('./MissionTerminal.js', () => ({
    ensureMissionTerminalState: vi.fn(async () => ({
        missionId: '1-initial-setup',
        sessionId: 'mission-shell:connect-four:fixture:1-initial-setup',
        connected: true,
        dead: false,
        exitCode: null,
        screen: '$ ',
        terminalHandle: {
            sessionName: 'mission-shell:connect-four:fixture:1-initial-setup',
            paneId: 'pty'
        }
    })),
    sendMissionTerminalInput: vi.fn(async () => ({
        missionId: '1-initial-setup',
        sessionId: 'mission-shell:connect-four:fixture:1-initial-setup',
        connected: true,
        dead: false,
        exitCode: null,
        screen: '$ printf daemon-terminal-test\ndaemon-terminal-test\n$ ',
        terminalHandle: {
            sessionName: 'mission-shell:connect-four:fixture:1-initial-setup',
            paneId: 'pty'
        }
    })),
    observeMissionTerminalUpdates: vi.fn(() => ({ dispose: vi.fn() }))
}));

vi.mock('./AgentSessionTerminal.js', () => ({
    observeAgentSessionTerminalUpdates: vi.fn(() => ({ dispose: vi.fn() }))
}));

describe('minimal source daemon request handling', () => {
    it('refuses to start a second daemon while one process owns the runtime', async () => {
        const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-daemon-singleton-workspace-'));
        const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-daemon-singleton-runtime-'));
        const previousRuntimeDirectory = process.env['XDG_RUNTIME_DIR'];
        process.env['XDG_RUNTIME_DIR'] = runtimeRoot;
        const hydrateDaemonMissions = vi.spyOn(MissionRegistry.prototype, 'hydrateDaemonMissions').mockResolvedValue(undefined);
        const socketPath = path.join(runtimeRoot, 'daemon.sock');
        const daemon = await startMissionDaemon({
            socketPath,
            surfacePath: workspaceRoot
        });

        try {
            await expect(startMissionDaemon({
                socketPath,
                surfacePath: workspaceRoot
            })).rejects.toThrow(/Mission daemon is already running with pid/u);
            expect(hydrateDaemonMissions).toHaveBeenCalledTimes(1);
        } finally {
            await daemon.dispose();
            hydrateDaemonMissions.mockRestore();
            restoreRuntimeDirectory(previousRuntimeDirectory);
            await fs.rm(runtimeRoot, { recursive: true, force: true });
            await fs.rm(workspaceRoot, { recursive: true, force: true });
        }
    });

    it('replaces a stale daemon runtime lock before starting', async () => {
        const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-daemon-stale-lock-workspace-'));
        const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-daemon-stale-lock-runtime-'));
        const previousRuntimeDirectory = process.env['XDG_RUNTIME_DIR'];
        process.env['XDG_RUNTIME_DIR'] = runtimeRoot;
        const hydrateDaemonMissions = vi.spyOn(MissionRegistry.prototype, 'hydrateDaemonMissions').mockResolvedValue(undefined);
        await fs.mkdir(getDaemonRuntimePath(), { recursive: true });
        await fs.writeFile(getDaemonLockPath(), `${JSON.stringify({
            lockPath: getDaemonLockPath(),
            processId: 999999999,
            createdAt: '2026-05-04T00:00:00.000Z',
            socketPath: path.join(runtimeRoot, 'daemon.sock')
        }, null, 2)}\n`, 'utf8');

        const daemon = await startMissionDaemon({
            socketPath: path.join(runtimeRoot, 'daemon.sock'),
            surfacePath: workspaceRoot
        });

        try {
            await expect(fs.readFile(getDaemonLockPath(), 'utf8')).resolves.toContain(`"processId": ${String(process.pid)}`);
        } finally {
            await daemon.dispose();
            hydrateDaemonMissions.mockRestore();
            restoreRuntimeDirectory(previousRuntimeDirectory);
            await fs.rm(runtimeRoot, { recursive: true, force: true });
            await fs.rm(workspaceRoot, { recursive: true, force: true });
        }
    });

    it('returns a mission terminal snapshot for mission entity ensure requests', async () => {
        const context = createMissionTerminalContext();
        const result = await executeEntityCommandInDaemon({
            entity: 'Mission',
            method: 'ensureTerminal',
            payload: { missionId: '1-initial-setup' }
        }, context);

        expect(result).toMatchObject({
            missionId: '1-initial-setup',
            connected: true,
            dead: false,
            exitCode: null,
            screen: expect.any(String)
        });
    });

    it('returns a mission terminal snapshot for mission entity input requests after explicit ensure', async () => {
        const context = createMissionTerminalContext();
        await executeEntityCommandInDaemon({
            entity: 'Mission',
            method: 'ensureTerminal',
            payload: { missionId: '1-initial-setup' }
        }, context);

        const result = await executeEntityCommandInDaemon({
            entity: 'Mission',
            method: 'sendTerminalInput',
            payload: {
                missionId: '1-initial-setup',
                data: 'printf daemon-terminal-test\n'
            }
        }, context);

        expect(result).toMatchObject({
            missionId: '1-initial-setup',
            connected: true,
            dead: false,
            exitCode: null,
            screen: expect.any(String)
        });
    });

    function createMissionTerminalContext() {
        const mission = {
            ensureTerminal: vi.fn(async (payload: { missionId: string }) => ({
                missionId: payload.missionId,
                connected: true,
                dead: false,
                exitCode: null,
                screen: '$ '
            })),
            sendTerminalInput: vi.fn(async (payload: { missionId: string }) => ({
                missionId: payload.missionId,
                connected: true,
                dead: false,
                exitCode: null,
                screen: '$ printf daemon-terminal-test\ndaemon-terminal-test\n$ '
            }))
        };
        const missionRegistry = new MissionRegistry();
        vi.spyOn(missionRegistry, 'loadRequiredMission').mockResolvedValue(mission as never);
        return {
            surfacePath: '/repositories/Flying-Pillow/connect-four',
            missionRegistry
        };
    }
});

function restoreRuntimeDirectory(previousRuntimeDirectory: string | undefined): void {
    if (previousRuntimeDirectory === undefined) {
        delete process.env['XDG_RUNTIME_DIR'];
        return;
    }

    process.env['XDG_RUNTIME_DIR'] = previousRuntimeDirectory;
}
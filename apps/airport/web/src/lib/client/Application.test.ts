import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MissionControlSnapshot } from '$lib/types/mission-control';
import type {
    MissionRuntimeSnapshot,
    RepositorySurfaceSnapshot
} from '@flying-pillow/mission-core/airport/runtime';

const remoteMocks = vi.hoisted(() => ({
    qry: vi.fn(),
    getAirportRouteData: vi.fn(),
    getRepositorySnapshotBundle: vi.fn(),
    addAirportRepository: vi.fn(),
    logoutAirportSession: vi.fn(),
    getMissionSnapshotBundle: vi.fn(),
    hydrateMissionSnapshot: vi.fn((snapshot: MissionRuntimeSnapshot) => ({
        missionId: snapshot.missionId,
        setRouteState: vi.fn()
    })),
    refreshMission: vi.fn(),
    observeMission: vi.fn()
}));

vi.mock('../../routes/api/entities/remote/query.remote', () => ({
    qry: (input: unknown) => ({
        run: () => remoteMocks.qry(input)
    })
}));

vi.mock('../../routes/api/airport/airport.remote', () => ({
    getAirportRouteData: (input: unknown) => ({
        run: () => remoteMocks.getAirportRouteData(input)
    }),
    getRepositorySnapshotBundle: (input: unknown) => ({
        run: () => remoteMocks.getRepositorySnapshotBundle(input)
    }),
    addAirportRepository: remoteMocks.addAirportRepository,
    logoutAirportSession: remoteMocks.logoutAirportSession,
    getMissionSnapshotBundle: (input: unknown) => ({
        run: () => remoteMocks.getMissionSnapshotBundle(input)
    })
}));

vi.mock('$lib/client/runtime/AirportClientRuntime', () => ({
    AirportClientRuntime: class AirportClientRuntime {
        public hydrateMissionSnapshot(snapshot: MissionRuntimeSnapshot) {
            return remoteMocks.hydrateMissionSnapshot(snapshot);
        }

        public refreshMission(...args: unknown[]) {
            return remoteMocks.refreshMission(...args);
        }

        public observeMission(...args: unknown[]) {
            return remoteMocks.observeMission(...args);
        }
    }
}));

import { AirportApplication } from '$lib/client/Application.svelte';

function createRepositorySurface(): RepositorySurfaceSnapshot {
    return {
        repository: {
            repositoryId: 'repo-1',
            repositoryRootPath: '/repositories/Flying-Pillow/mission',
            label: 'mission',
            description: 'mission'
        },
        missions: []
    } as unknown as RepositorySurfaceSnapshot;
}

function createMissionRuntimeSnapshot(): MissionRuntimeSnapshot {
    return {
        missionId: 'mission-29',
        status: {
            missionId: 'mission-29',
            title: 'Mission 29',
            lifecycle: 'running',
            workflow: {
                lifecycle: 'running',
                updatedAt: '2026-04-23T19:00:00.000Z',
                currentStageId: 'implementation',
                stages: []
            }
        },
        sessions: []
    } as MissionRuntimeSnapshot;
}

function createMissionControlSnapshot(): MissionControlSnapshot {
    return {
        missionRuntime: createMissionRuntimeSnapshot(),
        operatorStatus: {
            missionId: 'mission-29',
            title: 'Mission 29',
            lifecycle: 'running',
            workflow: {
                lifecycle: 'running',
                updatedAt: '2026-04-23T19:00:00.000Z',
                currentStageId: 'implementation',
                stages: []
            },
            tower: {
                treeNodes: []
            },
            productFiles: {}
        }
    } as MissionControlSnapshot;
}

describe('AirportApplication route hydration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        remoteMocks.qry.mockReset();
        remoteMocks.getAirportRouteData.mockReset();
        remoteMocks.getRepositorySnapshotBundle.mockReset();
        remoteMocks.addAirportRepository.mockReset();
        remoteMocks.logoutAirportSession.mockReset();
        remoteMocks.getMissionSnapshotBundle.mockReset();
        remoteMocks.refreshMission.mockResolvedValue(undefined);
        remoteMocks.observeMission.mockReturnValue({ dispose: vi.fn() });
    });

    it('hydrates the airport home route through the centralized airport contract', async () => {
        remoteMocks.getAirportRouteData.mockResolvedValue({
            airportHome: {
                repositories: [
                    {
                        repositoryId: 'repo-1',
                        repositoryRootPath: '/repositories/Flying-Pillow/mission',
                        label: 'mission',
                        description: 'mission'
                    }
                ],
                selectedRepositoryRoot: '/repositories/Flying-Pillow/mission'
            },
            loginHref: '/login?redirectTo=/airport',
            githubRepositories: []
        });

        const application = new AirportApplication();
        const data = await application.openAirportRoute();

        expect(data.airportHome.repositories).toHaveLength(1);
        expect(application.airportHomeState?.loginHref).toBe('/login?redirectTo=/airport');
        expect(application.activeRepositoryId).toBe('repo-1');
        expect(remoteMocks.getAirportRouteData).toHaveBeenCalledWith({});
    });

    it('loads repository summaries during singleton initialization', async () => {
        remoteMocks.qry.mockResolvedValueOnce([
            {
                repositoryId: 'repo-1',
                repositoryRootPath: '/repositories/Flying-Pillow/mission',
                label: 'mission',
                description: 'mission'
            }
        ]);

        const application = new AirportApplication();
        await application.initialize();

        expect(application.repositoriesState).toHaveLength(1);
        expect(remoteMocks.qry).toHaveBeenCalledWith({
            reference: { entity: 'Airport' },
            method: 'listRepositories',
            args: {}
        });
    });

    it('hydrates the repository route through the generic entity query boundary', async () => {
        remoteMocks.getRepositorySnapshotBundle.mockResolvedValue({
            airportRepositories: [
                {
                    repositoryId: 'repo-1',
                    repositoryRootPath: '/repositories/Flying-Pillow/mission',
                    label: 'mission',
                    description: 'mission'
                }
            ],
            repositorySnapshot: createRepositorySurface(),
            repositoryId: 'repo-1'
        });

        const application = new AirportApplication();
        const repository = await application.openRepositoryRoute('repo-1');

        expect(repository.repositoryId).toBe('repo-1');
        expect(application.activeRepository).toBe(repository);
        expect(remoteMocks.getRepositorySnapshotBundle).toHaveBeenCalledWith({
            repositoryId: 'repo-1'
        });
    });

    it('hydrates wrapped repository route data from a reactive query instance', async () => {
        const application = new AirportApplication();

        const repository = application.syncRepositorySnapshotBundle({
            current: {
                airportRepositories: [
                    {
                        repositoryId: 'repo-1',
                        repositoryRootPath: '/repositories/Flying-Pillow/mission',
                        label: 'mission',
                        description: 'mission'
                    }
                ],
                repositorySnapshot: createRepositorySurface(),
                repositoryId: 'repo-1'
            }
        });

        expect(repository.repositoryId).toBe('repo-1');
        expect(application.activeRepository).toBe(repository);
    });

    it('hydrates the mission route from a wrapped remote query result', async () => {
        remoteMocks.getMissionSnapshotBundle.mockResolvedValue({
            current: {
                airportRepositories: [],
                repositorySnapshot: createRepositorySurface(),
                missionControl: createMissionControlSnapshot(),
                missionWorktreePath: '/repositories/Flying-Pillow/mission/.flying-pillow/worktrees/mission-29',
                repositoryId: 'repo-1',
                missionId: 'mission-29'
            }
        });

        const application = new AirportApplication();
        const mission = await application.openMissionRoute({
            repositoryId: 'repo-1',
            missionId: 'mission-29'
        });

        expect(mission.missionId).toBe('mission-29');
        expect(application.activeMission).toBe(mission);
    });

    it('hydrates wrapped mission snapshot bundles from a reactive query instance', async () => {
        const application = new AirportApplication();

        const mission = application.syncMissionSnapshotBundle({
            current: {
                airportRepositories: [],
                repositorySnapshot: createRepositorySurface(),
                missionControl: createMissionControlSnapshot(),
                missionWorktreePath: '/repositories/Flying-Pillow/mission/.flying-pillow/worktrees/mission-29',
                repositoryId: 'repo-1',
                missionId: 'mission-29'
            }
        });

        expect(mission.missionId).toBe('mission-29');
        expect(application.activeMission).toBe(mission);
    });

    it('propagates entity query failures for invalid repository loads', async () => {
        remoteMocks.getRepositorySnapshotBundle.mockRejectedValueOnce(new Error('Repository read failed.'));

        const application = new AirportApplication();

        await expect(application.openRepositoryRoute('repo-1')).rejects.toThrow('Repository read failed.');
    });
});
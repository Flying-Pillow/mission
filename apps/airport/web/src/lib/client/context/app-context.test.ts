import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppContext } from '$lib/client/context/app-context.svelte';
import { app } from '$lib/client/Application.svelte';
import type {
    MissionRuntimeSnapshot,
    RepositorySurfaceSnapshot
} from '@flying-pillow/mission-core/airport/runtime';

const runtimeMocks = vi.hoisted(() => ({
    missions: new Map<string, { missionId: string; workflowLifecycle?: string; updateFromSnapshot: (next: MissionRuntimeSnapshot) => unknown }>(),
    hydrateMissionSnapshot: vi.fn((snapshot: MissionRuntimeSnapshot) => {
        const existing = runtimeMocks.missions.get(snapshot.missionId);
        if (existing) {
            existing.updateFromSnapshot(snapshot);
            return existing;
        }

        const created = {
            missionId: snapshot.missionId,
            workflowLifecycle: snapshot.status.workflow?.lifecycle,
            updateFromSnapshot(next: MissionRuntimeSnapshot) {
                this.workflowLifecycle = next.status.workflow?.lifecycle;
                return this;
            }
        };
        runtimeMocks.missions.set(snapshot.missionId, created);
        return created;
    })
}));

vi.mock('$lib/client/runtime/AirportClientRuntime', () => ({
    AirportClientRuntime: class AirportClientRuntime {
        public hydrateMissionSnapshot(snapshot: MissionRuntimeSnapshot) {
            return runtimeMocks.hydrateMissionSnapshot(snapshot);
        }
    }
}));

beforeEach(() => {
    runtimeMocks.missions.clear();
    runtimeMocks.hydrateMissionSnapshot.mockClear();
});

function createMissionSnapshot(input: {
    missionId?: string;
    lifecycle?: string;
} = {}): MissionRuntimeSnapshot {
    return {
        missionId: input.missionId ?? 'mission-29',
        status: {
            missionId: input.missionId ?? 'mission-29',
            title: 'Mission 29',
            lifecycle: input.lifecycle ?? 'running',
            workflow: {
                lifecycle: input.lifecycle ?? 'running',
                updatedAt: '2026-04-23T19:00:00.000Z',
                currentStageId: 'implementation',
                stages: [],
            },
        },
        sessions: [],
    } as MissionRuntimeSnapshot;
}

function createRepositorySnapshot(
    missionSnapshot?: MissionRuntimeSnapshot,
): RepositorySurfaceSnapshot {
    return {
        repository: {
            repositoryId: 'repo-1',
            repositoryRootPath: '/repositories/Flying-Pillow/mission',
            label: 'mission',
            description: 'mission',
        },
        missions: [],
        selectedMissionId: missionSnapshot?.missionId,
        selectedMission: missionSnapshot,
    } as unknown as RepositorySurfaceSnapshot;
}

describe('createAppContext', () => {
    it('uses the shared application singleton', () => {
        app.reset();
        const context = createAppContext(() => ({
            daemon: {
                running: true,
                startedByHook: false,
                message: 'ready',
                lastCheckedAt: '2026-04-23T19:00:00.000Z',
            },
            githubStatus: 'connected',
        }));

        expect(context.application).toBe(app);
    });

    it('reuses repository and mission instances when snapshots are synchronized', () => {
        app.reset();
        const context = createAppContext(() => ({
            daemon: {
                running: true,
                startedByHook: false,
                message: 'ready',
                lastCheckedAt: '2026-04-23T19:00:00.000Z',
            },
            githubStatus: 'connected',
        }));
        const initialMission = createMissionSnapshot({ lifecycle: 'running' });
        const repository = context.syncRepositoryData({
            airportRepositories: [],
            repositorySnapshot: createRepositorySnapshot(initialMission),
        });
        const mission = context.syncMissionRuntime({
            snapshot: initialMission,
            repositoryRootPath: '/repositories/Flying-Pillow/mission',
        });

        const updatedMission = createMissionSnapshot({ lifecycle: 'paused' });
        const updatedRepository = context.syncRepositoryData({
            airportRepositories: [],
            repositorySnapshot: createRepositorySnapshot(updatedMission),
        });
        const reconciledMission = context.syncMissionRuntime({
            snapshot: updatedMission,
            repositoryRootPath: '/repositories/Flying-Pillow/mission',
        });

        expect(updatedRepository).toBe(repository);
        expect(reconciledMission).toBe(mission);
        expect(context.airport.activeRepository).toBe(repository);
        expect(context.airport.activeMission).toBe(mission);
        expect(mission.workflowLifecycle).toBe('paused');
    });

    it('clears the active mission entity when the selected mission is removed', () => {
        app.reset();
        const context = createAppContext(() => ({
            daemon: {
                running: true,
                startedByHook: false,
                message: 'ready',
                lastCheckedAt: '2026-04-23T19:00:00.000Z',
            },
            githubStatus: 'connected',
        }));

        context.syncRepositoryData({
            airportRepositories: [],
            repositorySnapshot: createRepositorySnapshot(createMissionSnapshot()),
        });

        context.syncRepositoryData({
            airportRepositories: [],
            repositorySnapshot: createRepositorySnapshot(),
        });

        expect(context.airport.activeMissionId).toBeUndefined();
        expect(context.airport.activeMission).toBeUndefined();
    });
});
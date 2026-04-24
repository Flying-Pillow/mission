import type {
    AirportRuntimeEventEnvelope,
    MissionRuntimeSnapshot,
    RepositorySurfaceSnapshot
} from '@flying-pillow/mission-core/airport/runtime';
import {
    repositorySchema,
    repositorySurfaceSnapshotSchema
} from '@flying-pillow/mission-core/airport/runtime';
import { z } from 'zod/v4';
import type { ActiveMissionOutline } from '$lib/client/context/app-context.svelte';
import { Repository } from '$lib/client/entities/Repository.svelte.js';
import type { Mission } from '$lib/client/entities/Mission.svelte.js';
import { setApp } from '$lib/client/globals';
import { AirportClientRuntime } from '$lib/client/runtime/AirportClientRuntime';
import type { RuntimeSubscription } from '$lib/client/runtime/transport/EntityRuntimeTransport';
import { qry } from '../../routes/api/entities/remote/query.remote';
import {
    addAirportRepository,
    getAirportRouteData,
    getMissionSnapshotBundle,
    getRepositorySnapshotBundle,
    logoutAirportSession,
    type AddAirportRepositoryResult,
    type AirportRouteData,
    type MissionSnapshotBundle,
    type RepositorySnapshotBundle
} from '../../routes/api/airport/airport.remote';
import type { SidebarRepositorySummary } from '$lib/components/entities/types';
import type { MissionControlSnapshot } from '$lib/types/mission-control';

type EventSourceFactory = (url: string) => EventSource;
type RemoteQueryValue<T> = T | { current?: T | null };

type AddRepositoryState = {
    error?: string;
    success?: boolean;
    repositoryPath?: string;
    githubRepository?: string;
};

export class AirportApplication {
    private readonly repositories = new Map<string, Repository>();
    private readonly runtimes = new Map<string, AirportClientRuntime>();
    #isInitialized = false;
    #repositoryLoadPromise: Promise<SidebarRepositorySummary[]> | null = null;
    public airportHomeState = $state<AirportRouteData | undefined>();
    public airportHomeLoading = $state(false);
    public airportHomeError = $state<string | undefined>();
    public repositoriesLoading = $state(false);
    public repositoriesError = $state<string | undefined>();
    public addRepositoryState = $state<AddRepositoryState | undefined>();
    public addRepositoryPending = $state(false);
    public repositoriesState = $state<SidebarRepositorySummary[]>([]);
    public activeRepository = $state<Repository | undefined>();
    public activeMission = $state<Mission | undefined>();
    public activeRepositoryId = $state<string | undefined>();
    public activeRepositoryRootPath = $state<string | undefined>();
    public activeMissionId = $state<string | undefined>();
    public activeMissionOutline = $state<ActiveMissionOutline | undefined>();
    public activeMissionSelectedNodeId = $state<string | undefined>();

    public constructor(private readonly input: {
        fetch?: typeof fetch;
        createEventSource?: EventSourceFactory;
    } = {}) {
        setApp(this);
    }

    public async initialize(): Promise<void> {
        if (this.#isInitialized) {
            return;
        }

        await this.loadRepositories();
        this.#isInitialized = true;
    }

    public hydrateRepositoryData(
        snapshot: RepositorySurfaceSnapshot
    ): Repository {
        const repositoryId = snapshot.repository.repositoryId;
        const existing = this.repositories.get(repositoryId);
        if (existing) {
            existing.applyData(snapshot);
            this.setActiveRepository(existing);
            this.setActiveMission(existing.selectedMission);
            return existing;
        }

        const created = new Repository(snapshot, {
            loadSnapshot: (input) => this.loadRepositorySnapshot(input),
            resolveMission: (snapshot) => this.getRuntime().hydrateMissionSnapshot(snapshot)
        });
        this.repositories.set(repositoryId, created);
        this.setActiveRepository(created);
        this.setActiveMission(created.selectedMission);
        return created;
    }

    public hydrateMissionSnapshot(
        snapshot: MissionRuntimeSnapshot,
        input: {
            repositoryRootPath?: string;
        } = {}
    ) {
        const mission = this.getRuntime(input.repositoryRootPath).hydrateMissionSnapshot(snapshot);
        this.setActiveMission(mission);
        return mission;
    }

    public async refreshMission(input: {
        missionId: string;
        repositoryRootPath?: string;
    }) {
        const mission = await this.getRuntime(input.repositoryRootPath).refreshMission(input.missionId);
        this.setActiveMission(mission);
        return mission;
    }

    public observeMission(input: {
        missionId: string;
        repositoryRootPath?: string;
        onUpdate?: (mission: ReturnType<AirportClientRuntime['hydrateMissionSnapshot']>, event: AirportRuntimeEventEnvelope) => void;
        onError?: (error: Error) => void;
    }): RuntimeSubscription {
        return this.getRuntime(input.repositoryRootPath).observeMission(input);
    }

    public setActiveRepository(repository?: Repository): void {
        this.activeRepository = repository;
        this.activeRepositoryId = repository?.repositoryId;
        this.activeRepositoryRootPath = repository?.repositoryRootPath;
    }

    public setActiveMission(mission?: Mission): void {
        this.activeMission = mission;
        this.activeMissionId = mission?.missionId;
    }

    public setActiveMissionOutline(outline?: ActiveMissionOutline): void {
        this.activeMissionOutline = outline;
    }

    public setActiveMissionSelectedNodeId(nodeId?: string): void {
        this.activeMissionSelectedNodeId = nodeId;
    }

    public setRepositories(repositories: SidebarRepositorySummary[]): void {
        this.repositoriesState = repositories.map((repository) => ({
            ...repository,
            ...(repository.missions ? { missions: repository.missions } : {})
        }));

        for (const summary of repositories) {
            const existing = this.repositories.get(summary.repositoryId);
            if (existing) {
                existing.applySummary(summary);
            }
        }
    }

    public async openAirportRoute(): Promise<AirportRouteData> {
        this.airportHomeLoading = true;
        this.airportHomeError = undefined;

        try {
            const data = this.syncAirportRouteData(
                await getAirportRouteData({}).run()
            );
            return data;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.airportHomeError = message;
            throw error;
        } finally {
            this.airportHomeLoading = false;
        }
    }

    public syncAirportRouteData(
        input: RemoteQueryValue<AirportRouteData> | undefined
    ): AirportRouteData {
        const data = this.requireAirportRouteData(this.unwrapRemoteQueryValue(input));
        this.airportHomeState = structuredClone(data);
        this.applyAirportHomeSnapshot(data.airportHome);
        return data;
    }

    public async addRepository(input: {
        repositoryPath: string;
        githubRepository?: string;
    }): Promise<AddAirportRepositoryResult> {
        this.addRepositoryPending = true;
        this.addRepositoryState = {
            repositoryPath: input.repositoryPath,
            ...(input.githubRepository ? { githubRepository: input.githubRepository } : {})
        };

        try {
            const result = await addAirportRepository(input);
            await this.loadRepositories({ force: true });
            this.addRepositoryState = {
                success: true,
                repositoryPath: result.repositoryPath,
                ...(result.githubRepository ? { githubRepository: result.githubRepository } : {})
            };
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.addRepositoryState = {
                error: message,
                repositoryPath: input.repositoryPath,
                ...(input.githubRepository ? { githubRepository: input.githubRepository } : {})
            };
            throw error;
        } finally {
            this.addRepositoryPending = false;
        }
    }

    public async logout(): Promise<string> {
        const result = await logoutAirportSession({});
        this.reset();
        return result.redirectTo;
    }

    public async openRepositoryRoute(repositoryId: string): Promise<Repository> {
        const repository = this.syncRepositorySnapshotBundle(
            await getRepositorySnapshotBundle({ repositoryId }).run()
        );
        this.setActiveRepository(repository);
        this.setActiveMission(repository.selectedMission);
        this.setActiveMissionOutline(undefined);
        this.setActiveMissionSelectedNodeId(undefined);
        return repository;
    }

    public syncRepositorySnapshotBundle(
        input: RemoteQueryValue<RepositorySnapshotBundle> | undefined
    ): Repository {
        const bundle = this.requireRepositorySnapshotBundle(this.unwrapRemoteQueryValue(input));
        const repository = this.hydrateRepositoryData(bundle.repositorySnapshot);
        this.setRepositories(this.mergeRepositories(
            bundle.airportRepositories,
            bundle.repositorySnapshot
        ));
        this.setActiveRepository(repository);
        this.setActiveMission(repository.selectedMission);
        this.setActiveMissionOutline(undefined);
        this.setActiveMissionSelectedNodeId(undefined);
        return repository;
    }

    public async openMissionRoute(input: {
        repositoryId: string;
        missionId: string;
    }): Promise<Mission> {
        return this.syncMissionSnapshotBundle(
            await getMissionSnapshotBundle(input).run()
        );
    }

    public syncMissionSnapshotBundle(
        input: RemoteQueryValue<MissionSnapshotBundle> | undefined
    ): Mission {
        const bundle = this.requireMissionSnapshotBundle(this.unwrapRemoteQueryValue(input));
        const repository = this.hydrateRepositoryData(bundle.repositorySnapshot);
        this.setRepositories(this.mergeRepositories(
            bundle.airportRepositories,
            bundle.repositorySnapshot
        ));
        const mission = this.hydrateMissionSnapshot(bundle.missionControl.missionRuntime, {
            repositoryRootPath: bundle.missionWorktreePath
        });

        mission.setRouteState({
            controlSnapshot: bundle.missionControl,
            worktreePath: bundle.missionWorktreePath
        });

        this.setActiveRepository(repository);
        this.setActiveMission(mission);
        this.setActiveMissionOutline(toMissionOutline(bundle.missionControl));
        return mission;
    }

    public syncMissionControlState(input: {
        controlSnapshot: MissionControlSnapshot;
        repositoryRootPath?: string;
    }): Mission {
        const mission = this.hydrateMissionSnapshot(input.controlSnapshot.missionRuntime, {
            repositoryRootPath: input.repositoryRootPath
        });

        mission.setRouteState({
            controlSnapshot: input.controlSnapshot,
            worktreePath: input.repositoryRootPath
        });
        this.setActiveMission(mission);
        this.setActiveMissionOutline(toMissionOutline(input.controlSnapshot));
        return mission;
    }

    public reset(): void {
        this.repositories.clear();
        this.runtimes.clear();
        this.#isInitialized = false;
        this.#repositoryLoadPromise = null;
        this.airportHomeState = undefined;
        this.airportHomeLoading = false;
        this.airportHomeError = undefined;
        this.repositoriesLoading = false;
        this.repositoriesError = undefined;
        this.addRepositoryState = undefined;
        this.addRepositoryPending = false;
        this.repositoriesState = [];
        this.activeRepository = undefined;
        this.activeMission = undefined;
        this.activeRepositoryId = undefined;
        this.activeRepositoryRootPath = undefined;
        this.activeMissionId = undefined;
        this.activeMissionOutline = undefined;
        this.activeMissionSelectedNodeId = undefined;
    }

    private getRuntime(repositoryRootPath?: string): AirportClientRuntime {
        const runtimeKey = repositoryRootPath?.trim() || '__default__';
        let runtime = this.runtimes.get(runtimeKey);
        if (!runtime) {
            runtime = new AirportClientRuntime({
                ...this.input,
                ...(repositoryRootPath?.trim()
                    ? { repositoryRootPath: repositoryRootPath.trim() }
                    : {})
            });
            this.runtimes.set(runtimeKey, runtime);
        }

        return runtime;
    }

    private async loadRepositories(input: {
        force?: boolean;
    } = {}): Promise<SidebarRepositorySummary[]> {
        if (!input.force) {
            if (this.#repositoryLoadPromise) {
                return await this.#repositoryLoadPromise;
            }

            if (this.repositoriesState.length > 0) {
                return this.repositoriesState;
            }
        }

        this.repositoriesLoading = true;
        this.repositoriesError = undefined;

        const loadPromise = this.listRepositories()
            .then((repositories) => {
                this.setRepositories(repositories);
                return repositories;
            })
            .catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                this.repositoriesError = message;
                throw error;
            })
            .finally(() => {
                this.repositoriesLoading = false;
                if (this.#repositoryLoadPromise === loadPromise) {
                    this.#repositoryLoadPromise = null;
                }
            });

        this.#repositoryLoadPromise = loadPromise;
        return await loadPromise;
    }

    private unwrapRemoteQueryValue<T>(value: RemoteQueryValue<T> | null | undefined): T | undefined {
        if (!value || typeof value !== 'object') {
            return value ?? undefined;
        }

        if ('current' in value && value.current) {
            return value.current;
        }

        return value as T;
    }

    private requireMissionSnapshotBundle(input: MissionSnapshotBundle | undefined): MissionSnapshotBundle {
        if (input?.repositorySnapshot?.repository && input.missionControl && input.missionWorktreePath) {
            return input;
        }

        throw new Error('Mission snapshot bundle is missing repository snapshot or mission runtime state.');
    }

    private requireRepositorySnapshotBundle(input: RepositorySnapshotBundle | undefined): RepositorySnapshotBundle {
        if (input?.repositorySnapshot?.repository && Array.isArray(input.airportRepositories)) {
            return input;
        }

        throw new Error('Repository snapshot bundle is missing repository snapshot or airport repositories.');
    }

    private requireAirportRouteData(input: AirportRouteData | undefined): AirportRouteData {
        if (input?.airportHome?.repositories && Array.isArray(input.githubRepositories)) {
            return input;
        }

        throw new Error('Airport route data is missing home snapshot state.');
    }

    private async listRepositories(): Promise<SidebarRepositorySummary[]> {
        return z.array(repositorySchema).parse(
            await qry({
                reference: { entity: 'Airport' },
                method: 'listRepositories',
                args: {}
            }).run()
        );
    }

    private async getRepository(repositoryId: string): Promise<Repository> {
        const existing = this.repositories.get(repositoryId);
        if (existing) {
            await existing.refresh();
            return existing;
        }

        return this.hydrateRepositoryData(
            await this.loadRepositorySnapshot({ repositoryId })
        );
    }

    private async loadRepositorySnapshot(input: {
        repositoryId: string;
        repositoryRootPath?: string;
    }): Promise<RepositorySurfaceSnapshot> {
        return repositorySurfaceSnapshotSchema.parse(
            await qry({
                reference: {
                    entity: 'Repository',
                    repositoryId: input.repositoryId,
                    ...(input.repositoryRootPath
                        ? { repositoryRootPath: input.repositoryRootPath }
                        : {})
                },
                method: 'read',
                args: {}
            }).run()
        );
    }

    private mergeRepositories(
        repositories: SidebarRepositorySummary[],
        repositorySnapshot: RepositorySurfaceSnapshot
    ): SidebarRepositorySummary[] {
        return repositories.some(
            (candidate) => candidate.repositoryId === repositorySnapshot.repository.repositoryId
        )
            ? repositories.map((candidate) =>
                candidate.repositoryId === repositorySnapshot.repository.repositoryId
                    ? {
                        ...candidate,
                        missions: repositorySnapshot.missions
                    }
                    : candidate
            )
            : [
                {
                    ...repositorySnapshot.repository,
                    missions: repositorySnapshot.missions
                },
                ...repositories
            ];
    }

    private applyAirportHomeSnapshot(snapshot: AirportRouteData['airportHome']): void {
        this.setRepositories(snapshot.repositories);
        const selectedRepository = snapshot.selectedRepositoryRoot
            ? snapshot.repositories.find(
                (repository) => repository.repositoryRootPath === snapshot.selectedRepositoryRoot
            )
            : undefined;
        const activeRepository = selectedRepository
            ? this.repositories.get(selectedRepository.repositoryId)
            : undefined;

        if (
            activeRepository
            && activeRepository.repositoryRootPath === selectedRepository?.repositoryRootPath
        ) {
            this.setActiveRepository(activeRepository);
        } else {
            this.activeRepository = undefined;
            this.activeRepositoryId = selectedRepository?.repositoryId;
            this.activeRepositoryRootPath = selectedRepository?.repositoryRootPath;
        }

        this.setActiveMission(undefined);
        this.setActiveMissionOutline(undefined);
        this.setActiveMissionSelectedNodeId(undefined);
    }
}

function toMissionOutline(snapshot: MissionControlSnapshot): ActiveMissionOutline {
    return {
        title: snapshot.operatorStatus.title,
        currentStageId: snapshot.operatorStatus.workflow?.currentStageId,
        briefPath: snapshot.operatorStatus.productFiles?.brief,
        treeNodes: snapshot.operatorStatus.tower?.treeNodes ?? []
    };
}

export function createAirportApplication(input: {
    fetch?: typeof fetch;
    createEventSource?: EventSourceFactory;
} = {}): AirportApplication {
    void input;
    return app;
}

export const app = new AirportApplication();
import { repositorySnapshotSchema } from '@flying-pillow/mission-core/entities/Repository/RepositorySchema';
import type { RepositorySnapshot } from '@flying-pillow/mission-core/entities/Repository/RepositorySchema';
import type { MissionSnapshot } from '@flying-pillow/mission-core/entities/Mission/MissionSchema';
import type { AirportRuntimeEventEnvelope } from '$lib/contracts/runtime-events';
import type { ActiveMissionOutline } from '$lib/client/context/app-context.svelte';
import { GithubRepository } from '$lib/components/entities/Repository/GithubRepository.svelte.js';
import { Repository } from '$lib/components/entities/Repository/Repository.svelte.js';
import {
    getRepositoryDisplayDescription,
    getRepositoryDisplayName
} from '$lib/components/entities/Repository/Repository.svelte.js';
import type { Mission } from '$lib/components/entities/Mission/Mission.svelte.js';
import { setApp } from '$lib/client/globals';
import { AirportClientRuntime } from '$lib/client/runtime/AirportClientRuntime';
import type { RuntimeSubscription } from '$lib/client/runtime/transport/EntityRuntimeTransport';
import { qry } from '../../routes/api/entities/remote/query.remote';
import type {
    AirportRepositoryListItem,
    GitHubVisibleRepositorySummary,
    SidebarRepositorySummary
} from '$lib/components/entities/types';

type EventSourceFactory = (url: string) => EventSource;

type AddRepositoryState = {
    error?: string;
    success?: boolean;
    repositoryPath?: string;
    githubRepository?: string;
};

export class AirportApplication {
    private readonly repositories = new Map<string, Repository>();
    private readonly runtimes = new Map<string, AirportClientRuntime>();
    private repositoryVersion = $state(0);
    #isInitialized = false;
    #repositoryLoadPromise: Promise<Repository[]> | null = null;
    #githubRepositoryLoadPromise: Promise<GitHubVisibleRepositorySummary[]> | null = null;
    public githubRepositoriesState = $state<GitHubVisibleRepositorySummary[]>([]);
    public githubRepositoriesLoading = $state(false);
    public githubRepositoriesError = $state<string | undefined>();
    public addRepositoryState = $state<AddRepositoryState | undefined>();
    public addRepositoryPending = $state(false);
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

        this.#isInitialized = true;

        try {
            await this.loadRepositories();
        } catch (error) {
            this.#isInitialized = false;
            throw error;
        }
    }

    public get repositoriesState(): SidebarRepositorySummary[] {
        this.repositoryVersion;
        return [...this.repositories.values()].map((repository) => ({
            ...repository.summary,
            missions: repository.missions
        }));
    }

    public get repositoryListItems(): AirportRepositoryListItem[] {
        const localRepositories = this.repositoriesState;
        const githubRepositories = this.githubRepositoriesState;
        const localByGitHubRepository = new Map<string, SidebarRepositorySummary>();

        for (const repository of localRepositories) {
            const githubRepository = repository.githubRepository?.trim().toLowerCase();
            if (githubRepository) {
                localByGitHubRepository.set(githubRepository, repository);
            }
        }

        const items = localRepositories.map((repository): AirportRepositoryListItem => {
            const github = repository.githubRepository
                ? githubRepositories.find((candidate) => candidate.fullName.toLowerCase() === repository.githubRepository?.toLowerCase())
                : undefined;
            return createRepositoryListItem({ local: repository, github });
        });

        for (const github of githubRepositories) {
            if (localByGitHubRepository.has(github.fullName.toLowerCase())) {
                continue;
            }
            items.push(createRepositoryListItem({ github }));
        }

        return items.sort((left, right) => Number(right.isLocal) - Number(left.isLocal) || left.displayName.localeCompare(right.displayName));
    }

    public get activeRepository(): Repository | undefined {
        const activeRepositoryId = this.activeRepositoryId;
        if (!activeRepositoryId) {
            return undefined;
        }

        return this.resolveRepository(activeRepositoryId);
    }

    public get activeMission(): Mission | undefined {
        return this.activeRepository?.selectedMission;
    }

    public hydrateRepositoryData(
        snapshot: RepositorySnapshot
    ): Repository {
        const id = snapshot.repository.id;
        const existing = this.repositories.get(id);
        if (existing) {
            existing.applyData(snapshot);
            this.repositoryVersion += 1;
            return existing;
        }

        const created = new Repository(snapshot, {
            loadSnapshot: (input) => this.loadRepositorySnapshot(input),
            resolveMission: (missionSnapshot) => this.hydrateMissionSnapshot(missionSnapshot)
        });
        this.repositories.set(id, created);
        this.repositoryVersion += 1;
        return created;
    }

    public reconcileRepositories(snapshots: RepositorySnapshot[]): Repository[] {
        const nextRepositories = new Map<string, Repository>();
        const repositories = snapshots.map((snapshot) => {
            const repository = this.hydrateRepositoryData(snapshot);
            nextRepositories.set(repository.id, repository);
            return repository;
        });

        this.repositories.clear();
        for (const [repositoryId, repository] of nextRepositories.entries()) {
            this.repositories.set(repositoryId, repository);
        }
        this.repositoryVersion += 1;

        return repositories;
    }

    public seedRepositoryFromSummary(summary: SidebarRepositorySummary): Repository {
        const { missions, ...repository } = summary;

        return this.hydrateRepositoryData(repositorySnapshotSchema.parse({
            repository,
            missions: missions ?? []
        }));
    }

    public hydrateMissionSnapshot(
        snapshot: MissionSnapshot,
        input: {
            repositoryRootPath?: string;
        } = {}
    ) {
        return this.getRuntime(input.repositoryRootPath).hydrateMissionSnapshot(snapshot);
    }

    public resolveRepository(repositoryId: string): Repository | undefined {
        this.repositoryVersion;
        return this.repositories.get(repositoryId);
    }

    public setRepositories(repositories: SidebarRepositorySummary[]): void {
        const nextRepositories = new Map<string, Repository>();
        for (const summary of repositories) {
            const repository = this.seedRepositoryFromSummary(summary);
            nextRepositories.set(repository.id, repository);
        }

        this.repositories.clear();
        for (const [repositoryId, repository] of nextRepositories.entries()) {
            this.repositories.set(repositoryId, repository);
        }
        this.repositoryVersion += 1;
    }

    public async loadRepositories(input: {
        force?: boolean;
    } = {}): Promise<Repository[]> {
        if (!input.force) {
            if (this.#repositoryLoadPromise) {
                return await this.#repositoryLoadPromise;
            }

            if (this.repositories.size > 0) {
                return [...this.repositories.values()];
            }
        }

        const loadPromise = Repository.find({ run: true })
            .finally(() => {
                if (this.#repositoryLoadPromise === loadPromise) {
                    this.#repositoryLoadPromise = null;
                }
            });

        this.#repositoryLoadPromise = loadPromise;
        return await loadPromise;
    }

    public async loadGitHubRepositories(input: {
        force?: boolean;
    } = {}): Promise<GitHubVisibleRepositorySummary[]> {
        if (!input.force) {
            if (this.#githubRepositoryLoadPromise) {
                return await this.#githubRepositoryLoadPromise;
            }

            if (this.githubRepositoriesState.length > 0 || this.githubRepositoriesError) {
                return this.githubRepositoriesState;
            }
        }

        this.githubRepositoriesLoading = true;
        this.githubRepositoriesError = undefined;

        const loadPromise = GithubRepository.find()
            .then((repositories) => {
                this.githubRepositoriesState = structuredClone(repositories);
                return this.githubRepositoriesState;
            })
            .catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                this.githubRepositoriesState = [];
                this.githubRepositoriesError = message;
                throw error;
            })
            .finally(() => {
                this.githubRepositoriesLoading = false;
                if (this.#githubRepositoryLoadPromise === loadPromise) {
                    this.#githubRepositoryLoadPromise = null;
                }
            });

        this.#githubRepositoryLoadPromise = loadPromise;
        return await loadPromise;
    }

    public async addRepository(input: {
        repositoryPath: string;
        githubRepository?: string;
    }): Promise<Repository> {
        this.addRepositoryPending = true;
        this.addRepositoryState = {
            repositoryPath: input.repositoryPath,
            ...(input.githubRepository ? { githubRepository: input.githubRepository } : {})
        };

        try {
            const repository = input.githubRepository
                ? this.hydrateRepositoryData(await GithubRepository.clone({
                    githubRepository: input.githubRepository,
                    destinationPath: input.repositoryPath
                }))
                : await Repository.add(input.repositoryPath);

            await this.loadRepositories({ force: true });
            this.addRepositoryState = {
                success: true,
                repositoryPath: repository.repositoryRootPath,
                ...(input.githubRepository ? { githubRepository: input.githubRepository } : {})
            };
            return repository;
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

    public async openRepositoryRoute(id: string): Promise<Repository> {
        await this.initialize();

        const repository = this.hydrateRepositoryData(
            await this.loadRepositorySnapshot({ id })
        );

        this.setActiveRepositorySelection({
            id: repository.id,
            repositoryRootPath: repository.repositoryRootPath
        });
        this.setActiveMissionSelection(repository.selectedMission?.missionId);
        this.setActiveMissionOutline(undefined);
        this.setActiveMissionSelectedNodeId(undefined);

        return repository;
    }

    public async refreshMission(input: {
        missionId: string;
        repositoryRootPath?: string;
    }) {
        return await this.getRuntime(input.repositoryRootPath).refreshMission(input.missionId);
    }

    public observeMission(input: {
        missionId: string;
        repositoryRootPath?: string;
        onUpdate?: (mission: ReturnType<AirportClientRuntime['hydrateMissionSnapshot']>, event: AirportRuntimeEventEnvelope) => void;
        onError?: (error: Error) => void;
    }): RuntimeSubscription {
        return this.getRuntime(input.repositoryRootPath).observeMission(input);
    }

    public setActiveRepositorySelection(input?: {
        id?: string;
        repositoryRootPath?: string;
    }): void {
        this.activeRepositoryId = input?.id?.trim() || undefined;
        this.activeRepositoryRootPath = input?.repositoryRootPath?.trim() || undefined;
    }

    public setActiveMissionSelection(missionId?: string): void {
        this.activeMissionId = missionId?.trim() || undefined;
    }

    public setActiveMissionOutline(outline?: ActiveMissionOutline): void {
        this.activeMissionOutline = outline;
    }

    public setActiveMissionSelectedNodeId(nodeId?: string): void {
        this.activeMissionSelectedNodeId = nodeId;
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

    private async loadRepositorySnapshot(input: {
        id: string;
        repositoryRootPath?: string;
    }): Promise<RepositorySnapshot> {
        return repositorySnapshotSchema.parse(
            await qry({
                entity: 'Repository',
                method: 'read',
                payload: {
                    id: input.id,
                    ...(input.repositoryRootPath
                        ? { repositoryRootPath: input.repositoryRootPath }
                        : {})
                }
            }).run()
        );
    }

}

function createRepositoryListItem(input: {
    local?: SidebarRepositorySummary;
    github?: GitHubVisibleRepositorySummary;
}): AirportRepositoryListItem {
    const githubDescription = input.github?.description?.trim();
    const localDescription = input.local ? getRepositoryDisplayDescription(input.local) : undefined;
    return {
        key: input.local?.id ?? `github:${input.github?.fullName ?? 'unknown'}`,
        ...(input.local ? { local: input.local } : {}),
        ...(input.github ? { github: input.github } : {}),
        displayName: input.github?.fullName ?? (input.local ? getRepositoryDisplayName(input.local) : 'Repository'),
        displayDescription: githubDescription || localDescription || input.github?.htmlUrl || 'No description available',
        repositoryRootPath: input.local?.repositoryRootPath,
        githubRepository: input.github?.fullName ?? input.local?.githubRepository,
        missions: input.local?.missions ?? [],
        isLocal: input.local !== undefined
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
// /apps/airport/web/src/lib/client/context/app-context.svelte.ts: App-wide client context for daemon identity, repository shell state, and active Airport selection.
import { createContext } from "svelte";
import { app, type AirportApplication } from "$lib/client/Application.svelte.js";
import type { Mission } from "$lib/client/entities/Mission.svelte.js";
import type { Repository } from "$lib/client/entities/Repository.svelte.js";
import type {
    AirportRuntimeEventEnvelope,
    MissionRuntimeSnapshot,
    RepositorySurfaceSnapshot,
} from "@flying-pillow/mission-core/airport/runtime";
import type { MissionTowerTreeNode } from "@flying-pillow/mission-core/types.js";
import type { SidebarRepositorySummary } from "$lib/components/entities/types";
import type { RuntimeSubscription } from "$lib/client/runtime/transport/EntityRuntimeTransport";

export type GithubStatus = "connected" | "disconnected" | "unknown";

export type AppContextServerValue = {
    daemon: {
        running: boolean;
        startedByHook: boolean;
        message: string;
        endpointPath?: string;
        lastCheckedAt: string;
        nextRetryAt?: string;
        failureCount?: number;
    };
    githubStatus: GithubStatus;
    user?: {
        name: string;
        email?: string;
        avatarUrl?: string;
        githubStatus: GithubStatus;
    };
};

export type ActiveMissionOutline = {
    title?: string;
    currentStageId?: string;
    briefPath?: string;
    treeNodes: MissionTowerTreeNode[];
};

export type AppContextValue = {
    readonly application: AirportApplication;
    daemon: AppContextServerValue["daemon"];
    githubStatus: GithubStatus;
    user?: AppContextServerValue["user"];
    airport: {
        repositories: SidebarRepositorySummary[];
        activeRepository?: Repository;
        activeRepositoryId?: string;
        activeRepositoryRootPath?: string;
        activeMission?: Mission;
        activeMissionId?: string;
        activeMissionOutline?: ActiveMissionOutline;
        activeMissionSelectedNodeId?: string;
    };
    syncServerContext(next: AppContextServerValue): void;
    syncRepositoryData(input: {
        airportRepositories: SidebarRepositorySummary[];
        repositorySnapshot: RepositorySurfaceSnapshot;
    }): Repository;
    syncMissionRuntime(input: {
        snapshot: MissionRuntimeSnapshot;
        repositoryRootPath?: string;
    }): Mission;
    refreshMission(input: {
        missionId: string;
        repositoryRootPath?: string;
    }): Promise<Mission>;
    observeMission(input: {
        missionId: string;
        repositoryRootPath?: string;
        onUpdate?: (mission: Mission, event: AirportRuntimeEventEnvelope) => void;
        onError?: (error: Error) => void;
    }): RuntimeSubscription;
    setRepositories(repositories: SidebarRepositorySummary[]): void;
    setActiveRepository(input?: {
        repositoryId?: string;
        repositoryRootPath?: string;
    }): void;
    setActiveMission(missionId?: string): void;
    setActiveMissionOutline(next?: ActiveMissionOutline): void;
    setActiveMissionSelectedNodeId(nodeId?: string): void;
};

const [getAppContext, setAppContext] = createContext<AppContextValue>();

export { getAppContext, setAppContext };

export function createAppContext(
    initial: AppContextServerValue | (() => AppContextServerValue),
): AppContextValue {
    const initialValue =
        typeof initial === "function" ? initial() : initial;
    const state = $state({
        application: app,
        daemon: initialValue.daemon,
        githubStatus: initialValue.githubStatus,
        user: initialValue.user,
        airport: {
            repositories: [] as SidebarRepositorySummary[],
        },
    });

    return {
        get application() {
            return state.application;
        },
        get daemon() {
            return state.daemon;
        },
        get githubStatus() {
            return state.githubStatus;
        },
        get user() {
            return state.user;
        },
        get airport() {
            return {
                repositories: state.application.repositoriesState,
                activeRepository: state.application.activeRepository,
                activeRepositoryId: state.application.activeRepositoryId,
                activeRepositoryRootPath: state.application.activeRepositoryRootPath,
                activeMission: state.application.activeMission,
                activeMissionId: state.application.activeMissionId,
                activeMissionOutline: state.application.activeMissionOutline,
                activeMissionSelectedNodeId: state.application.activeMissionSelectedNodeId,
            };
        },
        syncServerContext(next) {
            state.daemon = next.daemon;
            state.githubStatus = next.githubStatus;
            state.user = next.user;
        },
        syncRepositoryData(input) {
            const repository = state.application.hydrateRepositoryData(
                input.repositorySnapshot,
            );
            const repositories = input.airportRepositories.some(
                (candidate) =>
                    candidate.repositoryId ===
                    input.repositorySnapshot.repository.repositoryId,
            )
                ? input.airportRepositories.map((candidate) =>
                    candidate.repositoryId ===
                        input.repositorySnapshot.repository.repositoryId
                        ? {
                            ...candidate,
                            missions: input.repositorySnapshot.missions,
                        }
                        : candidate,
                )
                : [
                    {
                        ...input.repositorySnapshot.repository,
                        missions: input.repositorySnapshot.missions,
                    },
                    ...input.airportRepositories,
                ];

            state.application.setRepositories(repositories);
            state.application.setActiveRepository(repository);
            state.application.setActiveMission(repository.selectedMission);
            return repository;
        },
        syncMissionRuntime(input) {
            const mission = state.application.hydrateMissionSnapshot(
                input.snapshot,
                { repositoryRootPath: input.repositoryRootPath },
            );
            return mission;
        },
        async refreshMission(input) {
            return state.application.refreshMission(input);
        },
        observeMission(input) {
            return state.application.observeMission({
                ...input,
                onUpdate: (mission, event) => {
                    input.onUpdate?.(mission, event);
                },
            });
        },
        setRepositories(repositories) {
            state.application.setRepositories(repositories);
        },
        setActiveRepository(input) {
            const repositoryId = input?.repositoryId?.trim() || undefined;
            const repositoryRootPath =
                input?.repositoryRootPath?.trim() || undefined;
            state.application.activeRepositoryId = repositoryId;
            state.application.activeRepositoryRootPath = repositoryRootPath;
            if (
                state.application.activeRepository &&
                state.application.activeRepository.repositoryId !== repositoryId
            ) {
                state.application.activeRepository = undefined;
            }
        },
        setActiveMission(missionId) {
            state.application.activeMissionId = missionId?.trim() || undefined;
            if (
                state.application.activeMission &&
                state.application.activeMission.missionId !==
                state.application.activeMissionId
            ) {
                state.application.activeMission = undefined;
            }
        },
        setActiveMissionOutline(next) {
            state.application.setActiveMissionOutline(next
                ? {
                    title: next.title?.trim() || undefined,
                    currentStageId: next.currentStageId?.trim() || undefined,
                    treeNodes: [...next.treeNodes],
                }
                : undefined);
        },
        setActiveMissionSelectedNodeId(nodeId) {
            state.application.setActiveMissionSelectedNodeId(
                nodeId?.trim() || undefined,
            );
        },
    };
}
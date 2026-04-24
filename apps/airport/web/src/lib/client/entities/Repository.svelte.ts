// /apps/airport/web/src/lib/client/entities/Repository.svelte.ts: OO browser entity for repository data with remote issue and mission commands.
import type {
    GitHubIssueDetail,
    MissionRuntimeSnapshot,
    RepositorySurfaceSnapshot,
    TrackedIssueSummary
} from '@flying-pillow/mission-core/airport/runtime';
import {
    githubIssueDetailSchema,
    trackedIssueSummarySchema
} from '@flying-pillow/mission-core/airport/runtime';
import { z } from 'zod/v4';
import { cmd } from '../../../routes/api/entities/remote/command.remote';
import { qry } from '../../../routes/api/entities/remote/query.remote';
import type { EntityModel } from '$lib/client/entities/EntityModel.svelte.js';
import { Mission } from '$lib/client/entities/Mission.svelte.js';

export type RepositoryMissionResolver = (snapshot: MissionRuntimeSnapshot) => Mission;
export type RepositorySnapshotLoader = (input: {
    repositoryId: string;
    repositoryRootPath?: string;
}) => Promise<RepositorySurfaceSnapshot>;

export class Repository implements EntityModel<RepositorySurfaceSnapshot> {
    private dataState = $state<RepositorySurfaceSnapshot | undefined>();
    private readonly loadSnapshot: RepositorySnapshotLoader;
    private readonly resolveMission: RepositoryMissionResolver;
    private selectedMissionState = $state<Mission | undefined>();

    public constructor(
        snapshot: RepositorySurfaceSnapshot,
        input: {
            loadSnapshot: RepositorySnapshotLoader;
            resolveMission: RepositoryMissionResolver;
        }
    ) {
        this.data = snapshot;
        this.loadSnapshot = input.loadSnapshot;
        this.resolveMission = input.resolveMission;
        this.selectedMissionModel = this.createSelectedMission(snapshot.selectedMission);
    }

    private get data(): RepositorySurfaceSnapshot {
        const data = this.dataState;
        if (!data) {
            throw new Error('Repository data is not initialized.');
        }

        return data;
    }

    private set data(snapshot: RepositorySurfaceSnapshot) {
        this.dataState = structuredClone(snapshot);
    }

    private get selectedMissionModel(): Mission | undefined {
        return this.selectedMissionState;
    }

    private set selectedMissionModel(mission: Mission | undefined) {
        this.selectedMissionState = mission;
    }

    public get repositoryId(): string {
        return this.data.repository.repositoryId;
    }

    public get id(): string {
        return this.repositoryId;
    }

    public get repositoryRootPath(): string {
        return this.data.repository.repositoryRootPath;
    }

    public get label(): string {
        return this.data.repository.label;
    }

    public get summary(): RepositorySurfaceSnapshot['repository'] {
        return structuredClone($state.snapshot(this.data.repository));
    }

    public get selectedMissionId(): string | undefined {
        return this.data.selectedMissionId;
    }

    public get selectedMission(): Mission | undefined {
        return this.selectedMissionModel;
    }

    public get missions(): RepositorySurfaceSnapshot['missions'] {
        return structuredClone($state.snapshot(this.data.missions));
    }

    public get operationalMode(): string | undefined {
        return this.data.operationalMode;
    }

    public get controlRoot(): string | undefined {
        return this.data.controlRoot;
    }

    public get currentBranch(): string | undefined {
        return this.data.currentBranch;
    }

    public get settingsComplete(): boolean | undefined {
        return this.data.settingsComplete;
    }

    public get githubRepository(): string | undefined {
        return this.data.githubRepository;
    }

    public get missionCountLabel(): string {
        return this.data.missions.length === 1
            ? '1 mission'
            : `${this.data.missions.length} missions`;
    }

    public updateFromSnapshot(snapshot: RepositorySurfaceSnapshot): this {
        this.data = snapshot;

        if (!snapshot.selectedMission) {
            this.selectedMissionModel = undefined;
            return this;
        }

        if (this.selectedMissionModel?.missionId === snapshot.selectedMission.missionId) {
            this.selectedMissionModel.updateFromSnapshot(snapshot.selectedMission);
            return this;
        }

        this.selectedMissionModel = this.createSelectedMission(snapshot.selectedMission);
        return this;
    }

    public applyData(snapshot: RepositorySurfaceSnapshot): this {
        return this.updateFromSnapshot(snapshot);
    }

    public async refresh(): Promise<this> {
        return this.updateFromSnapshot(
            await this.loadSnapshot({
                repositoryId: this.repositoryId,
                repositoryRootPath: this.repositoryRootPath
            })
        );
    }

    public applySummary(input: RepositorySurfaceSnapshot['repository']): this {
        const dataSnapshot = $state.snapshot(this.dataState);
        if (!dataSnapshot) {
            throw new Error('Repository data is not initialized.');
        }

        this.data = {
            ...dataSnapshot,
            repository: structuredClone(input)
        };
        return this;
    }

    public toSnapshot(): RepositorySurfaceSnapshot {
        return structuredClone($state.snapshot(this.data));
    }

    public toJSON(): RepositorySurfaceSnapshot {
        return this.toSnapshot();
    }

    public async listIssues(): Promise<TrackedIssueSummary[]> {
        return z.array(trackedIssueSummarySchema).parse(
            await qry({
                reference: {
                    entity: 'Repository',
                    repositoryId: this.repositoryId,
                    repositoryRootPath: this.repositoryRootPath
                },
                method: 'listIssues',
                args: {}
            }).run()
        );
    }

    public async getIssue(issueNumber: number): Promise<GitHubIssueDetail> {
        return githubIssueDetailSchema.parse(
            await qry({
                reference: {
                    entity: 'Repository',
                    repositoryId: this.repositoryId,
                    repositoryRootPath: this.repositoryRootPath
                },
                method: 'getIssue',
                args: {
                    issueNumber
                }
            }).run()
        );
    }

    public async startMissionFromIssue(issueNumber: number): Promise<{ missionId: string; redirectTo: string }> {
        return await cmd({
            reference: {
                entity: 'Repository',
                repositoryId: this.repositoryId
            },
            method: 'startMissionFromIssue',
            args: {
                issueNumber
            }
        });
    }

    public async startMissionFromBrief(input: {
        title: string;
        body: string;
        type: 'feature' | 'fix' | 'docs' | 'refactor' | 'task';
    }): Promise<{ missionId: string; redirectTo: string }> {
        return await cmd({
            reference: {
                entity: 'Repository',
                repositoryId: this.repositoryId
            },
            method: 'startMissionFromBrief',
            args: input
        });
    }

    private createSelectedMission(snapshot?: MissionRuntimeSnapshot): Mission | undefined {
        if (!snapshot) {
            return undefined;
        }

        return this.resolveMission(snapshot);
    }
}
import { Entity } from '../Entity.js';
import type {
	GitHubIssueDetail,
	GitHubVisibleRepository,
	MissionBrief,
	OperatorActionDescriptor,
	OperatorActionFlowDescriptor,
	OperatorStatus,
	OperatorActionListSnapshot,
	MissionSelectionCandidate,
	RepositoryControlStatus,
	TrackedIssueSummary,
	RepositoryCandidate
} from '../../types.js';
import {
	getDefaultMissionDaemonSettingsWithOverrides,
	readMissionDaemonSettings
} from '../../lib/daemonConfig.js';
import {
	listRegisteredRepositories,
	registerMissionRepo
} from '../../lib/config.js';
import {
	GitHubPlatformAdapter,
	type GitHubBranchSyncStatus,
	resolveGitHubRepositoryFromWorkspace
} from '../../platforms/GitHubPlatformAdapter.js';
import { deriveRepositoryIdentity } from '../../lib/repositoryIdentity.js';
import { refreshSystemStatus } from '../../system/SystemStatus.js';
import type {
	ControlGitHubIssueDetail,
	ControlGitHubRepositoriesClone
} from '../../daemon/protocol/contracts.js';
import type { ControlSource } from '../../daemon/control-plane/types.js';
import {
	missionReferenceSchema,
	repositorySchema,
	type MissionReference,
	type RepositoryData,
	type RepositoryStateSnapshot
} from './RepositorySchema.js';
import type { RepositoryPlatformAdapter } from './PlatformAdapter.js';

export class Repository extends Entity<RepositoryData, string, OperatorActionListSnapshot> {

	public static fromCandidate(candidate: RepositoryCandidate): Repository {
		return new Repository(repositorySchema.parse({
			repositoryId: candidate.repositoryId,
			repositoryRootPath: candidate.repositoryRootPath,
			label: candidate.label,
			description: candidate.description,
			...(candidate.githubRepository ? { githubRepository: candidate.githubRepository } : {})
		}));
	}

	public static read(repositoryRootPath: string): Repository {
		const identity = deriveRepositoryIdentity(repositoryRootPath);
		return new Repository(repositorySchema.parse({
			repositoryId: identity.repositoryId,
			repositoryRootPath: identity.repositoryRootPath,
			label: identity.githubRepository?.split('/').pop() ?? identity.repositoryRootPath.split('/').pop() ?? identity.repositoryRootPath,
			description: identity.githubRepository ?? identity.repositoryRootPath,
			...(identity.githubRepository ? { githubRepository: identity.githubRepository } : {})
		}));
	}

	public static async find(): Promise<Repository[]> {
		return (await listRegisteredRepositories()).map((candidate) => Repository.fromCandidate(candidate));
	}

	public static fromStateSnapshot(snapshot: RepositoryStateSnapshot): Repository {
		const repository = new Repository(snapshot.repository ?? snapshot.data);
		const availableCommands = snapshot.availableCommands ?? snapshot.commands;
		if (availableCommands) {
			repository.replaceAvailableActionsSnapshot(availableCommands);
		}
		return repository;
	}

	public static toMissionReference(candidate: MissionSelectionCandidate): MissionReference {
		return missionReferenceSchema.parse({
			missionId: candidate.missionId,
			title: candidate.title,
			branchRef: candidate.branchRef,
			createdAt: candidate.createdAt,
			...(candidate.issueId !== undefined ? { issueId: candidate.issueId } : {})
		});
	}

	public constructor(snapshot: RepositoryData) {
		super(repositorySchema.parse(snapshot));
	}

	public get id(): string {
		return this.repositoryId;
	}

	public get repositoryId(): string {
		return this.data.repositoryId;
	}

	public get repositoryRootPath(): string {
		return this.data.repositoryRootPath;
	}

	public get label(): string {
		return this.data.label;
	}

	public get description(): string {
		return this.data.description;
	}

	public get githubRepository(): string | undefined {
		return this.data.githubRepository;
	}

	public get summary(): RepositoryData {
		return this.toSnapshot();
	}

	public listAvailableActionsSnapshot(): OperatorActionListSnapshot | undefined {
		return this.commands;
	}

	public replaceAvailableActionsSnapshot(snapshot: OperatorActionListSnapshot): this {
		this.commands = snapshot;
		return this;
	}

	public async listOpenIssues(limit = 50, authToken?: string): Promise<TrackedIssueSummary[]> {
		const platformAdapter = this.resolvePlatformAdapter(authToken, { requireRepository: true });
		if (!platformAdapter) {
			return [];
		}

		const normalizedToken = this.normalizeAuthToken(authToken);
		this.requireGitHubAuthentication(normalizedToken);
		const boundedLimit = Math.max(1, Math.min(200, Math.floor(limit)));
		refreshSystemStatus({
			cwd: this.repositoryRootPath,
			...(normalizedToken ? { authToken: normalizedToken } : {})
		});
		return platformAdapter.listOpenIssues(boundedLimit);
	}

	public async listVisibleGitHubRepositories(authToken?: string): Promise<GitHubVisibleRepository[]> {
		const platformAdapter = this.resolvePlatformAdapter(authToken);
		if (!platformAdapter) {
			return [];
		}
		const normalizedToken = this.normalizeAuthToken(authToken);
		this.requireGitHubAuthentication(normalizedToken);
		refreshSystemStatus({
			cwd: this.repositoryRootPath,
			...(normalizedToken ? { authToken: normalizedToken } : {})
		});
		return platformAdapter.listVisibleRepositories();
	}

	public async getGitHubIssueDetail(
		params: ControlGitHubIssueDetail,
		authToken?: string
	): Promise<GitHubIssueDetail> {
		const platformAdapter = this.resolvePlatformAdapter(authToken, { requireRepository: true });
		if (!platformAdapter) {
			throw new Error('Mission authorization requires the GitHub tracking provider.');
		}
		const normalizedToken = this.normalizeAuthToken(authToken);
		this.requireGitHubAuthentication(normalizedToken);
		const issueNumber = Number.isFinite(params.issueNumber) ? Math.floor(params.issueNumber) : NaN;
		if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
			throw new Error('GitHub issue detail requires a positive issue number.');
		}

		refreshSystemStatus({
			cwd: this.repositoryRootPath,
			...(normalizedToken ? { authToken: normalizedToken } : {})
		});
		return platformAdapter.fetchIssueDetail(String(issueNumber));
	}

	public async cloneGitHubRepository(
		params: ControlGitHubRepositoriesClone,
		authToken?: string
	): Promise<Repository> {
		const platformAdapter = this.resolvePlatformAdapter(authToken);
		if (!platformAdapter) {
			throw new Error('Mission authorization requires the GitHub tracking provider.');
		}
		const normalizedToken = this.normalizeAuthToken(authToken);
		this.requireGitHubAuthentication(normalizedToken);
		const githubRepository = params.githubRepository?.trim();
		const destinationPath = params.destinationPath?.trim();
		if (!githubRepository) {
			throw new Error('GitHub repository clone requires a repository name.');
		}
		if (!destinationPath) {
			throw new Error('GitHub repository clone requires a destination path.');
		}
		if (!destinationPath.startsWith('/')) {
			throw new Error('GitHub repository clone requires an absolute destination path on the daemon host.');
		}

		refreshSystemStatus({
			cwd: this.repositoryRootPath,
			...(normalizedToken ? { authToken: normalizedToken } : {})
		});
		const repositoryRootPath = await platformAdapter.cloneRepository({
			repository: githubRepository,
			destinationPath
		});
		await registerMissionRepo(repositoryRootPath);
		const registeredRepository = (await listRegisteredRepositories()).find(
			(candidate) => candidate.repositoryRootPath === repositoryRootPath
		);
		if (!registeredRepository) {
			throw new Error(`Mission could not register cloned repository '${githubRepository}'.`);
		}
		return Repository.fromCandidate(registeredRepository);
	}

	public async createMissionIssueBrief(input: {
		title: string;
		body: string;
	}, authToken?: string): Promise<MissionBrief> {
		const platformAdapter = this.resolvePlatformAdapter(authToken, { requireRepository: true });
		if (!platformAdapter) {
			throw new Error('Mission authorization requires the GitHub tracking provider.');
		}
		const normalizedToken = this.normalizeAuthToken(authToken);
		this.requireGitHubAuthentication(normalizedToken);
		refreshSystemStatus({
			cwd: this.repositoryRootPath,
			...(normalizedToken ? { authToken: normalizedToken } : {})
		});
		return platformAdapter.createIssue(input);
	}

	public async fetchMissionIssueBrief(issueNumber: number, authToken?: string): Promise<MissionBrief> {
		const platformAdapter = this.resolvePlatformAdapter(authToken, { requireRepository: true });
		if (!platformAdapter) {
			throw new Error('Mission authorization requires the GitHub tracking provider.');
		}
		const normalizedToken = this.normalizeAuthToken(authToken);
		this.requireGitHubAuthentication(normalizedToken);
		if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
			throw new Error('GitHub issue detail requires a positive issue number.');
		}
		refreshSystemStatus({
			cwd: this.repositoryRootPath,
			...(normalizedToken ? { authToken: normalizedToken } : {})
		});
		return platformAdapter.fetchIssue(String(issueNumber));
	}

	public getWorkspaceBranchSyncStatus(input: {
		workspaceRoot: string;
		branchRef: string;
		repository?: string;
		ghBinary?: string;
	}): GitHubBranchSyncStatus {
		const adapter = new GitHubPlatformAdapter(
			input.workspaceRoot,
			input.repository,
			input.ghBinary ? { ghBinary: input.ghBinary } : {}
		);
		adapter.fetchRemote('origin');
		return adapter.getBranchSyncStatus(input.branchRef, 'origin');
	}

	public pullWorkspaceBranch(input: {
		workspaceRoot: string;
		branchRef: string;
		repository?: string;
		ghBinary?: string;
	}): void {
		const adapter = new GitHubPlatformAdapter(
			input.workspaceRoot,
			input.repository,
			input.ghBinary ? { ghBinary: input.ghBinary } : {}
		);
		adapter.pullBranch(input.branchRef, 'origin');
	}

	public buildDiscoveryStatus(input: {
		control: RepositoryControlStatus;
		availableMissions?: MissionSelectionCandidate[];
		availableRepositories?: ControlSource['availableRepositories'];
	}): OperatorStatus {
		return {
			found: false,
			operationalMode: input.control.problems.length > 0 ? 'setup' : 'root',
			control: input.control,
			...(input.availableRepositories && input.availableRepositories.length > 0
				? { availableRepositories: input.availableRepositories }
				: {}),
			...(input.availableMissions && input.availableMissions.length > 0
				? { availableMissions: input.availableMissions }
				: {})
		};
	}

	public buildControlSource(input: {
		control: RepositoryControlStatus;
		availableRepositories?: ControlSource['availableRepositories'];
		availableMissions: MissionSelectionCandidate[];
		missionStatus?: OperatorStatus;
	}): ControlSource {
		return {
			repositoryId: this.repositoryId,
			repositoryRootPath: this.repositoryRootPath,
			control: input.control,
			availableRepositories: input.availableRepositories ?? [],
			availableMissions: input.availableMissions,
			...(input.missionStatus ? { missionStatus: input.missionStatus } : {})
		};
	}

	public buildDiscoveryAvailableActions(input: {
		control: RepositoryControlStatus;
		availableMissions: MissionSelectionCandidate[];
		openIssues: TrackedIssueSummary[];
		setupFlow: OperatorActionFlowDescriptor;
		missionStartFlow: OperatorActionFlowDescriptor;
		missionSwitchFlow: OperatorActionFlowDescriptor;
		missionIssueFlow: OperatorActionFlowDescriptor;
	}): OperatorActionDescriptor[] {
		const repositoryPresentationTargets = [{
			scope: 'repository' as const,
			targetId: this.repositoryId
		}];
		const issuesCommandEnabled =
			input.control.trackingProvider === 'github'
			&& input.control.issuesConfigured;
		const issuesCommandReason =
			input.control.trackingProvider !== 'github'
				? 'GitHub tracking is not configured for this repository.'
				: !input.control.issuesConfigured
					? 'GitHub repository configuration is incomplete.'
					: '';
		return [
			{
				id: 'control.repository.init',
				label: 'Prepare the first repository initialization mission',
				action: '/init',
				scope: 'mission',
				disabled: input.control.initialized,
				disabledReason: input.control.initialized ? 'This checkout already contains Mission control scaffolding.' : '',
				enabled: !input.control.initialized,
				ordering: { group: 'recovery' as const },
				ui: {
					toolbarLabel: 'INIT',
					requiresConfirmation: true,
					confirmationPrompt: 'Prepare the first Mission initialization worktree for this repository?'
				},
				presentationTargets: repositoryPresentationTargets,
				...(!input.control.initialized
					? { reason: 'Create the first mission worktree and scaffold repository control inside that branch-owned checkout.' }
					: {})
			},
			{
				id: 'control.setup.edit',
				label: 'Configure repository setup',
				action: '/setup',
				scope: 'mission',
				disabled: false,
				disabledReason: '',
				enabled: true,
				...(!input.control.settingsComplete ? { ordering: { group: 'recovery' as const } } : {}),
				ui: {
					toolbarLabel: 'SETTINGS',
					requiresConfirmation: false
				},
				presentationTargets: repositoryPresentationTargets,
				flow: input.setupFlow
			},
			{
				id: 'control.mission.start',
				label: 'Prepare a new mission brief',
				action: '/start',
				scope: 'mission',
				disabled: false,
				disabledReason: '',
				enabled: true,
				ui: {
					toolbarLabel: 'PREPARE MISSION',
					requiresConfirmation: false
				},
				presentationTargets: repositoryPresentationTargets,
				flow: input.missionStartFlow
			},
			{
				id: 'control.mission.select',
				label: 'Select a local mission',
				action: '/select',
				scope: 'mission',
				disabled: input.availableMissions.length === 0,
				disabledReason: input.availableMissions.length > 0 ? '' : 'No local missions are available.',
				enabled: input.availableMissions.length > 0,
				ui: {
					toolbarLabel: 'OPEN MISSION',
					requiresConfirmation: false
				},
				presentationTargets: repositoryPresentationTargets,
				flow: input.missionSwitchFlow,
				...(input.availableMissions.length > 0 ? {} : { reason: 'No local missions are available.' })
			},
			{
				id: 'control.mission.from-issue',
				label: 'Prepare a mission from an open GitHub issue',
				action: '/issues',
				scope: 'mission',
				disabled: !issuesCommandEnabled,
				disabledReason: issuesCommandReason,
				enabled: issuesCommandEnabled,
				ui: {
					toolbarLabel: 'ISSUES',
					requiresConfirmation: false
				},
				presentationTargets: repositoryPresentationTargets,
				flow: input.missionIssueFlow,
				...(issuesCommandEnabled ? {} : { reason: issuesCommandReason })
			}
		];
	}

	public buildControlActionRevision(control: RepositoryControlStatus): string {
		return JSON.stringify({
			scope: 'control',
			settingsPath: control.settingsPath,
			settingsComplete: control.settingsComplete,
			availableMissionCount: control.availableMissionCount,
			currentBranch: control.currentBranch ?? null,
			trackingProvider: control.trackingProvider ?? null
		});
	}

	public buildControlActionsSnapshot(input: {
		control: RepositoryControlStatus;
		actions: OperatorActionDescriptor[];
	}): OperatorActionListSnapshot {
		return {
			actions: input.actions,
			revision: this.buildControlActionRevision(input.control)
		};
	}

	public override toStateSnapshot(): RepositoryStateSnapshot {
		const repository = this.toSnapshot();
		const availableCommands = this.listAvailableActionsSnapshot();
		return {
			data: repository,
			repository,
			...(availableCommands ? { commands: availableCommands, availableCommands } : {})
		};
	}

	private resolvePlatformAdapter(
		authToken?: string,
		options: {
			requireRepository?: boolean;
		} = {}
	): RepositoryPlatformAdapter | undefined {
		const settings = getDefaultMissionDaemonSettingsWithOverrides(
			readMissionDaemonSettings(this.repositoryRootPath) ?? {}
		);
		if (settings.trackingProvider !== 'github') {
			return undefined;
		}

		const githubRepository = resolveGitHubRepositoryFromWorkspace(this.repositoryRootPath);
		if (options.requireRepository && !githubRepository) {
			throw new Error('Mission could not resolve a GitHub repository from the current workspace.');
		}

		const normalizedToken = this.normalizeAuthToken(authToken);
		return new GitHubPlatformAdapter(
			this.repositoryRootPath,
			githubRepository,
			normalizedToken ? { authToken: normalizedToken } : {}
		) as RepositoryPlatformAdapter;
	}

	private requireGitHubAuthentication(authToken?: string): void {
		if (authToken) {
			return;
		}

		const systemStatus = refreshSystemStatus({ cwd: this.repositoryRootPath });
		if (!systemStatus.github.authenticated) {
			throw new Error(systemStatus.github.detail ?? 'GitHub CLI authentication is required.');
		}
	}

	private normalizeAuthToken(authToken?: string): string | undefined {
		const normalizedToken = authToken?.trim();
		return normalizedToken && normalizedToken.length > 0 ? normalizedToken : undefined;
	}
}

export type {
	MissionReference,
	RepositoryData as RepositorySummary,
	RepositoryStateSnapshot
};
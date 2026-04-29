import * as path from 'node:path';
import { Entity, type EntityExecutionContext } from '../Entity/Entity.js';
import { getMissionGitHubCliBinary } from '../../lib/config.js';
import { FilesystemAdapter } from '../../lib/FilesystemAdapter.js';
import { readRepositorySettingsDocument } from '../../lib/daemonConfig.js';
import { MissionPreparationService } from './MissionPreparation.js';
import { GitHubPlatformAdapter } from '../../platforms/GitHubPlatformAdapter.js';
import type { MissionBrief } from '../../types.js';
import { deriveRepositoryIdentity } from '../../lib/repositoryIdentity.js';
import { resolveGitWorkspaceRoot } from '../../lib/workspacePaths.js';
import {
	repositorySnapshotSchema,
	repositoryDataSchema,
	repositoryInputSchema,
	repositoryEntityName,
	repositoryWorkflowConfigurationSchema,
	createDefaultRepositoryConfiguration,
	githubIssueDetailSchema,
	trackedIssueSummarySchema,
	type RepositorySnapshot,
	type RepositoryData,
	type RepositoryInput,
	type GitHubIssueDetail,
	type RepositoryMissionStartAcknowledgement,
	type TrackedIssueSummary,
	type RepositoryFindPayload,
	type RepositoryGetIssuePayload,
	type RepositoryListIssuesPayload,
	type RepositoryReadPayload,
	type RepositoryAddPayload,
	type RepositoryRemoveAcknowledgement,
	type RepositoryRemovePayload,
	type RepositoryStartMissionFromBriefPayload,
	type RepositoryStartMissionFromIssuePayload,
	repositoryFindPayloadSchema,
	repositoryGetIssuePayloadSchema,
	repositoryIdentityPayloadSchema,
	repositoryListIssuesPayloadSchema,
	repositoryMissionStartAcknowledgementSchema,
	repositoryReadPayloadSchema,
	repositoryAddPayloadSchema,
	repositoryRemoveAcknowledgementSchema,
	repositoryRemovePayloadSchema,
	repositoryRegistrationInputSchema,
	repositoryStartMissionFromBriefPayloadSchema,
	repositoryStartMissionFromIssuePayloadSchema
} from './RepositorySchema.js';
import {
	RepositorySettingsSchema,
	type RepositorySettings
} from './RepositorySettings.js';
import type { WorkflowGlobalSettings } from '../../workflow/WorkflowSchema.js';
import { createDefaultRepositorySettings } from './RepositorySettings.js';
import { readMissionWorkflowDefinition } from '../../workflow/mission/preset.js';
import { createDefaultWorkflowSettings } from '../../workflow/mission/workflow.js';
import { normalizeWorkflowSettings } from '../../settings/validation.js';
import { createRepositoryPlatformAdapter } from './PlatformAdapter.js';

export class Repository extends Entity<RepositoryData, string> {
	public static override readonly entityName = repositoryEntityName;

	public static async find(
		input: RepositoryFindPayload = {},
		context?: EntityExecutionContext
	): Promise<RepositorySnapshot[]> {
		repositoryFindPayloadSchema.parse(input);
		const repositories = await Repository.getRepositoryFactory(context).find(Repository);

		return await Promise.all(
			repositories.map((repository) =>
				repository.read({
					repositoryId: repository.repositoryId,
					repositoryRootPath: repository.repositoryRootPath
				})
			)
		);
	}

	public static async add(
		input: RepositoryAddPayload,
		context?: EntityExecutionContext
	): Promise<RepositorySnapshot> {
		const payload = repositoryAddPayloadSchema.parse(input);
		const repositoryRootPath = 'githubRepository' in payload
			? await Repository.checkoutGitHubRepository(payload, context)
			: payload.repositoryPath;
		const repository = await Repository.registerLocalRepository(repositoryRootPath, context);
		return await repository.read({
			repositoryId: repository.repositoryId,
			repositoryRootPath: repository.repositoryRootPath
		});
	}

	public static async resolve(input: unknown, context?: EntityExecutionContext): Promise<Repository | undefined> {
		const payload = repositoryIdentityPayloadSchema.parse(input);
		const factory = Repository.getRepositoryFactory(context);
		const storedRepository = await factory.read(Repository, payload.repositoryId);
		if (storedRepository) {
			return storedRepository;
		}

		return payload.repositoryRootPath?.trim()
			? Repository.open(payload.repositoryRootPath.trim())
			: undefined;
	}

	public static register(input: RepositoryInput): Repository {
		return new Repository(Repository.createRepositoryData(repositoryInputSchema.parse(input)));
	}

	public static open(
		repositoryRootPath: string,
		input: Partial<Omit<RepositoryInput, 'repositoryRootPath'>> = {}
	): Repository {
		return Repository.register({
			repositoryRootPath,
			...input
		});
	}

	private static async registerLocalRepository(repositoryPath: string, context?: EntityExecutionContext): Promise<Repository> {
		const { repositoryPath: trimmedRepositoryPath } = repositoryRegistrationInputSchema.parse({ repositoryPath });
		const controlRoot = resolveGitWorkspaceRoot(trimmedRepositoryPath);
		if (!controlRoot) {
			throw new Error(`Mission could not resolve a Git repository from '${repositoryPath}'.`);
		}

		const repository = Repository.open(controlRoot);
		return Repository.getRepositoryFactory(context).save(Repository, repository.toData());
	}

	private static async checkoutGitHubRepository(
		input: Extract<RepositoryAddPayload, { githubRepository: string }>,
		context?: EntityExecutionContext
	): Promise<string> {
		const ghBinary = getMissionGitHubCliBinary();
		const adapter = createRepositoryPlatformAdapter({
			platform: 'github',
			workspaceRoot: context?.surfacePath?.trim() || process.cwd(),
			...(context?.authToken ? { authToken: context.authToken } : {}),
			...(ghBinary ? { ghBinary } : {})
		});

		return adapter.cloneRepository({
			repository: input.githubRepository,
			destinationPath: input.destinationPath
		});
	}

	public constructor(data: RepositoryData) {
		super(repositoryDataSchema.parse(data));
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

	public get ownerId(): string {
		return this.data.ownerId;
	}

	public get repoName(): string {
		return this.data.repoName;
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

	public get settings(): RepositorySettings {
		return structuredClone(this.data.settings);
	}

	public get workflowConfiguration(): WorkflowGlobalSettings {
		return structuredClone(this.data.workflowConfiguration);
	}

	public get isInitialized(): boolean {
		return this.data.isInitialized;
	}

	public updateSettings(settings: RepositorySettings): this {
		this.data = repositoryDataSchema.parse({
			...this.data,
			settings: RepositorySettingsSchema.parse(settings)
		});
		return this;
	}

	public updateWorkflowConfiguration(workflowConfiguration: WorkflowGlobalSettings): this {
		this.data = repositoryDataSchema.parse({
			...this.data,
			workflowConfiguration: repositoryWorkflowConfigurationSchema.parse(workflowConfiguration)
		});
		return this;
	}

	public markInitialized(value = true): this {
		this.data = repositoryDataSchema.parse({
			...this.data,
			isInitialized: value
		});
		return this;
	}

	public toSchema(): RepositoryData {
		return this.toData();
	}

	public canStartMissionFromIssue(): boolean {
		return this.githubRepository !== undefined;
	}

	public canStartMissionFromBrief(): boolean {
		return true;
	}

	public canRemove(): boolean {
		return true;
	}

	public override async remove(
		input: RepositoryRemovePayload,
		context?: EntityExecutionContext
	): Promise<RepositoryRemoveAcknowledgement> {
		const payload = repositoryRemovePayloadSchema.parse(input);
		this.assertRepositoryIdentity(payload);
		await this.getEntityFactory(context).remove(Repository, this.repositoryId);
		return repositoryRemoveAcknowledgementSchema.parse({
			ok: true,
			entity: repositoryEntityName,
			method: 'remove',
			id: this.repositoryId
		});
	}

	public async read(input: RepositoryReadPayload): Promise<RepositorySnapshot> {
		this.assertRepositoryIdentity(repositoryReadPayloadSchema.parse(input));
		const store = new FilesystemAdapter(this.repositoryRootPath);
		const settings = readRepositorySettingsDocument(this.repositoryRootPath);
		const missions = await store.listMissions().catch(() => []);
		const currentBranch = store.isGitRepository() ? store.getCurrentBranch() : undefined;

		return repositorySnapshotSchema.parse({
			repository: this.toSchema(),
			operationalMode: settings ? 'repository' : 'setup',
			controlRoot: this.repositoryRootPath,
			...(currentBranch ? { currentBranch } : {}),
			settingsComplete: settings !== undefined,
			...(this.githubRepository ? { githubRepository: this.githubRepository } : {}),
			missions: missions.map(({ descriptor }) => ({
				missionId: descriptor.missionId,
				title: descriptor.brief.title,
				branchRef: descriptor.branchRef,
				createdAt: descriptor.createdAt,
				...(descriptor.brief.issueId !== undefined ? { issueId: descriptor.brief.issueId } : {})
			}))
		});
	}

	public async listIssues(
		input: RepositoryListIssuesPayload,
		context?: { authToken?: string }
	): Promise<TrackedIssueSummary[]> {
		this.assertRepositoryIdentity(repositoryListIssuesPayloadSchema.parse(input));
		const platform = this.tryCreateGitHubPlatformAdapter(context?.authToken);
		return trackedIssueSummarySchema.array().parse(platform ? await platform.listOpenIssues(25) : []);
	}

	public async getIssue(
		input: RepositoryGetIssuePayload,
		context?: { authToken?: string }
	): Promise<GitHubIssueDetail> {
		const payload = repositoryGetIssuePayloadSchema.parse(input);
		this.assertRepositoryIdentity(payload);
		return githubIssueDetailSchema.parse(
			await this.requireGitHubPlatformAdapter(context?.authToken)
				.fetchIssueDetail(String(payload.issueNumber))
		);
	}

	public async startMissionFromIssue(
		input: RepositoryStartMissionFromIssuePayload,
		context?: { authToken?: string }
	): Promise<RepositoryMissionStartAcknowledgement> {
		const payload = repositoryStartMissionFromIssuePayloadSchema.parse(input);
		this.assertRepositoryIdentity(payload);
		const brief = await this.requireGitHubPlatformAdapter(context?.authToken)
			.fetchIssue(String(payload.issueNumber));
		return this.prepareMission(brief, 'startMissionFromIssue');
	}

	public async startMissionFromBrief(
		input: RepositoryStartMissionFromBriefPayload,
		context?: { authToken?: string }
	): Promise<RepositoryMissionStartAcknowledgement> {
		const payload = repositoryStartMissionFromBriefPayloadSchema.parse(input);
		this.assertRepositoryIdentity(payload);
		const platform = this.tryCreateGitHubPlatformAdapter(context?.authToken);
		const brief = platform
			? await platform.createIssue({
				title: payload.title,
				body: payload.body
			}).then((createdIssue) => ({
				...payload,
				...(createdIssue.issueId !== undefined ? { issueId: createdIssue.issueId } : {}),
				...(createdIssue.url ? { url: createdIssue.url } : {}),
				...(createdIssue.labels ? { labels: createdIssue.labels } : {})
			}))
			: payload;

		return this.prepareMission(brief, 'startMissionFromBrief');
	}

	private async prepareMission(
		brief: MissionBrief,
		method: 'startMissionFromIssue' | 'startMissionFromBrief'
	): Promise<RepositoryMissionStartAcknowledgement> {
		const settings = readRepositorySettingsDocument(this.repositoryRootPath) ?? createDefaultRepositorySettings();
		const workflow = normalizeWorkflowSettings(
			readMissionWorkflowDefinition(this.repositoryRootPath) ?? createDefaultWorkflowSettings()
		);
		const store = new FilesystemAdapter(this.repositoryRootPath);
		const preparation = await new MissionPreparationService(store, {
			workflow,
			taskRunners: new Map(),
			...(settings.instructionsPath
				? { instructionsPath: Repository.resolveRepositoryPath(this.repositoryRootPath, settings.instructionsPath) }
				: {}),
			...(settings.skillsPath
				? { skillsPath: Repository.resolveRepositoryPath(this.repositoryRootPath, settings.skillsPath) }
				: {}),
			...(settings.defaultModel ? { defaultModel: settings.defaultModel } : {}),
			...(settings.defaultAgentMode ? { defaultMode: settings.defaultAgentMode } : {})
		}).prepareFromBrief({ brief });

		if (preparation.kind !== 'mission') {
			throw new Error('Mission preparation returned an unexpected result.');
		}

		return repositoryMissionStartAcknowledgementSchema.parse({
			ok: true,
			entity: 'Repository',
			method,
			id: preparation.missionId
		});
	}

	private tryCreateGitHubPlatformAdapter(authToken?: string): GitHubPlatformAdapter | undefined {
		const githubRepository = this.githubRepository?.trim();
		if (!githubRepository) {
			return undefined;
		}

		return new GitHubPlatformAdapter(
			this.repositoryRootPath,
			githubRepository,
			authToken ? { authToken } : {}
		);
	}

	private requireGitHubPlatformAdapter(authToken?: string): GitHubPlatformAdapter {
		const adapter = this.tryCreateGitHubPlatformAdapter(authToken);
		if (!adapter) {
			throw new Error(`Repository '${this.repositoryId}' does not have a GitHub remote configured.`);
		}
		return adapter;
	}

	private assertRepositoryIdentity(input: { repositoryId: string; repositoryRootPath?: string | undefined }): void {
		if (input.repositoryId !== this.repositoryId) {
			throw new Error(`Repository payload id '${input.repositoryId}' does not match '${this.repositoryId}'.`);
		}

		if (input.repositoryRootPath && path.resolve(input.repositoryRootPath) !== this.repositoryRootPath) {
			throw new Error(`Repository payload root '${input.repositoryRootPath}' does not match '${this.repositoryRootPath}'.`);
		}
	}

	private static createRepositoryData(input: RepositoryInput): RepositoryData {
		const normalizedRepositoryRootPath = path.resolve(input.repositoryRootPath);
		const identity = deriveRepositoryIdentity(normalizedRepositoryRootPath);
		const githubRepository = input.githubRepository?.trim() || identity.githubRepository;
		const { ownerId, repoName } = Repository.deriveRepositoryNames(normalizedRepositoryRootPath, githubRepository);
		const defaults = createDefaultRepositoryConfiguration();

		return repositoryDataSchema.parse({
			repositoryId: identity.repositoryId,
			repositoryRootPath: normalizedRepositoryRootPath,
			ownerId,
			repoName,
			label: input.label?.trim() || repoName,
			description: input.description ?? githubRepository ?? normalizedRepositoryRootPath,
			...(githubRepository ? { githubRepository } : {}),
			settings: input.settings ?? defaults.settings,
			workflowConfiguration: input.workflowConfiguration ?? defaults.workflowConfiguration,
			isInitialized: input.isInitialized ?? defaults.isInitialized
		});
	}

	private static deriveRepositoryNames(
		repositoryRootPath: string,
		githubRepository?: string
	): { ownerId: string; repoName: string } {
		const segments = githubRepository?.split('/').map((segment) => segment.trim()).filter(Boolean) ?? [];
		if (segments.length === 2) {
			return {
				ownerId: segments[0]!,
				repoName: segments[1]!
			};
		}

		return {
			ownerId: 'local',
			repoName: path.basename(repositoryRootPath) || 'repository'
		};
	}

	private static resolveRepositoryPath(repositoryRootPath: string, configuredPath: string): string {
		return path.isAbsolute(configuredPath)
			? configuredPath
			: path.join(repositoryRootPath, configuredPath);
	}

	private static getRepositoryFactory(context?: EntityExecutionContext) {
		const factory = Repository.getEntityFactory(context);
		if (!factory.has(Repository)) {
			factory.register({
				entityName: repositoryEntityName,
				table: 'repository',
				entityClass: Repository,
				storageSchema: repositoryDataSchema,
				getId: (record) => record.repositoryId
			});
		}
		return factory;
	}
}

export type {
	RepositoryData,
	RepositoryInput
};
import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as path from 'node:path';
import type { Socket } from 'node:net';
import { Mission } from './mission/Mission.js';
import { Factory } from './mission/Factory.js';
import { FilesystemAdapter } from '../lib/FilesystemAdapter.js';
import { GitHubPlatformAdapter } from '../platforms/GitHubPlatformAdapter.js';
import { MissionAgentContext } from '../agents/agentContext.js';
import { initializeMissionRepository } from '../initializeMissionRepository.js';
import {
	type MissionAgentConsoleState,
	type MissionAgentDisposable,
	type MissionAgentEvent,
	type MissionAgentRuntime,
	type MissionAgentSessionRecord
} from './MissionAgentRuntime.js';
import {
	getMissionSettingsPath,
	readMissionRepoSettings
} from '../lib/repoConfig.js';
import type {
	MissionCommandDescriptor,
	MissionRepoMode,
	MissionSelectionCandidate,
	MissionTaskState,
	MissionSelector,
	MissionStatus,
	TrackedIssueSummary
} from '../types.js';
import { MISSION_STAGES } from '../types.js';
import {
	PROTOCOL_VERSION,
	type AgentConsoleState,
	type AgentControl,
	type AgentInput,
	type AgentLaunch,
	type AgentResize,
	type AgentTurnSubmit,
	type ErrorResponse,
	type Manifest,
	type Message,
	type MissionBootstrap,
	type MissionGateEvaluate,
	type MissionSelect,
	type MissionStart,
	type MissionTransition,
	type Notification,
	type Ping,
	type Request,
	type Response,
	type SuccessResponse,
	type TaskUpdate
} from './protocol.js';
import {
	getDaemonManifestPath,
	isNamedPipePath,
	resolveDaemonSocketPath
} from './daemonPaths.js';

type LoadedMission = {
	missionId: string;
	branchRef: string;
	mission: Mission;
	selectionSource: 'branch' | 'explicit';
	consoleSubscription: MissionAgentDisposable;
	eventSubscription: MissionAgentDisposable;
	autopilotEnabled: boolean;
	autopilotQueue: Promise<void>;
};

export type DaemonOptions = {
	logLine?: (line: string) => void;
	socketPath?: string;
	runtimes?: MissionAgentRuntime[];
};

export class Daemon {
	private readonly server = net.createServer();
	private readonly clients = new Set<Socket>();
	private readonly store: FilesystemAdapter;
	private readonly runtimes = new Map<string, MissionAgentRuntime>();
	private readonly shutdownPromise: Promise<void>;
	private readonly socketPath: string;
	private readonly logLine: ((line: string) => void) | undefined;
	private resolveShutdown!: () => void;
	private boundMission: LoadedMission | undefined;
	private manifest?: Manifest;
	private closed = false;

	public constructor(
		private readonly repoRoot: string,
		options: DaemonOptions = {}
	) {
		this.store = new FilesystemAdapter(repoRoot);
		this.socketPath = resolveDaemonSocketPath(repoRoot, options.socketPath);
		this.logLine = options.logLine;
		for (const runtime of options.runtimes ?? []) {
			this.runtimes.set(runtime.id, runtime);
		}
		this.shutdownPromise = new Promise<void>((resolve) => {
			this.resolveShutdown = resolve;
		});
		this.server.on('connection', (socket) => {
			this.handleConnection(socket);
		});
	}

	public getManifest(): Manifest | undefined {
		return this.manifest ? structuredClone(this.manifest) : undefined;
	}

	public async listen(): Promise<Manifest> {
		await this.initializeRepositoryIfNeeded();
		await this.prepareSocketPath();
		await new Promise<void>((resolve, reject) => {
			const onError = (error: Error) => {
				this.server.off('listening', onListening);
				reject(error);
			};
			const onListening = () => {
				this.server.off('error', onError);
				resolve();
			};

			this.server.once('error', onError);
			this.server.once('listening', onListening);
			this.server.listen(this.socketPath);
		});

		this.manifest = {
			repoRoot: this.repoRoot,
			pid: process.pid,
			startedAt: new Date().toISOString(),
			protocolVersion: PROTOCOL_VERSION,
			endpoint: {
				transport: 'ipc',
				path: this.socketPath
			}
		};
		await this.writeManifest();
		return structuredClone(this.manifest);
	}

	public waitUntilClosed(): Promise<void> {
		return this.shutdownPromise;
	}

	public async close(): Promise<void> {
		if (this.closed) {
			await this.shutdownPromise;
			return;
		}

		this.closed = true;
		for (const client of this.clients) {
			client.end();
			client.destroy();
		}
		this.clients.clear();

		await new Promise<void>((resolve, reject) => {
			if (!this.server.listening) {
				resolve();
				return;
			}

			this.server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});

		this.disposeBoundMission();
		await this.cleanupRuntimeFiles();
		this.resolveShutdown();
	}

	private handleConnection(socket: Socket): void {
		this.clients.add(socket);
		socket.setEncoding('utf8');
		let buffer = '';

		socket.on('data', (chunk: string) => {
			buffer += chunk;
			while (true) {
				const newlineIndex = buffer.indexOf('\n');
				if (newlineIndex < 0) {
					break;
				}

				const line = buffer.slice(0, newlineIndex).trim();
				buffer = buffer.slice(newlineIndex + 1);
				if (!line) {
					continue;
				}

				void this.handleLine(socket, line);
			}
		});

		const releaseSocket = () => {
			this.clients.delete(socket);
		};
		socket.once('close', releaseSocket);
		socket.once('end', releaseSocket);
		socket.once('error', releaseSocket);
	}

	private async handleLine(socket: Socket, line: string): Promise<void> {
		let message: Message;
		try {
			message = JSON.parse(line) as Message;
		} catch (error) {
			this.writeToSocket(socket, this.toErrorResponse('unknown', error));
			return;
		}

		if (message.type !== 'request') {
			this.writeToSocket(
				socket,
				this.toErrorResponse('unknown', 'Only request messages are accepted by the server.')
			);
			return;
		}

		const response = await this.handleRequest(message);
		this.writeToSocket(socket, response);
	}

	private async handleRequest(
		request: Request
	): Promise<Response> {
		try {
			const result = await this.executeMethod(request);
			const response: SuccessResponse = {
				type: 'response',
				id: request.id,
				ok: true,
				result
			};
			return response;
		} catch (error) {
			return this.toErrorResponse(request.id, error);
		}
	}

	private async executeMethod(request: Request) {
		switch (request.method) {
			case 'ping': {
				const pingResult: Ping = {
					ok: true,
					repoRoot: this.repoRoot,
					pid: process.pid,
					startedAt: this.manifest?.startedAt ?? new Date().toISOString(),
					protocolVersion: PROTOCOL_VERSION
				};
				return pingResult;
			}
			case 'mission.start':
				return this.startMission(request.params as MissionStart);
			case 'mission.bootstrap':
				return this.bootstrapMissionFromIssue(request.params as MissionBootstrap);
			case 'mission.status':
				return this.getMissionStatus(this.toMissionParams(request.params));
			case 'mission.gate.evaluate':
				return this.evaluateGate(request.params as MissionGateEvaluate);
			case 'mission.transition':
				return this.transitionMission(request.params as MissionTransition);
			case 'mission.deliver':
				return this.deliverMission(this.toMissionParams(request.params));
			case 'mission.task.update':
				return this.updateTaskState(request.params as TaskUpdate);
			case 'mission.agent.sessions':
				return this.listAgentSessions(this.toMissionParams(request.params));
			case 'mission.agent.launch':
				return this.launchAgentSession(request.params as AgentLaunch);
			case 'mission.agent.console.state':
				return this.getAgentConsoleState(request.params as AgentConsoleState);
			case 'mission.agent.turn.submit':
				return this.submitAgentTurn(request.params as AgentTurnSubmit);
			case 'mission.agent.input':
				return this.sendAgentInput(request.params as AgentInput);
			case 'mission.agent.resize':
				return this.resizeAgentSession(request.params as AgentResize);
			case 'mission.agent.cancel':
				return this.cancelAgentSession(request.params as AgentControl);
			case 'mission.agent.terminate':
				return this.terminateAgentSession(request.params as AgentControl);
			case 'github.issues.list':
				return this.listOpenGitHubIssues(request.params as { limit?: number } | undefined);
			default:
				throw new Error(`Unknown server method '${request.method}'.`);
		}
	}

	private async startMission(params: MissionStart): Promise<MissionStatus> {
		await this.ensureRepositoryInitialized();
		const agentContext = params.agentContext ?? MissionAgentContext.build();
		const missionIssueId = this.resolveMissionIssueId(params);
		const branchRef = this.store.ensureMissionBranch(
			params.branchRef ??
				(missionIssueId !== undefined
					? this.store.deriveMissionBranchName(missionIssueId, params.brief.title)
					: this.store.getCurrentBranch())
		);
		const existingMission = await this.refreshBoundMission();
		if (existingMission) {
			const existingRecord = existingMission.mission.getRecord();
			if (
				existingRecord.branchRef === branchRef &&
				(missionIssueId === undefined || existingRecord.brief.issueId === missionIssueId)
			) {
				if (MissionAgentContext.getAutopilotMode(agentContext) === 'enabled') {
					this.enableAutopilot(existingMission);
				}
				const status = await existingMission.mission.status();
				this.broadcastMissionStatus(existingRecord.id, status);
				return this.decorateMissionStatus(status, 'selected');
			}

			throw new Error(this.describeBoundMissionConflict(existingMission));
		}

		const mission = await Factory.create(this.store, {
			brief: params.brief,
			branchRef,
			agentContext
		});
		const loadedMission = this.bindMission(mission, {
			autopilotEnabled: MissionAgentContext.getAutopilotMode(agentContext) === 'enabled'
		});
		const status = await loadedMission.mission.status();
		this.broadcastMissionStatus(loadedMission.missionId, status);
		return this.decorateMissionStatus(status, 'selected');
	}

	private async bootstrapMissionFromIssue(
		params: MissionBootstrap
	): Promise<MissionStatus> {
		await this.ensureRepositoryInitialized();
		const existingMission = await this.refreshBoundMission();
		if (existingMission) {
			const existingRecord = existingMission.mission.getRecord();
			if (existingRecord.brief.issueId === params.issueNumber) {
				return this.decorateMissionStatus(await existingMission.mission.status(), 'selected');
			}

			throw new Error(this.describeBoundMissionConflict(existingMission));
		}

		const settings = readMissionRepoSettings(this.repoRoot);
		if (settings?.trackingProvider !== 'github') {
			throw new Error(
				'Mission issue intake requires .mission/settings.json to use the GitHub tracking provider.'
			);
		}

		const adapter = new GitHubPlatformAdapter(this.repoRoot, settings.trackingRepository);
		const brief = await adapter.fetchIssue(String(params.issueNumber));
		return this.startMission({
			brief,
			agentContext: params.agentContext ?? MissionAgentContext.build()
		});
	}

	private async getMissionStatus(
		params: MissionSelect = {}
	): Promise<MissionStatus> {
		await this.initializeRepositoryIfNeeded();

		const loadedMission = await this.resolveLoadedMission(params.selector ?? {}, { allowMissing: true });
		if (!loadedMission) {
			return this.buildIdleMissionStatus();
		}

		return this.decorateMissionStatus(await loadedMission.mission.status(), 'selected');
	}

	private async buildIdleMissionStatus(): Promise<MissionStatus> {
		const settings = readMissionRepoSettings(this.repoRoot);
		const trackingEnabled = settings?.trackingProvider === 'github';
		const availableMissions: MissionSelectionCandidate[] = (await this.store.listMissions()).map(
			({ descriptor }) => ({
				missionId: descriptor.missionId,
				title: descriptor.brief.title,
				branchRef: descriptor.branchRef,
				createdAt: descriptor.createdAt,
				...(descriptor.brief.issueId !== undefined ? { issueId: descriptor.brief.issueId } : {})
			})
		);

		const availableCommands: MissionCommandDescriptor[] = [
			{
				id: 'mission.start',
				label: 'Start a new mission brief',
				command: '/start',
				scope: 'mission',
				enabled: true
			},
			{
				id: 'mission.select',
				label: 'Select an active mission',
				command: '/select',
				scope: 'mission',
				enabled: availableMissions.length > 0,
				...(availableMissions.length > 0 ? {} : { reason: 'No active missions are available.' })
			},
			{
				id: 'mission.issues',
				label: 'Browse open GitHub issues',
				command: '/issues',
				scope: 'mission',
				enabled: trackingEnabled,
				...(trackingEnabled ? {} : { reason: 'GitHub tracking is not enabled.' })
			}
		];

		return this.decorateMissionStatus({
			found: false,
			availableCommands,
			...(availableMissions.length > 0 ? { availableMissions } : {})
		}, 'idle');
	}

	private async evaluateGate(params: MissionGateEvaluate) {
		const loadedMission = await this.requireLoadedMission(params.selector);
		return loadedMission.mission.evaluateGate(params.intent);
	}

	private async transitionMission(params: MissionTransition) {
		const loadedMission = await this.requireLoadedMission(params.selector);
		await loadedMission.mission.transition(params.toStage);
		const status = await loadedMission.mission.status();
		this.broadcastMissionStatus(loadedMission.missionId, status);
		return this.decorateMissionStatus(status, 'selected');
	}

	private async deliverMission(params: MissionSelect = {}) {
		const loadedMission = await this.requireLoadedMission(params.selector);
		await loadedMission.mission.deliver();
		const status = await loadedMission.mission.status();
		this.broadcastMissionStatus(loadedMission.missionId, status);
		return this.decorateMissionStatus(status, 'selected');
	}

	private async updateTaskState(params: TaskUpdate) {
		const loadedMission = await this.requireLoadedMission(params.selector);
		await loadedMission.mission.updateTaskState(params.taskId, params.changes);
		const status = await loadedMission.mission.status();
		this.broadcastMissionStatus(loadedMission.missionId, status);
		return this.decorateMissionStatus(status, 'selected');
	}

	private async listAgentSessions(
		params: MissionSelect = {}
	): Promise<MissionAgentSessionRecord[]> {
		const loadedMission = await this.requireLoadedMission(params.selector);
		return loadedMission.mission.getAgentSessions();
	}

	private async launchAgentSession(params: AgentLaunch) {
		const loadedMission = await this.requireLoadedMission(params.selector);
		const runtimeId = this.resolveRuntimeId(params.request.runtimeId);
		const session = await loadedMission.mission.launchAgentSession({
			...params.request,
			runtimeId
		});
		void this.broadcastMissionStatusSnapshot(loadedMission);
		return session;
	}

	private async getAgentConsoleState(
		params: AgentConsoleState
	): Promise<MissionAgentConsoleState | null> {
		const loadedMission = await this.resolveLoadedMissionBySessionId(params.sessionId);
		return loadedMission.mission.getAgentConsoleState(params.sessionId) ?? null;
	}

	private async submitAgentTurn(params: AgentTurnSubmit) {
		const loadedMission = await this.resolveLoadedMissionBySessionId(params.sessionId);
		return loadedMission.mission.submitAgentTurn(params.sessionId, params.request);
	}

	private async sendAgentInput(params: AgentInput) {
		const loadedMission = await this.resolveLoadedMissionBySessionId(params.sessionId);
		return loadedMission.mission.sendAgentInput(params.sessionId, params.text);
	}

	private async resizeAgentSession(params: AgentResize) {
		const loadedMission = await this.resolveLoadedMissionBySessionId(params.sessionId);
		return loadedMission.mission.resizeAgentSession(params.sessionId, {
			cols: params.cols,
			rows: params.rows
		});
	}

	private async cancelAgentSession(params: AgentControl) {
		const loadedMission = await this.resolveLoadedMissionBySessionId(params.sessionId);
		return loadedMission.mission.cancelAgentSession(params.sessionId, params.reason);
	}

	private async terminateAgentSession(params: AgentControl) {
		const loadedMission = await this.resolveLoadedMissionBySessionId(params.sessionId);
		return loadedMission.mission.terminateAgentSession(params.sessionId, params.reason);
	}

	private async listOpenGitHubIssues(params: { limit?: number } = {}): Promise<TrackedIssueSummary[]> {
		const settings = readMissionRepoSettings(this.repoRoot);
		if (settings?.trackingProvider !== 'github') {
			return [];
		}

		const adapter = new GitHubPlatformAdapter(this.repoRoot, settings.trackingRepository);
		return adapter.listOpenIssues(params.limit ?? 50);
	}

	private writeToSocket(socket: Socket, message: Message): void {
		if (socket.destroyed) {
			return;
		}

		socket.write(`${JSON.stringify(message)}\n`);
	}

	private broadcast(message: Message): void {
		for (const client of this.clients) {
			this.writeToSocket(client, message);
		}
	}

	private broadcastMissionStatus(missionId: string, status: MissionStatus): void {
		this.broadcast({
			type: 'event',
			event: {
				type: 'mission.status',
				missionId,
				status: this.decorateMissionStatus(status, 'selected')
			}
		});
	}

	private async broadcastMissionStatusSnapshot(loadedMission: LoadedMission): Promise<void> {
		const status = await loadedMission.mission.status();
		this.broadcastMissionStatus(loadedMission.missionId, status);
	}

	private decorateMissionStatus(status: MissionStatus, repoMode: MissionRepoMode): MissionStatus {
		const currentBranch = this.store.getCurrentBranch().trim();
		const settings = readMissionRepoSettings(this.repoRoot);
		return {
			...status,
			repoMode,
			repoIsGitRepository: this.store.isGitRepository(),
			repoTrackingEnabled: settings?.trackingProvider === 'github',
			...(currentBranch ? { repoCurrentBranch: currentBranch } : {})
		};
	}

	private async isRepositoryInitialized(): Promise<boolean> {
		try {
			await fs.access(getMissionSettingsPath(this.repoRoot));
			return true;
		} catch {
			return false;
		}
	}

	private async ensureRepositoryInitialized(): Promise<void> {
		if (await this.isRepositoryInitialized()) {
			return;
		}

		await this.initializeRepositoryIfNeeded();
	}

	private async initializeRepositoryIfNeeded(): Promise<void> {
		if (await this.isRepositoryInitialized()) {
			return;
		}

		await initializeMissionRepository(this.repoRoot);
	}

	private async writeManifest(): Promise<void> {
		if (!this.manifest) {
			return;
		}

		const manifestPath = getDaemonManifestPath(this.repoRoot);
		await fs.mkdir(path.dirname(manifestPath), { recursive: true });
		await fs.writeFile(manifestPath, `${JSON.stringify(this.manifest, null, 2)}\n`, 'utf8');
	}

	private async cleanupRuntimeFiles(): Promise<void> {
		await fs.rm(getDaemonManifestPath(this.repoRoot), { force: true }).catch(() => undefined);
		if (!isNamedPipePath(this.socketPath)) {
			await fs.rm(this.socketPath, { force: true }).catch(() => undefined);
		}
	}

	private async prepareSocketPath(): Promise<void> {
		if (isNamedPipePath(this.socketPath)) {
			return;
		}

		await fs.mkdir(path.dirname(this.socketPath), { recursive: true });
		const socketExists = await fs.lstat(this.socketPath).then(
			() => true,
			() => false
		);
		if (!socketExists) {
			return;
		}

		const activeServer = await this.canConnect(this.socketPath);
		if (activeServer) {
			throw new Error(`Mission daemon is already running at '${this.socketPath}'.`);
		}

		await fs.rm(this.socketPath, { force: true });
	}

	private async canConnect(candidatePath: string): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			const probe = net.createConnection(candidatePath);
			const finalize = (result: boolean) => {
				probe.removeAllListeners();
				probe.destroy();
				resolve(result);
			};

			probe.once('connect', () => {
				finalize(true);
			});
			probe.once('error', () => {
				finalize(false);
			});
		});
	}

	private toErrorResponse(id: string, error: unknown): ErrorResponse {
		return {
			type: 'response',
			id,
			ok: false,
			error: {
				message: error instanceof Error ? error.message : String(error)
			}
		};
	}

	private toMissionParams(params: unknown): MissionSelect {
		if (!params || typeof params !== 'object') {
			return {};
		}

		return params as MissionSelect;
	}

	private async resolveLoadedMission(
		selector: MissionSelector = {},
		options: { allowMissing?: boolean } = {}
	): Promise<LoadedMission | undefined> {
		await this.initializeRepositoryIfNeeded();

		const existing = await this.refreshBoundMission();
		if (existing) {
			this.assertSelectorMatchesLoadedMission(selector, existing);
			return existing;
		}

		const resolvedMission = await this.store.resolveMission(selector);
		if (!resolvedMission) {
			if (options.allowMissing) {
				return undefined;
			}

			throw new Error('No active mission could be resolved for this workspace.');
		}

		if (!hasExplicitMissionIdentitySelector(selector)) {
			this.ensureCurrentBranchMatchesMissionBranch(resolvedMission.descriptor.branchRef);
		}
		const mission = await Factory.load(this.store, {
			missionId: resolvedMission.descriptor.missionId,
			branchRef: resolvedMission.descriptor.branchRef
		});
		if (!mission) {
			throw new Error(`Mission '${resolvedMission.descriptor.missionId}' could not be loaded.`);
		}

		const loadedMission = this.bindMission(mission, {
			selectionSource: hasExplicitMissionIdentitySelector(selector) ? 'explicit' : 'branch'
		});
		this.assertSelectorMatchesLoadedMission(selector, loadedMission);
		return loadedMission;
	}

	private async requireLoadedMission(selector: MissionSelector = {}): Promise<LoadedMission> {
		const loadedMission = await this.resolveLoadedMission(selector);
		if (!loadedMission) {
			throw new Error('No active mission could be resolved for this workspace.');
		}

		return loadedMission;
	}

	private async resolveLoadedMissionBySessionId(sessionId: string): Promise<LoadedMission> {
		const loadedMission = await this.requireLoadedMission();
		if (!loadedMission.mission.getAgentSession(sessionId)) {
			throw new Error(`Mission agent session '${sessionId}' is not loaded in the bound mission.`);
		}

		return loadedMission;
	}

	private async refreshBoundMission(): Promise<LoadedMission | undefined> {
		if (!this.boundMission) {
			return undefined;
		}

		await this.boundMission.mission.refresh();
		if (this.boundMission.selectionSource === 'branch') {
			this.ensureCurrentBranchMatchesMissionBranch(this.boundMission.branchRef);
		}
		return this.boundMission;
	}

	private bindMission(
		mission: Mission,
		options: { autopilotEnabled?: boolean; selectionSource?: 'branch' | 'explicit' } = {}
	): LoadedMission {
		if (this.boundMission) {
			mission.dispose();
			throw new Error(this.describeBoundMissionConflict(this.boundMission));
		}

		for (const runtime of this.runtimes.values()) {
			mission.registerAgentRuntime(runtime);
		}

		const record = mission.getRecord();
		const loadedMission: LoadedMission = {
			missionId: record.id,
			branchRef: record.branchRef,
			mission,
			selectionSource: options.selectionSource ?? 'branch',
			autopilotEnabled: options.autopilotEnabled === true,
			autopilotQueue: Promise.resolve(),
			consoleSubscription: { dispose: () => undefined },
			eventSubscription: { dispose: () => undefined },
		};

		loadedMission.consoleSubscription = mission.onDidAgentConsoleEvent((event) => {
			this.broadcast({
				type: 'event',
				event: {
					type: 'mission.agent.console',
					missionId: record.id,
					event
				}
			});
		});
		loadedMission.eventSubscription = mission.onDidAgentEvent((event) => {
			this.broadcast({
				type: 'event',
				event: {
					type: 'mission.agent.event',
					missionId: record.id,
					event
				}
			});
			const phaseEvent = this.toSessionPhaseNotification(record.id, event);
			if (phaseEvent) {
				this.broadcast({
					type: 'event',
					event: phaseEvent
				});
			}
			void this.broadcastMissionStatusSnapshot(loadedMission);
			this.scheduleAutopilot(loadedMission, event);
		});

		this.boundMission = loadedMission;
		void this.broadcastMissionStatusSnapshot(loadedMission);
		this.scheduleAutopilot(loadedMission);
		return loadedMission;
	}

	private enableAutopilot(loadedMission: LoadedMission): void {
		if (loadedMission.autopilotEnabled) {
			return;
		}

		loadedMission.autopilotEnabled = true;
		this.scheduleAutopilot(loadedMission);
	}

	private scheduleAutopilot(
		loadedMission: LoadedMission,
		event?: MissionAgentEvent
	): void {
		if (!loadedMission.autopilotEnabled) {
			return;
		}

		loadedMission.autopilotQueue = loadedMission.autopilotQueue
			.catch(() => undefined)
			.then(async () => {
				if (this.boundMission !== loadedMission || !loadedMission.autopilotEnabled) {
					return;
				}

				if (event) {
					await this.handleAutopilotEvent(loadedMission, event);
				}

				await this.runAutopilotLoop(loadedMission);
			})
			.catch((error) => {
				const message = error instanceof Error ? error.message : String(error);
				this.logLine?.(`Mission autopilot stalled: ${message}`);
			});
	}

	private async handleAutopilotEvent(
		loadedMission: LoadedMission,
		event: MissionAgentEvent
	): Promise<void> {
		switch (event.type) {
			case 'session-completed':
				await this.updateAutopilotTaskState(loadedMission, event.state.sessionId, 'done');
				break;
			case 'session-failed':
			case 'session-cancelled':
				await this.updateAutopilotTaskState(loadedMission, event.state.sessionId, 'blocked');
				break;
			default:
				break;
		}
	}

	private async updateAutopilotTaskState(
		loadedMission: LoadedMission,
		sessionId: string,
		status: MissionTaskState['status']
	): Promise<void> {
		const sessionRecord = loadedMission.mission.getAgentSession(sessionId);
		if (!sessionRecord?.taskId) {
			return;
		}

		const missionStatus = await loadedMission.mission.status();
		const task = this.findTaskState(missionStatus, sessionRecord.taskId);
		if (!task || task.status === status || task.status === 'done') {
			return;
		}

		await loadedMission.mission.updateTaskState(sessionRecord.taskId, { status });
	}

	private async runAutopilotLoop(loadedMission: LoadedMission): Promise<void> {
		for (let iteration = 0; iteration < 50; iteration += 1) {
			if (this.boundMission !== loadedMission || !loadedMission.autopilotEnabled) {
				return;
			}

			const status = await loadedMission.mission.status();
			if (status.deliveredAt) {
				return;
			}

			const currentStageId = status.stage;
			if (!currentStageId) {
				return;
			}

			const runningTaskIds = new Set(
				(status.agentSessions ?? [])
					.filter((session) => this.isRunningSession(session))
					.flatMap((session) => (session.taskId ? [session.taskId] : []))
			);
			const launchableTaskIds = [
				...(status.activeTasks ?? []).map((task) => task.taskId),
				...(status.readyTasks ?? []).map((task) => task.taskId)
			].filter((taskId, index, taskIds) => taskIds.indexOf(taskId) === index && !runningTaskIds.has(taskId));

			if (launchableTaskIds.length > 0) {
				for (const taskId of launchableTaskIds) {
					await this.launchAutopilotTaskSession(loadedMission, status, taskId);
				}
				return;
			}

			if (runningTaskIds.size > 0) {
				return;
			}

			const currentStage = status.stages?.find((stage) => stage.stage === currentStageId);
			if (!currentStage) {
				return;
			}

			if (currentStage.completedTaskCount !== currentStage.taskCount) {
				return;
			}

			const nextStage = MISSION_STAGES[MISSION_STAGES.indexOf(currentStageId) + 1];
			if (nextStage) {
				await loadedMission.mission.transition(nextStage);
				continue;
			}

			const deliveryGate = await loadedMission.mission.evaluateGate('deliver');
			if (deliveryGate.allowed) {
				await loadedMission.mission.deliver();
			}
			return;
		}

		throw new Error('Mission autopilot exceeded its progress guard without settling.');
	}

	private async launchAutopilotTaskSession(
		loadedMission: LoadedMission,
		status: MissionStatus,
		taskId: string
	): Promise<void> {
		const task = this.findTaskState(status, taskId);
		if (!task) {
			return;
		}

		await loadedMission.mission.launchAgentSession({
			runtimeId: this.resolveRuntimeId(),
			taskId,
			workingDirectory: this.resolveAutopilotWorkingDirectory(task, status),
			prompt: task.instruction,
			title: task.subject,
			operatorIntent: 'Complete this mission task autonomously and stop when the task is finished.'
		});
	}

	private resolveAutopilotWorkingDirectory(
		task: MissionTaskState,
		status: MissionStatus
	): string {
		if (task.stage === 'implementation' || task.stage === 'verification') {
			return this.repoRoot;
		}

		return status.missionDir ?? this.repoRoot;
	}

	private findTaskState(status: MissionStatus, taskId: string): MissionTaskState | undefined {
		for (const stage of status.stages ?? []) {
			const task = stage.tasks.find((candidate) => candidate.taskId === taskId);
			if (task) {
				return task;
			}
		}

		return undefined;
	}

	private isRunningSession(session: MissionAgentSessionRecord): boolean {
		return (
			session.lifecycleState === 'starting' ||
			session.lifecycleState === 'running' ||
			session.lifecycleState === 'awaiting-input'
		);
	}

	private disposeBoundMission(): void {
		if (!this.boundMission) {
			return;
		}

		this.boundMission.consoleSubscription.dispose();
		this.boundMission.eventSubscription.dispose();
		this.boundMission.mission.dispose();
		this.boundMission = undefined;
	}

	private assertSelectorMatchesLoadedMission(selector: MissionSelector, loadedMission: LoadedMission): void {
		if (selector.missionId && selector.missionId !== loadedMission.missionId) {
			throw new Error(this.describeBoundMissionConflict(loadedMission));
		}

		if (selector.branchRef && selector.branchRef !== loadedMission.branchRef) {
			throw new Error(this.describeBoundMissionConflict(loadedMission));
		}

		if (
			selector.issueId !== undefined &&
			loadedMission.mission.getRecord().brief.issueId !== selector.issueId
		) {
			throw new Error(this.describeBoundMissionConflict(loadedMission));
		}
	}

	private ensureCurrentBranchMatchesMissionBranch(branchRef: string): void {
		const currentBranch = this.store.getCurrentBranch();
		if (!currentBranch || currentBranch === 'HEAD' || currentBranch === branchRef) {
			return;
		}

		throw new Error(
			`Mission daemon is bound to branch '${branchRef}', but the repository is currently on '${currentBranch}'. Stop this daemon or switch back before continuing.`
		);
	}

	private describeBoundMissionConflict(loadedMission: LoadedMission): string {
		return `Mission daemon is already bound to mission '${loadedMission.missionId}' on branch '${loadedMission.branchRef}'. Start a different daemon to operate another mission.`;
	}

	private resolveRuntimeId(runtimeId?: string): string {
		if (runtimeId) {
			if (!this.runtimes.has(runtimeId)) {
				throw new Error(`Mission agent runtime '${runtimeId}' is not registered in the server.`);
			}
			return runtimeId;
		}

		const defaultRuntimeId = this.runtimes.keys().next().value;
		if (!defaultRuntimeId) {
			throw new Error('No mission agent runtimes are configured in the server.');
		}

		return defaultRuntimeId;
	}

	private toSessionPhaseNotification(
		missionId: string,
		event: MissionAgentEvent
	): Notification | undefined {
		switch (event.type) {
			case 'session-started':
			case 'session-resumed':
				return {
					type: 'mission.agent.session',
					missionId,
					sessionId: event.state.sessionId,
					phase: 'spawned',
					lifecycleState: event.state.lifecycleState
				};
			case 'session-state-changed':
				if (
					event.state.lifecycleState === 'running' ||
					event.state.lifecycleState === 'awaiting-input'
				) {
					return {
						type: 'mission.agent.session',
						missionId,
						sessionId: event.state.sessionId,
						phase: 'active',
						lifecycleState: event.state.lifecycleState
					};
				}
				return undefined;
			case 'session-completed':
			case 'session-failed':
			case 'session-cancelled':
				return {
					type: 'mission.agent.session',
					missionId,
					sessionId: event.state.sessionId,
					phase: 'terminated',
					lifecycleState: event.state.lifecycleState
				};
			default:
				return undefined;
		}
	}

	private resolveMissionIssueId(params: MissionStart): number | undefined {
		return typeof params.brief.issueId === 'number' ? params.brief.issueId : undefined;
	}
}

export async function startDaemon(
	options: { repoRoot: string } & DaemonOptions
): Promise<Daemon> {
	const server = new Daemon(options.repoRoot, options);
	await server.listen();
	return server;
}

function hasExplicitMissionIdentitySelector(selector: MissionSelector): boolean {
	return Boolean(selector.missionId?.trim() || selector.issueId !== undefined);
}
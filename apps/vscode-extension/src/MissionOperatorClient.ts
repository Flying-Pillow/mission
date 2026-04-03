import * as vscode from 'vscode';
import {
	connectDaemonClient,
	Mission,
	resolveDaemonLaunchModeFromModule,
	type MissionSelector,
	type MissionStatus,
	type MissionStageId,
	type DaemonClient,
	type Notification
} from '@flying-pillow/mission-core';
import type {
	MissionGitHubIssue,
	MissionGateIntent
} from './MissionModels.js';
import { MissionWorkspaceResolver } from './MissionWorkspaceResolver.js';

export class MissionOperatorClient implements vscode.Disposable {
	private daemonClient?: DaemonClient;
	private mission?: Mission;
	private daemonClientSubscription?: { dispose(): void };
	private readonly missionStatusEmitter = new vscode.EventEmitter<MissionStatus>();
	private readonly notificationEmitter = new vscode.EventEmitter<Notification>();
	private lastStatus?: MissionStatus;
	private selectorState: MissionSelector = {};

	public constructor(private readonly outputChannel: vscode.OutputChannel) {}

	public readonly onDidMissionStatusChange = this.missionStatusEmitter.event;
	public readonly onDidNotification = this.notificationEmitter.event;

	public dispose(): void {
		this.daemonClientSubscription?.dispose();
		this.daemonClientSubscription = undefined;
		this.daemonClient?.dispose();
		this.daemonClient = undefined;
		this.mission = undefined;
		this.selectorState = {};
		this.missionStatusEmitter.dispose();
		this.notificationEmitter.dispose();
	}

	public async getMissionStatus(): Promise<MissionStatus> {
		return this.lastStatus ?? this.refreshMissionStatus();
	}

	public async refreshMissionStatus(): Promise<MissionStatus> {
		const mission = await this.getScopedMission();
		const status = await mission.status();
		this.updateStatus(status);
		return status;
	}

	public async bootstrapMissionFromIssue(issueNumber: number): Promise<MissionStatus> {
		const mission = await this.getMission();
		const status = await mission.bootstrapFromIssue(issueNumber);
		this.updateStatus(status);
		return status;
	}

	public async evaluateGate(intent: MissionGateIntent) {
		const mission = await this.getScopedMission();
		return mission.evaluateGate(intent);
	}

	public async transitionMissionStage(toStage: MissionStageId): Promise<MissionStatus> {
		const mission = await this.getScopedMission();
		const status = await mission.transition(toStage);
		this.updateStatus(status);
		return status;
	}

	public async deliverMission(): Promise<MissionStatus> {
		const mission = await this.getScopedMission();
		const status = await mission.deliver();
		this.updateStatus(status);
		return status;
	}

	public async listOpenGitHubIssues(limit = 50): Promise<MissionGitHubIssue[]> {
		const mission = await this.getScopedMission();
		return mission.listOpenGitHubIssues(limit);
	}

	private async getMission(): Promise<Mission> {
		if (this.mission) {
			return this.mission;
		}

		const repoRoot = await MissionWorkspaceResolver.resolveOperationalRoot();
		if (!repoRoot) {
			throw new Error('Mission could not resolve an operational workspace root.');
		}

		this.outputChannel.appendLine(`Mission connecting daemon client for ${repoRoot}.`);
		const daemonClient = await connectDaemonClient({
			repoRoot,
			preferredLaunchMode: resolveDaemonLaunchModeFromModule(import.meta.url)
		});
		this.daemonClientSubscription = daemonClient.onDidEvent((event) => {
			this.notificationEmitter.fire(event);
			if (event.type === 'mission.status') {
				this.updateStatus(event.status);
				return;
			}
			if (event.type === 'mission.agent.event' || event.type === 'mission.agent.session') {
				void this.refreshMissionStatus().catch((error: unknown) => {
					this.outputChannel.appendLine(`Mission refresh failed: ${toErrorMessage(error)}`);
				});
			}
		});
		this.daemonClient = daemonClient;
		this.mission = new Mission(daemonClient);
		return this.mission;
	}

	private async getScopedMission(): Promise<Mission> {
		const mission = await this.getMission();
		return mission.withSelector(this.selectorState);
	}

	private updateStatus(status: MissionStatus): void {
		this.selectorState = buildSelectorFromStatus(status);
		this.lastStatus = status;
		this.missionStatusEmitter.fire(status);
	}
}

function buildSelectorFromStatus(status: MissionStatus): MissionSelector {
	return {
		...(status.missionId ? { missionId: status.missionId } : {}),
		...(status.issueId !== undefined ? { issueId: status.issueId } : {}),
		...(status.branchRef ? { branchRef: status.branchRef } : {})
	};
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

import * as vscode from 'vscode';
import { MISSION_ARTIFACT_LABELS, type MissionProductKey } from '@flying-pillow/mission-core';
import type { MissionMissionSnapshot } from './MissionModels.js';
import { MissionSessionController } from './MissionSessionController.js';

type MissionTreeNode = vscode.TreeItem & {
	children?: MissionTreeNode[];
};

export class MissionTreeDataProvider
	implements vscode.TreeDataProvider<MissionTreeNode>, vscode.Disposable
{
	private readonly changeEmitter = new vscode.EventEmitter<MissionTreeNode | undefined | void>();
	private readonly subscription: vscode.Disposable;

	public constructor(private readonly sessionController: MissionSessionController) {
		this.subscription = this.sessionController.onDidMissionStatusChange(() => {
			this.changeEmitter.fire();
		});
	}

	public readonly onDidChangeTreeData = this.changeEmitter.event;

	public dispose(): void {
		this.subscription.dispose();
		this.changeEmitter.dispose();
	}

	public getTreeItem(element: MissionTreeNode): vscode.TreeItem {
		return element;
	}

	public async getChildren(element?: MissionTreeNode): Promise<MissionTreeNode[]> {
		if (element) {
			return element.children ?? [];
		}

		return this.buildRootNodes(this.sessionController.getSnapshot());
	}

	private buildRootNodes(snapshot: MissionMissionSnapshot): MissionTreeNode[] {
		const status = snapshot.status;
		if (!status.found) {
			return [
				new vscode.TreeItem(snapshot.errorMessage ?? 'No active mission', vscode.TreeItemCollapsibleState.None)
			];
		}

		const missionNode = new vscode.TreeItem(
			status.title ?? status.missionId ?? 'Active mission',
			vscode.TreeItemCollapsibleState.Expanded
		) as MissionTreeNode;
		missionNode.description = status.stage ?? 'unknown';
		missionNode.children = [
			this.buildArtifactsNode(status),
			this.buildStagesNode(status),
			this.buildCurrentTaskNode(status)
		].filter(Boolean) as MissionTreeNode[];
		return [missionNode];
	}

	private buildArtifactsNode(status: MissionMissionSnapshot['status']): MissionTreeNode {
		const artifacts = Object.entries(status.productFiles ?? {}) as Array<[MissionProductKey, string]>;
		const node = new vscode.TreeItem('Product Files', vscode.TreeItemCollapsibleState.Collapsed) as MissionTreeNode;
		node.children = artifacts.map(([artifactKey, filePath]) => {
			const child = new vscode.TreeItem(
				MISSION_ARTIFACT_LABELS[artifactKey],
				vscode.TreeItemCollapsibleState.None
			) as MissionTreeNode;
			child.description = fileNameFromPath(filePath);
			child.command = {
				command: 'mission.openMissionArtifact',
				title: 'Open Mission Artifact',
				arguments: [{ artifactKey, artifactPath: filePath }]
			};
			child.contextValue = 'mission.artifact';
			return child;
		});
		return node;
	}

	private buildStagesNode(status: MissionMissionSnapshot['status']): MissionTreeNode {
		const node = new vscode.TreeItem('Stages', vscode.TreeItemCollapsibleState.Expanded) as MissionTreeNode;
		node.children = (status.stages ?? []).map((stage) => {
			const stageNode = new vscode.TreeItem(
				stage.stage.toUpperCase(),
				vscode.TreeItemCollapsibleState.Collapsed
			) as MissionTreeNode;
			stageNode.description = `${stage.status} ${String(stage.completedTaskCount)}/${String(stage.taskCount)}`;
			stageNode.children = stage.tasks.map((task) => {
				const taskNode = new vscode.TreeItem(task.subject, vscode.TreeItemCollapsibleState.None) as MissionTreeNode;
				taskNode.description = task.status;
				taskNode.tooltip = `${task.relativePath}\n\n${task.instruction}`;
				taskNode.command = {
					command: 'vscode.open',
					title: 'Open Task File',
					arguments: [vscode.Uri.file(task.filePath)]
				};
				taskNode.contextValue = 'mission.task';
				return taskNode;
			});
			return stageNode;
		});
		return node;
	}

	private buildCurrentTaskNode(status: MissionMissionSnapshot['status']): MissionTreeNode | undefined {
		const activeTasks = status.activeTasks ?? [];
		const readyTasks = status.readyTasks ?? [];
		const tasks = activeTasks.length > 0 ? activeTasks : readyTasks;
		if (tasks.length === 0) {
			return undefined;
		}

		const node = new vscode.TreeItem(
			activeTasks.length > 0 ? 'Active Tasks' : 'Ready Tasks',
			vscode.TreeItemCollapsibleState.Expanded
		) as MissionTreeNode;
		node.children = tasks.map((task) => {
			const taskNode = new vscode.TreeItem(task.subject, vscode.TreeItemCollapsibleState.None) as MissionTreeNode;
			taskNode.description = task.status;
			taskNode.tooltip = `${task.relativePath}\n\n${task.instruction}`;
			taskNode.command = {
				command: 'vscode.open',
				title: 'Open Task File',
				arguments: [vscode.Uri.file(task.filePath)]
			};
			return taskNode;
		});
		return node;
	}
}

function fileNameFromPath(filePath: string): string {
	const parts = filePath.replace(/\\/g, '/').split('/');
	return parts[parts.length - 1] ?? filePath;
}

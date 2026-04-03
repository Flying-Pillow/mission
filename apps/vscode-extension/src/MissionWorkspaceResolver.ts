/**
 * @file apps/vscode-extension/src/MissionWorkspaceResolver.ts
 * @description Resolves the operational Mission repository root from the current VS Code workspace context.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { resolveGitControlRepoRoot } from '@flying-pillow/mission-core';
import { MissionSettings } from './MissionSettings.js';

type WorkspaceCandidate = {
	path: string;
	scope?: vscode.WorkspaceFolder | vscode.Uri;
};

export class MissionWorkspaceResolver {
	public static async resolveOperationalRoot(preferredUri?: vscode.Uri): Promise<string | undefined> {
		const candidates = this.collectCandidates(preferredUri);
		for (const candidate of candidates) {
			const configuredRoot = MissionSettings.getRootFolder(candidate.scope);
			if (configuredRoot && (await this.pathExists(configuredRoot))) {
				return configuredRoot;
			}

			const controlGitRoot = resolveGitControlRepoRoot(candidate.path);
			if (controlGitRoot) {
				return controlGitRoot;
			}

			const repoLocalRoot = await this.findAncestor(candidate.path, async (currentPath) =>
				this.pathExists(MissionSettings.resolveControlDirectoryPath(currentPath))
			);
			if (repoLocalRoot) {
				return repoLocalRoot;
			}

			const configuredMarkerRoot = await this.findAncestor(candidate.path, async (currentPath) => {
				const missionFolderPath = MissionSettings.resolveMissionFolderPath(
					currentPath,
					candidate.scope
				);
				if (await this.pathExists(missionFolderPath)) {
					return true;
				}

				const skillsFolderPath = MissionSettings.resolveSkillsFolderPath(
					currentPath,
					candidate.scope
				);
				return this.pathExists(skillsFolderPath);
			});
			if (configuredMarkerRoot) {
				return configuredMarkerRoot;
			}

			const monorepoRoot = await this.findAncestor(candidate.path, async (currentPath) =>
				this.pathExists(path.join(currentPath, 'pnpm-workspace.yaml'))
			);
			if (monorepoRoot) {
				return monorepoRoot;
			}

			const gitRoot = await this.findAncestor(candidate.path, async (currentPath) =>
				this.pathExists(path.join(currentPath, '.git'))
			);
			if (gitRoot) {
				return gitRoot;
			}
		}

		return candidates[0]?.path;
	}

	private static collectCandidates(preferredUri?: vscode.Uri): WorkspaceCandidate[] {
		const candidates: WorkspaceCandidate[] = [];
		const addCandidate = (candidatePath: string | undefined, scope?: vscode.WorkspaceFolder | vscode.Uri) => {
			if (!candidatePath) {
				return;
			}

			if (!candidates.some((candidate) => candidate.path === candidatePath)) {
				candidates.push({ path: candidatePath, scope });
			}
		};

		if (preferredUri?.scheme === 'file') {
			const preferredWorkspaceFolder = vscode.workspace.getWorkspaceFolder(preferredUri);
			addCandidate(preferredWorkspaceFolder?.uri.fsPath, preferredWorkspaceFolder);
			addCandidate(path.dirname(preferredUri.fsPath), preferredWorkspaceFolder ?? preferredUri);
		}

		const activeDocumentUri = vscode.window.activeTextEditor?.document.uri;
		if (activeDocumentUri?.scheme === 'file') {
			const activeWorkspaceFolder = vscode.workspace.getWorkspaceFolder(activeDocumentUri);
			addCandidate(activeWorkspaceFolder?.uri.fsPath, activeWorkspaceFolder);
			addCandidate(path.dirname(activeDocumentUri.fsPath), activeWorkspaceFolder ?? activeDocumentUri);
		}

		for (const folder of vscode.workspace.workspaceFolders ?? []) {
			addCandidate(folder.uri.fsPath, folder);
		}

		return candidates;
	}

	private static async findAncestor(
		startPath: string,
		predicate: (candidatePath: string) => Promise<boolean>
	): Promise<string | undefined> {
		let currentPath = startPath;
		while (true) {
			if (await predicate(currentPath)) {
				return currentPath;
			}

			const parentPath = path.dirname(currentPath);
			if (parentPath === currentPath) {
				return undefined;
			}

			currentPath = parentPath;
		}
	}

	private static async pathExists(candidatePath: string): Promise<boolean> {
		try {
			await fs.stat(candidatePath);
			return true;
		} catch {
			return false;
		}
	}
}
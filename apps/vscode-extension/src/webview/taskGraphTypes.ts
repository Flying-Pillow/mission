/**
 * @file apps/vscode-extension/src/webview/taskGraphTypes.ts
 * @description Defines Svelte Flow node data for the Mission task graph webview.
 */

export type MissionTaskGraphNodeData = {
	id: string;
	title: string;
	statusLabel: string;
	progress: number;
	summary: string;
	stale: boolean;
	current: boolean;
	selected: boolean;
	connected: boolean;
	actionEnabled: boolean;
	requiredSkills: string[];
	onSelect: (taskId: string) => void;
	onOpenGuidance: (taskId: string) => void;
};
/** @jsxImportSource @opentui/solid */

import { createCliRenderer } from '@opentui/core';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
	GateIntent,
	Mission,
	MissionAgentConsoleEvent,
	MissionAgentConsoleState,
	MissionCommandDescriptor,
	MissionAgentSessionRecord,
	MissionBrief,
	MissionProductKey,
	MissionSelector,
	MissionStageId,
	MissionStageStatus,
	MissionStatus,
	MissionTaskState,
	TrackedIssueSummary,
	MissionType
} from '@flying-pillow/mission-core';
import { render, useKeyboard, useRenderer, useTerminalDimensions } from '@opentui/solid';
import { Show, createEffect, createMemo, createSignal, onCleanup, onMount, type JSXElement, untrack } from 'solid-js';
import { CockpitScreen } from './components/CockpitScreen.js';
import {
	applyCockpitTheme,
	cockpitThemes,
	type CockpitThemeName,
	isCockpitThemeName
} from './components/cockpitTheme.js';
import type { ConsolePanelContent, ConsolePanelTab } from './components/ConsolePanel.js';
import { cockpitTheme } from './components/cockpitTheme.js';
import { IssuesPanel } from './components/IssuesPanel.js';
import type { ProgressRailItem, ProgressRailItemState } from './components/ProgressRail.js';
import { SelectPanel } from './components/SelectPanel.js';
import type { CommandItem, FocusArea, SelectItem } from './components/types.js';

type CockpitConnection = {
	mission: Mission;
	status: MissionStatus;
	dispose: () => void;
};

type RunCockpitAppOptions = {
	initialSelector: MissionSelector;
	initialTheme: CockpitThemeName;
	initialConnection?: CockpitConnection;
	initialConnectionError?: string;
	connect: (selector: MissionSelector) => Promise<CockpitConnection>;
};

type CockpitShellProps = RunCockpitAppOptions;

type DaemonState = 'connected' | 'degraded' | 'booting';
type CockpitMode = 'idle' | 'selected';
type PickerMode = 'mission-select' | 'issue-select' | 'command-select' | 'theme-select';
type CenterPanelMode = 'console' | 'mission-select' | 'issue-select' | 'command-select' | 'theme-select';
type MarkdownDocumentState =
	| { status: 'loading' }
	| { status: 'ready'; content: string }
	| { status: 'error'; error: string };
type ConsoleTabDescriptor =
	| {
		id: string;
		label: string;
		kind: 'artifact' | 'task';
		sourcePath: string;
	  }
	| {
		id: string;
		label: string;
		kind: 'session';
		sessionId: string;
	  }
	| {
		id: string;
		label: string;
		kind: 'daemon';
	  };

const missionFocusOrder: FocusArea[] = ['stages', 'tasks', 'sessions', 'command'];
const idleFocusOrder: FocusArea[] = ['sessions', 'command'];

export async function runCockpitApp(options: RunCockpitAppOptions): Promise<void> {
	const renderer = await createCliRenderer({
		exitOnCtrlC: false,
		targetFps: 30
	});
	await render(() => <MissionCockpitApp {...options} />, renderer);
	await new Promise<void>((resolve) => {
		renderer.once('destroy', () => {
			resolve();
		});
	});
}

function MissionCockpitApp({
	initialSelector,
	initialTheme,
	initialConnection,
	initialConnectionError,
	connect
}: CockpitShellProps) {
	const renderer = useRenderer();
	const terminal = useTerminalDimensions();
	const [selector, setSelector] = createSignal<MissionSelector>(initialSelector);
	const [connection, setConnection] = createSignal<CockpitConnection | undefined>(initialConnection);
	const [status, setStatus] = createSignal<MissionStatus>(initialConnection?.status ?? { found: false });
	const [daemonState, setDaemonState] = createSignal<DaemonState>(
		initialConnection ? 'connected' : initialConnectionError ? 'degraded' : 'booting'
	);
	const [activityLog, setActivityLog] = createSignal<string[]>([
		createInitialStatusMessage(initialConnectionError)
	]);
	const [markdownDocumentByPath, setMarkdownDocumentByPath] = createSignal<Record<string, MarkdownDocumentState>>({});
	const [consoleStateBySessionId, setConsoleStateBySessionId] = createSignal<
		Record<string, MissionAgentConsoleState>
	>({});
	const [inputValue, setInputValue] = createSignal<string>('');
	const [isRunningCommand, setIsRunningCommand] = createSignal<boolean>(false);
	const [focusArea, setFocusArea] = createSignal<FocusArea>('command');
	const [activePicker, setActivePicker] = createSignal<PickerMode | undefined>();
	const [commandPickerQuery, setCommandPickerQuery] = createSignal<string>('');
	const [selectedPickerItemId, setSelectedPickerItemId] = createSignal<string | undefined>();
	const [openIssues, setOpenIssues] = createSignal<TrackedIssueSummary[]>([]);
	const [selectedStageId, setSelectedStageId] = createSignal<MissionStageId | undefined>(initialConnection?.status.stage);
	const [selectedTaskId, setSelectedTaskId] = createSignal<string>('');
	const [selectedSessionId, setSelectedSessionId] = createSignal<string | undefined>(
		pickPreferredSessionId(initialConnection?.status.agentSessions ?? [], undefined)
	);
	const [selectedConsoleTabId, setSelectedConsoleTabId] = createSignal<string | undefined>();
	const [consoleReloadNonce, setConsoleReloadNonce] = createSignal<number>(0);
	const [selectedThemeName, setSelectedThemeName] = createSignal<CockpitThemeName>(initialTheme);
	const [lastEvent, setLastEvent] = createSignal<string>('none');

	const mission = createMemo(() => connection()?.mission.withSelector(selector()));
	const stages = createMemo(() => status().stages ?? []);
	const sessions = createMemo(() => status().agentSessions ?? []);
	const selectedStage = createMemo(() => {
		const currentId = selectedStageId();
		return stages().find((stage) => stage.stage === currentId);
	});
	const stageTasks = createMemo(() => selectedStage()?.tasks ?? []);
	const selectedTask = createMemo(() => {
		const currentId = selectedTaskId();
		return stageTasks().find((task) => task.taskId === currentId);
	});
	const sessionsForTask = createMemo(() => {
		const taskId = selectedTask()?.taskId;
		if (!taskId) {
			return [];
		}
		return sessions()
			.filter((session) => session.taskId === taskId)
			.slice()
			.sort((left, right) => {
				const createdAtOrder = left.createdAt.localeCompare(right.createdAt);
				if (createdAtOrder !== 0) {
					return createdAtOrder;
				}
				return left.sessionId.localeCompare(right.sessionId);
			});
	});
	const currentTask = createMemo(() =>
		selectedTask() ?? status().activeTasks?.[0] ?? status().readyTasks?.[0]
	);
	const availableConsoleHeight = createMemo(() => Math.max(terminal().height - 26, 8));
	const stageItems = createMemo<ProgressRailItem[]>(() =>
		stages().map((stage) => ({
			id: stage.stage,
			label: formatStageLabel(stage.stage),
			state: mapStageState(stage.status),
			selected: stage.stage === selectedStageId(),
			subtitle: `${String(stage.completedTaskCount)}/${String(stage.taskCount)}`
		}))
	);
	const taskItems = createMemo<ProgressRailItem[]>(() =>
		stageTasks().map((task) => ({
			id: task.taskId,
			label: `${String(task.sequence)} ${task.subject}`,
			state: mapTaskState(task.status),
			selected: task.taskId === selectedTaskId(),
			subtitle: task.relativePath
		}))
	);
	const cockpitMode = createMemo<CockpitMode>(() => status().repoMode ?? 'idle');
	const missionPickerItems = createMemo<SelectItem[]>(() =>
		(status().availableMissions ?? []).map((candidate) => ({
			id: candidate.missionId,
			label: candidate.title,
			description: formatMissionPickerDescription(candidate)
		}))
	);
	const themePickerItems = createMemo<SelectItem[]>(() =>
		buildThemePickerItems(selectedThemeName())
	);
	const selectedIssueNumber = createMemo<number | undefined>(() => {
		const value = selectedPickerItemId();
		return value && /^\d+$/u.test(value) ? Number(value) : undefined;
	});
	const commandQuery = createMemo(() => commandPickerQuery());
	const showMissionPicker = createMemo(
		() => activePicker() === 'mission-select' && cockpitMode() === 'idle' && missionPickerItems().length > 0
	);
	const showIssuePicker = createMemo(
		() => activePicker() === 'issue-select' && cockpitMode() === 'idle' && openIssues().length > 0
	);
	const showThemePicker = createMemo(() => activePicker() === 'theme-select');
	const selectedMissionPickerItemId = createMemo(() =>
		pickSelectItemId(missionPickerItems(), selectedPickerItemId())
	);
	const connectionLabel = createMemo(() => `${daemonStateIcon(daemonState())} daemon ${daemonState()}`);
	const connectionColor = createMemo(() => daemonStateColor(daemonState()));
	const missionStatus = createMemo(() => {
		const currentStatus = status();
		const repoMode = currentStatus.repoMode ?? 'idle';
		return [
			`mission=${currentStatus.missionId ?? 'none'}`,
			`state=${repoMode}`,
			`branch=${currentStatus.repoCurrentBranch ?? 'unknown'}`,
			`event=${lastEvent()}`
		].join(' | ');
	});
	const availableCommands = createMemo<MissionCommandDescriptor[]>(() => {
		const filtered = (status().availableCommands ?? []).filter((command) => {
			if (command.scope === 'mission') {
				return true;
			}
			if (command.scope === 'stage') {
				return command.targetId === selectedStageId();
			}
			if (command.scope === 'task') {
				return command.targetId === selectedTaskId();
			}
			if (command.scope === 'session') {
				return command.targetId === selectedSessionId();
			}
			return false;
		});
		return [...filtered, themeCommandDescriptor];
	});
	const commandPickerItems = createMemo<CommandItem[]>(() =>
		buildCommandPickerItems(availableCommands(), commandQuery())
	);
	const showCommandPicker = createMemo(
		() => activePicker() === 'command-select' && commandQuery().length > 0
	);
	const selectedCommandPickerItemId = createMemo(() =>
		pickSelectItemId(commandPickerItems(), selectedPickerItemId())
	);
	const centerPanelMode = createMemo<CenterPanelMode>(() => {
		if (showMissionPicker()) {
			return 'mission-select';
		}
		if (showIssuePicker()) {
			return 'issue-select';
		}
		if (showThemePicker()) {
			return 'theme-select';
		}
		if (showCommandPicker()) {
			return 'command-select';
		}
		return 'console';
	});
	const focusOrder = createMemo<FocusArea[]>(() =>
		buildFocusOrder(
			cockpitMode() === 'selected' ? missionFocusOrder : idleFocusOrder,
			showMissionPicker() || showIssuePicker() || showCommandPicker() || showThemePicker()
		)
	);
	const commandHelp = createMemo(() => {
		const enabledCommands = availableCommands()
			.filter((command) => command.enabled)
			.map((command) => command.command);
		const uniqueCommands = [...new Set(enabledCommands)];
		if (uniqueCommands.length === 0) {
			return 'No commands available for the current selection.';
		}
		return `Available: ${uniqueCommands.join(', ')}`;
	});
	const screenTitle = createMemo(() => {
		if (cockpitMode() === 'idle') {
			return 'No Mission Selected';
		}
		return status().title ?? status().missionId ?? 'Mission';
	});
	const consoleEmptyLabel = createMemo(() => {
		if (cockpitMode() === 'idle') {
			return 'No mission matches the current branch. Use /start to create one or /select to choose from .mission/missions/active.';
		}
		return selectedTask()
			? 'No sessions for the selected task. Daemon output is shown below.'
			: 'Select a task to inspect its sessions. Daemon output is shown below.';
	});
	const consoleTabs = createMemo<ConsoleTabDescriptor[]>(() => {
		const tabs: ConsoleTabDescriptor[] = [];
		const stage = selectedStageId();
		const stageArtifact = stage ? stageArtifactProductKey(stage) : undefined;
		const stageArtifactPath = stageArtifact ? status().productFiles?.[stageArtifact] : undefined;

		if (stageArtifact && stageArtifactPath) {
			tabs.push({
				id: createArtifactTabId(stageArtifact),
				label: path.basename(stageArtifactPath),
				kind: 'artifact',
				sourcePath: stageArtifactPath
			});
		}

		const task = selectedTask();
		if (task?.filePath) {
			tabs.push({
				id: createTaskTabId(task.taskId),
				label: task.fileName,
				kind: 'task',
				sourcePath: task.filePath
			});
		}

		for (const session of sessionsForTask()) {
			tabs.push({
				id: createSessionTabId(session.sessionId),
				label: formatSessionTabLabel(session),
				kind: 'session',
				sessionId: session.sessionId
			});
		}

		tabs.push({
			id: daemonTabId,
			label: 'DAEMON',
			kind: 'daemon'
		});

		return tabs;
	});
	const renderedConsoleTabs = createMemo<ConsolePanelTab[]>(() =>
		consoleTabs().map((tab) => ({ id: tab.id, label: tab.label, kind: tab.kind }))
	);
	const selectedConsoleTab = createMemo(() => {
		const preferredId = pickPreferredConsoleTabId(consoleTabs(), selectedConsoleTabId(), selectedSessionId());
		return consoleTabs().find((tab) => tab.id === preferredId) ?? consoleTabs()[0];
	});
	const consoleContent = createMemo<ConsolePanelContent>(() => {
		const selectedTab = selectedConsoleTab();
		const reloadNonce = consoleReloadNonce();
		void reloadNonce;
		if (!selectedTab || selectedTab.kind === 'daemon') {
			return {
				kind: 'output',
				lines: activityLog().slice(-availableConsoleHeight()),
				emptyLabel: consoleEmptyLabel()
			};
		}
		if (selectedTab.kind === 'session') {
			const lines = consoleStateBySessionId()[selectedTab.sessionId]?.lines ?? [];
			return {
				kind: 'output',
				lines: lines.slice(-availableConsoleHeight()),
				emptyLabel: 'No output has been recorded for this session yet.'
			};
		}
		const documentState = markdownDocumentByPath()[selectedTab.sourcePath];
		if (!documentState || documentState.status === 'loading') {
			return {
				kind: 'markdown',
				status: 'loading',
				emptyLabel: 'Loading markdown...'
			};
		}
		if (documentState.status === 'error') {
			return {
				kind: 'markdown',
				status: 'error',
				emptyLabel: 'Unable to load markdown.',
				error: documentState.error
			};
		}
		return {
			kind: 'markdown',
			status: 'ready',
			markdown: documentState.content,
			emptyLabel: 'The markdown file is empty.'
		};
	});
	const mainPanel = createMemo<JSXElement | undefined>(() => {
		switch (centerPanelMode()) {
			case 'mission-select':
				return (
					<SelectPanel
						title="SELECT MISSION"
						items={missionPickerItems()}
						selectedItemId={selectedMissionPickerItemId()}
						focused={focusArea() === 'actions'}
						emptyLabel="No active missions are available under .mission/missions/active."
						helperText="Use arrow keys to highlight a mission. Enter binds it. Esc closes the picker."
						onItemChange={(itemId) => {
							setSelectedPickerItemId(itemId);
						}}
						onItemSelect={(itemId) => {
							void selectMissionById(itemId);
						}}
					/>
				);
			case 'issue-select':
				return (
					<IssuesPanel
						issues={openIssues()}
						selectedIssueNumber={selectedIssueNumber()}
						focused={focusArea() === 'actions'}
						emptyLabel="No open GitHub issues are available."
						helperText="Use arrow keys to highlight an issue. Enter starts a mission from it. Esc closes the picker."
						onIssueChange={(issueNumber) => {
							setSelectedPickerItemId(String(issueNumber));
						}}
						onIssueSelect={(issueNumber) => {
							void selectIssueByNumber(issueNumber);
						}}
					/>
				);
			case 'command-select':
				return (
					<SelectPanel
						title="COMMANDS"
						items={commandPickerItems()}
						selectedItemId={selectedCommandPickerItemId()}
						focused={focusArea() === 'actions' || focusArea() === 'command'}
						showFooterBadges={false}
						emptyLabel={
							commandQuery() === '/'
								? 'No commands are available for the current selection.'
								: `No commands match ${commandQuery()}.`
						}
						helperText="Keep typing to filter. Use arrow keys to highlight a command. Enter inserts it. Esc closes the list."
						onItemChange={(itemId) => {
							setSelectedPickerItemId(itemId);
						}}
						onItemSelect={(itemId) => {
							selectCommandById(itemId);
						}}
					/>
				);
			case 'theme-select':
				return (
					<SelectPanel
						title="THEMES"
						items={themePickerItems()}
						selectedItemId={pickSelectItemId(themePickerItems(), selectedPickerItemId())}
						focused={focusArea() === 'actions' || focusArea() === 'command'}
						emptyLabel="No themes are available."
						helperText="Use arrow keys to highlight a theme. Enter applies it for this cockpit session. Esc closes the picker."
						onItemChange={(itemId) => {
							setSelectedPickerItemId(itemId);
						}}
						onItemSelect={(itemId) => {
							void selectThemeById(itemId);
						}}
					/>
				);
			case 'console':
			default:
				return undefined;
		}
	});

	createEffect(() => {
		setSelectedStageId((current) => pickPreferredStageId(stages(), current, status().stage));
	});

	createEffect(() => {
		setSelectedTaskId((current) => pickPreferredTaskId(stageTasks(), current));
	});

	createEffect(() => {
		setSelectedSessionId((current) => pickPreferredSessionId(sessionsForTask(), current));
	});

	createEffect(() => {
		setSelectedConsoleTabId((current) => pickPreferredConsoleTabId(consoleTabs(), current, selectedSessionId()));
	});

	createEffect(() => {
		if (activePicker() !== 'mission-select') {
			return;
		}
		if (cockpitMode() !== 'idle' || missionPickerItems().length === 0) {
			closePicker();
			return;
		}
		setSelectedPickerItemId((current) => pickSelectItemId(missionPickerItems(), current));
	});

	createEffect(() => {
		if (activePicker() !== 'issue-select') {
			return;
		}
		if (cockpitMode() !== 'idle' || openIssues().length === 0) {
			closePicker();
			return;
		}
		setSelectedPickerItemId((current) => pickIssueNumberId(openIssues(), current));
	});

	createEffect(() => {
		if (activePicker() !== 'command-select') {
			return;
		}
		if (commandQuery().length === 0) {
			closePicker();
			return;
		}
		setSelectedPickerItemId((current) => pickSelectItemId(commandPickerItems(), current));
	});

	createEffect(() => {
		const order = focusOrder();
		if (!order.includes(focusArea())) {
			setFocusArea(order[0] ?? 'command');
		}
	});

	createEffect(() => {
		const currentMission = mission();
		if (!currentMission) {
			return;
		}
		const subscription = currentMission.onDidEvent((event) => {
			setLastEvent(event.type);
			const missionStatusEvent = asMissionStatusNotification(event);
			if (missionStatusEvent) {
				setStatus(missionStatusEvent.status);
				setSelector(buildSelectorFromStatus(missionStatusEvent.status));
				setDaemonState('connected');
				return;
			}
			if (event.type === 'mission.agent.console') {
				const nextConsole = applyConsoleEvent(event.event);
				const sessionId = nextConsole.sessionId;
				if (sessionId) {
					setConsoleStateBySessionId((current) => ({
						...current,
						[sessionId]: nextConsole
					}));
					if (nextConsole.awaitingInput) {
						setSelectedSessionId(sessionId);
						setSelectedConsoleTabId(createSessionTabId(sessionId));
						setFocusArea('command');
					}
				}
				return;
			}
			if (event.type === 'mission.agent.session') {
				appendLog(`session ${event.phase}: ${event.sessionId} (${event.lifecycleState})`);
				return;
			}
			if (event.type === 'mission.agent.event') {
				appendLog(describeAgentEvent(event.event));
			}
		});
		onCleanup(() => {
			subscription.dispose();
		});
	});

	createEffect(() => {
		const currentMission = mission();
		const taskSessions = sessionsForTask();
		if (!currentMission || taskSessions.length === 0) {
			return;
		}
		for (const session of taskSessions) {
			if (consoleStateBySessionId()[session.sessionId]) {
				continue;
			}
			void currentMission
				.getAgentConsoleState(session.sessionId)
				.then((nextConsole) => {
					const nextSessionId = nextConsole?.sessionId;
					if (nextSessionId) {
						setConsoleStateBySessionId((current) => ({
							...current,
							[nextSessionId]: nextConsole
						}));
					}
				})
				.catch(() => undefined);
		}
	});

	createEffect(() => {
		for (const tab of consoleTabs()) {
			if (tab.kind === 'artifact' || tab.kind === 'task') {
				void ensureMarkdownLoaded(tab.sourcePath);
			}
		}
	});

	createEffect(() => {
		const tab = selectedConsoleTab();
		if (!tab) {
			return;
		}
		void reloadConsoleTab(tab);
	});

	onMount(() => {
		renderer.setBackgroundColor(cockpitTheme.background);
	});

	createEffect(() => {
		selectedThemeName();
		renderer.setBackgroundColor(cockpitTheme.background);
	});

	onCleanup(() => {
		connection()?.dispose();
	});

	useKeyboard((key) => {
		if (key.ctrl && key.name === 'c') {
			renderer.destroy();
			return;
		}
		if (
			focusArea() !== 'actions' &&
			key.sequence === '/' &&
			(focusArea() !== 'command' ||
				inputValue().length === 0 ||
				inputValue() === '/' ||
				(activePicker() === 'command-select' && commandQuery() === '/'))
		) {
			setInputValue('/');
			updateCommandPicker('/');
			setFocusArea('command');
			return;
		}
		if (focusArea() === 'actions') {
			if (activePicker() === 'command-select') {
				if (key.name === 'backspace') {
					const nextValue = inputValue().slice(0, -1);
					setInputValue(nextValue);
					updateCommandPicker(nextValue);
					if (!parseCommandQuery(nextValue)) {
						closePicker({ clearCommandInput: true });
					}
					return;
				}
				if (isPrintableCommandFilterKey(key.sequence)) {
					const nextValue = normalizeCommandInputValue(`${inputValue()}${key.sequence}`);
					setInputValue(nextValue);
					updateCommandPicker(nextValue);
					return;
				}
			}
			if (key.name === 'escape') {
				closePicker({ clearCommandInput: activePicker() === 'command-select' && commandQuery() === '/' });
				return;
			}
			return;
		}
		if (key.name === 'up') {
			if (focusArea() === 'command' && showCommandPicker()) {
				previewCommandPickerSelection(-1);
				return;
			}
			moveFocus(-1);
			return;
		}
		if (key.name === 'down') {
			if (focusArea() === 'command' && showCommandPicker()) {
				previewCommandPickerSelection(1);
				return;
			}
			moveFocus(1);
			return;
		}
		if (key.name === 'escape' && focusArea() === 'command') {
			if (activePicker() === 'command-select') {
				closePicker({ clearCommandInput: commandQuery() === '/' });
			}
			setInputValue('');
			setFocusArea('command');
			return;
		}
		if ((key.name === 'q' || key.sequence === 'q') && focusArea() !== 'command') {
			renderer.destroy();
			return;
		}
		if (focusArea() === 'command') {
			return;
		}
		if (key.name === 'left') {
			moveSelection(-1);
			return;
		}
		if (key.name === 'right') {
			moveSelection(1);
		}
	});

	function moveFocus(delta: number): void {
		const order = focusOrder();
		const currentIndex = order.indexOf(focusArea());
		const nextIndex = (currentIndex + delta + order.length) % order.length;
		setFocusArea(order[nextIndex] ?? 'command');
	}

	function moveSelection(delta: number): void {
		switch (focusArea()) {
			case 'stages': {
				const nextStageId = moveStageSelection(stages(), selectedStageId(), delta);
				selectStage(nextStageId);
				break;
			}
			case 'tasks': {
				const nextTaskId = moveTaskSelection(stageTasks(), selectedTaskId(), delta);
				selectTask(nextTaskId);
				break;
			}
			case 'sessions':
				selectConsoleTab(moveConsoleTabSelection(consoleTabs(), selectedConsoleTabId(), delta));
				break;
			default:
				break;
		}
	}

	async function ensureMarkdownLoaded(sourcePath: string, forceReload = false): Promise<void> {
		const existing = untrack(markdownDocumentByPath)[sourcePath];
		if (!forceReload && (existing?.status === 'loading' || existing?.status === 'ready')) {
			return;
		}
		setMarkdownDocumentByPath((current) => ({
			...current,
			[sourcePath]: { status: 'loading' }
		}));
		try {
			const content = await readFile(sourcePath, 'utf8');
			setMarkdownDocumentByPath((current) => ({
				...current,
				[sourcePath]: { status: 'ready', content }
			}));
		} catch (error) {
			setMarkdownDocumentByPath((current) => ({
				...current,
				[sourcePath]: { status: 'error', error: toErrorMessage(error) }
			}));
		}
	}

	async function reloadConsoleTab(tab: ConsoleTabDescriptor): Promise<void> {
		setConsoleReloadNonce((current) => current + 1);
		if (tab.kind === 'artifact' || tab.kind === 'task') {
			await ensureMarkdownLoaded(tab.sourcePath, true);
			return;
		}
		if (tab.kind !== 'session') {
			return;
		}
		const currentMission = mission();
		if (!currentMission) {
			return;
		}
		try {
			const nextConsole = await currentMission.getAgentConsoleState(tab.sessionId);
			const nextSessionId = nextConsole?.sessionId;
			if (!nextSessionId) {
				return;
			}
			setConsoleStateBySessionId((current) => ({
				...current,
				[nextSessionId]: nextConsole
			}));
		} catch {
			return;
		}
	}

	function selectConsoleTab(tabId: string | undefined): void {
		if (!tabId) {
			return;
		}
		setSelectedConsoleTabId(tabId);
		const nextTab = consoleTabs().find((tab) => tab.id === tabId);
		if (nextTab?.kind === 'session') {
			setSelectedSessionId(nextTab.sessionId);
		}
		if (nextTab) {
			void reloadConsoleTab(nextTab);
		}
		setFocusArea('command');
	}

	function selectStage(stageId: MissionStageId | undefined): void {
		if (!stageId) {
			return;
		}
		setSelectedStageId(stageId);
		const nextStage = stages().find((stage) => stage.stage === stageId);
		const hasTaskFollowUp = (nextStage?.tasks.length ?? 0) > 1;
		setFocusArea(hasTaskFollowUp ? 'tasks' : 'command');
	}

	function selectTask(taskId: string): void {
		if (!taskId) {
			return;
		}
		setSelectedTaskId(taskId);
		const hasSessionFollowUp = sessions().filter((session) => session.taskId === taskId).length > 1;
		setFocusArea(hasSessionFollowUp ? 'sessions' : 'command');
	}

	function previewCommandPickerSelection(delta: number): void {
		const nextId = movePickerSelection(commandPickerItems(), selectedPickerItemId(), delta);
		if (!nextId) {
			return;
		}
		setSelectedPickerItemId(nextId);
		const nextCommand = commandPickerItems().find((item) => item.id === nextId);
		if (nextCommand) {
			setInputValue(nextCommand.command);
		}
	}

	async function replaceConnection(next: CockpitConnection | undefined): Promise<void> {
		const previous = connection();
		if (previous && previous !== next) {
			previous.dispose();
		}
		setConnection(next);
	}

	function appendLog(message: string): void {
		const timestamp = new Date().toISOString().slice(11, 19);
		setActivityLog((current) => [...current, `[${timestamp}] ${message}`].slice(-240));
	}

	function appendLogLines(lines: string[]): void {
		for (const line of lines) {
			appendLog(line);
		}
	}

	function openMissionPicker(): void {
		if (missionPickerItems().length === 0) {
			appendLog('No active missions are available under .mission/missions/active.');
			return;
		}
		setActivePicker('mission-select');
		setSelectedPickerItemId((current) => pickSelectItemId(missionPickerItems(), current));
		setFocusArea('actions');
	}

	function openIssuePicker(): void {
		if (openIssues().length === 0) {
			appendLog('No open GitHub issues are available.');
			return;
		}
		setActivePicker('issue-select');
		setSelectedPickerItemId((current) => pickIssueNumberId(openIssues(), current));
		setFocusArea('actions');
	}

	function openThemePicker(): void {
		setCommandPickerQuery('');
		setActivePicker('theme-select');
		setSelectedPickerItemId((current) => pickSelectItemId(themePickerItems(), current));
		setFocusArea('actions');
	}

	function updateCommandPicker(value: string): void {
		const query = parseCommandQuery(value);
		setCommandPickerQuery(query);

		if (!query) {
			if (activePicker() === 'command-select') {
				closePicker();
			}
			return;
		}
		if (activePicker() === 'mission-select' || activePicker() === 'issue-select' || activePicker() === 'theme-select') {
			return;
		}
		const items = buildCommandPickerItems(availableCommands(), query);
		setActivePicker('command-select');
		setSelectedPickerItemId((current) => pickSelectItemId(items, current));
	}

	function closePicker(options?: { clearCommandInput?: boolean }): void {
		setActivePicker(undefined);
		setCommandPickerQuery('');
		if (options?.clearCommandInput) {
			setInputValue('');
		}
		if (focusArea() === 'actions') {
			setFocusArea('command');
		}
	}

	function selectCommandById(commandId: string): void {
		const nextCommand = commandPickerItems().find((item) => item.id === commandId);
		if (!nextCommand) {
			return;
		}
		setSelectedPickerItemId(commandId);
		if (nextCommand.command === '/theme') {
			openThemePicker();
			setInputValue('');
			return;
		}
		setInputValue(nextCommand.command);
		closePicker();
	}

	async function selectThemeById(themeId: string): Promise<void> {
		if (!isCockpitThemeName(themeId)) {
			appendLog(`Unknown theme '${themeId}'.`);
			return;
		}
		applyCockpitTheme(themeId);
		setSelectedThemeName(themeId);
		setSelectedPickerItemId(themeId);
		appendLog(`Theme set to ${themeId} for this cockpit session.`);
		closePicker();
		setFocusArea('command');
	}

	async function selectMissionById(missionId: string): Promise<void> {
		const nextMission = await connectMission({ missionId });
		if (!nextMission) {
			return;
		}
		setSelectedPickerItemId(missionId);
		closePicker();
		appendLog(`Selected mission ${missionId}.`);
	}

	async function selectIssueByNumber(issueNumber: number): Promise<void> {
		const started = await startIssueMission(issueNumber);
		if (!started) {
			return;
		}
		setSelectedPickerItemId(String(issueNumber));
		closePicker();
	}

	async function connectMission(nextSelector: MissionSelector = selector()): Promise<Mission | undefined> {
		setDaemonState('booting');
		try {
			const nextConnection = await connect(nextSelector);
			await replaceConnection(nextConnection);
			setSelector(nextSelector);
			setStatus(nextConnection.status);
			setDaemonState('connected');
			appendLog(
				nextConnection.status.found
					? `Connected to ${nextConnection.status.missionId ?? 'the active mission'}.`
					: `Connected to the daemon. Repo mode is ${nextConnection.status.repoMode ?? 'idle'}.`
			);
			return nextConnection.mission.withSelector(nextSelector);
		} catch (error) {
			await replaceConnection(undefined);
			setDaemonState('degraded');
			appendLog(toErrorMessage(error));
			return undefined;
		}
	}

	async function refreshMissionStatus(): Promise<void> {
		const currentMission = mission() ?? (await connectMission(selector()));
		if (!currentMission) {
			setStatus({ found: false });
			return;
		}
		try {
			const next = await currentMission.status();
			setStatus(next);
			setSelector(buildSelectorFromStatus(next));
			setDaemonState('connected');
		} catch (error) {
			setDaemonState('degraded');
			appendLog(toErrorMessage(error));
		}
	}

	async function loadIssues(): Promise<void> {
		if (!status().repoTrackingEnabled) {
			appendLog('GitHub tracking is not enabled in .mission/settings.json.');
			return;
		}
		if (status().found) {
			appendLog('Issue intake is only available when no mission is selected.');
			return;
		}
		const currentMission = mission() ?? (await connectMission(selector()));
		if (!currentMission) {
			appendLog('Unable to connect to list GitHub issues.');
			return;
		}
		const nextIssues = await currentMission.listOpenGitHubIssues(20);
		setOpenIssues(nextIssues);
		appendLog(`Loaded ${String(nextIssues.length)} open GitHub issue(s).`);
		if (nextIssues.length === 0) {
			appendLog('No open GitHub issues are available.');
			return;
		}
		openIssuePicker();
	}

	async function startIssueMission(issueNumber: number): Promise<boolean> {
		const currentMission = mission() ?? (await connectMission(selector()));
		if (!currentMission) {
			appendLog('Unable to connect to bootstrap an issue mission.');
			return false;
		}
		try {
			const next = await currentMission.bootstrapFromIssue(issueNumber);
			setStatus(next);
			setSelector(buildSelectorFromStatus(next));
			appendLog(`Mission ${next.missionId ?? 'unknown'} bootstrapped from issue ${String(issueNumber)}.`);
			return true;
		} catch (error) {
			appendLog(toErrorMessage(error));
			return false;
		}
	}

	async function executeCommand(rawCommand: string): Promise<void> {
		const trimmed = rawCommand.trim();
		if (!trimmed) {
			return;
		}
		setIsRunningCommand(true);
		try {
			if (!trimmed.startsWith('/')) {
				const sessionId = selectedSessionId();
				const currentMission = mission();
				if (!sessionId || !currentMission) {
					appendLog('No selected session is available. Use /launch first.');
					return;
				}
				await currentMission.sendAgentInput(sessionId, trimmed);
				appendLog(`Sent input to ${sessionId}.`);
				return;
			}

			const [instruction, ...args] = trimmed.split(/\s+/u);
			if (!instruction) {
				return;
			}
			switch (instruction.toLowerCase()) {
				case '/help':
					appendLogLines([
						'/repo',
						'/status',
						'/theme [ocean|sand]',
						'/issues',
						'/issue <number>',
						'/start <title> | <body> | [type] | [branch]',
						'/select [missionId]',
						'/launch [runtimeId]',
						'/gate [implement|verify|audit|deliver]',
						'/transition <stage>',
						'/cancel [sessionId]',
						'/terminate [sessionId]',
						'/deliver',
						'/sessions',
						'/clear',
						'/quit'
					]);
					return;
				case '/clear':
					setActivityLog([]);
					return;
				case '/quit':
					renderer.destroy();
					return;
				case '/status':
					await refreshMissionStatus();
					appendLog(status().found ? `Mission ${status().missionId ?? 'unknown'} refreshed.` : `Repo mode is ${status().repoMode ?? 'idle'}.`);
					return;
				case '/issues':
					await loadIssues();
					return;
				case '/theme': {
					const requestedTheme = args[0];
					if (!requestedTheme) {
						openThemePicker();
						return;
					}
					await selectThemeById(requestedTheme.toLowerCase());
					return;
				}
				case '/issue': {
					const issueNumber = args[0];
					if (!issueNumber) {
						await loadIssues();
						return;
					}
					if (!/^\d+$/u.test(issueNumber)) {
						appendLog('Usage: /issue <number>');
						return;
					}
					if (status().found) {
						appendLog('Issue intake is only available when no mission is selected.');
						return;
					}
					await selectIssueByNumber(Number(issueNumber));
					return;
				}
				case '/start': {
					if (status().repoIsGitRepository === false) {
						appendLog('Mission requires a Git repository before creating missions.');
						return;
					}
					const payload = trimmed.slice('/start'.length).trim();
					const parts = payload.split('|').map((part) => part.trim());
					const title = parts[0];
					const body = parts[1];
					const missionType = normalizeMissionType(parts[2] ?? 'feat');
					const branchRef = parts[3] || undefined;
					if (!title || !body) {
						appendLog('Usage: /start <title> | <body> | [feat|fix|docs|refactor|task] | [branch]');
						return;
					}
					if (!missionType) {
						appendLog('Mission type must be one of: feat, fix, docs, refactor, task.');
						return;
					}
					const currentMission = mission() ?? (await connectMission(selector()));
					if (!currentMission) {
						appendLog('Unable to connect to create a new mission.');
						return;
					}
					const brief: MissionBrief = { title, body, type: missionType };
					const next = await currentMission.start({
						brief,
						...(branchRef ? { branchRef } : {})
					});
					setStatus(next);
					setSelector(buildSelectorFromStatus(next));
					appendLog(`Mission ${next.missionId ?? 'unknown'} started on ${next.branchRef ?? branchRef}.`);
					return;
				}
				case '/select': {
					const missionId = args[0]?.trim();
					if (!missionId) {
						openMissionPicker();
						return;
					}

					await selectMissionById(missionId);
					return;
				}
				case '/launch': {
					const currentMission = mission();
					if (!status().found || !currentMission) {
						appendLog('No mission is selected. Use /start or /select first.');
						return;
					}
					const task = currentTask();
					const runtimeId = args[0] || undefined;
					const session = await currentMission.launchAgentSession({
						...(runtimeId ? { runtimeId } : {}),
						...(task?.taskId ? { taskId: task.taskId } : {}),
						workingDirectory: status().missionDir ?? process.cwd(),
						prompt:
							task?.instruction ||
							`Continue the ${status().stage ?? 'prd'} stage for ${status().missionId ?? 'the active mission'}.`,
						...(task?.subject ? { title: task.subject } : {}),
						...(task?.relativePath ? { assignmentLabel: task.relativePath } : {})
					});
					setSelectedSessionId(session.sessionId);
					setSelectedConsoleTabId(createSessionTabId(session.sessionId));
					appendLog(`Launched ${session.runtimeId} for ${task?.subject ?? 'the selected task'}.`);
					return;
				}
				case '/sessions':
					if (sessions().length === 0) {
						appendLog('No agent sessions are currently attached to this mission.');
						return;
					}
					appendLogLines(
						sessions().map(
							(session) =>
								`${session.sessionId} | ${session.runtimeId} | ${session.lifecycleState}${session.assignmentLabel ? ` | ${session.assignmentLabel}` : ''}`
						)
					);
					return;
				case '/gate': {
					const currentMission = mission();
					if (!status().found || !currentMission) {
						appendLog('No mission is selected. Use /start or /select first.');
						return;
					}
					const intent = (args[0] as GateIntent | undefined) ?? gateIntentForStage(status().stage);
					const gate = await currentMission.evaluateGate(intent);
					appendLog(gate.allowed ? `Gate ${intent} passed.` : `Gate ${intent} blocked: ${gate.errors.join(' | ')}`);
					return;
				}
				case '/transition': {
					const currentMission = mission();
					const nextStage = (args[0] as MissionStageId | undefined) ?? selectedStageId();
					if (!status().found || !currentMission) {
						appendLog('No mission is selected. Use /start or /select first.');
						return;
					}
					if (!nextStage) {
						appendLog('Usage: /transition <prd|spec|plan|implementation|verification|audit>');
						return;
					}
					const next = await currentMission.transition(nextStage);
					setStatus(next);
					setSelector(buildSelectorFromStatus(next));
					appendLog(`Transitioned mission to ${next.stage ?? nextStage}.`);
					return;
				}
				case '/cancel': {
					const currentMission = mission();
					const sessionId = args[0] ?? selectedSessionId();
					if (!currentMission || !sessionId) {
						appendLog('Usage: /cancel <sessionId>');
						return;
					}
					await currentMission.cancelAgentSession(sessionId, 'Cancelled from Mission cockpit');
					appendLog(`Cancellation requested for ${sessionId}.`);
					return;
				}
				case '/terminate': {
					const currentMission = mission();
					const sessionId = args[0] ?? selectedSessionId();
					if (!currentMission || !sessionId) {
						appendLog('Usage: /terminate <sessionId>');
						return;
					}
					await currentMission.terminateAgentSession(sessionId, 'Terminated from Mission cockpit');
					appendLog(`Termination requested for ${sessionId}.`);
					return;
				}
				case '/deliver': {
					const currentMission = mission();
					if (!status().found || !currentMission) {
						appendLog('No mission is selected. Use /start or /select first.');
						return;
					}
					const next = await currentMission.deliver();
					setStatus(next);
					setSelector(buildSelectorFromStatus(next));
					appendLog(`Mission delivered at ${next.deliveredAt ?? 'unknown time'}.`);
					return;
				}
				default:
					appendLog(`Unknown command '${trimmed}'. Type /help.`);
					return;
			}
		} catch (error) {
			appendLog(toErrorMessage(error));
		} finally {
			setIsRunningCommand(false);
		}
	}

	return (
		<Show when={selectedThemeName()} keyed>
			<CockpitScreen
				title={screenTitle()}
				missionStatus={missionStatus()}
				stageLabel={cockpitMode() === 'selected' ? selectedStage()?.stage ?? status().stage ?? 'none' : 'n/a'}
				taskLabel={cockpitMode() === 'selected' ? selectedTask()?.subject ?? 'none' : 'n/a'}
				connectionLabel={connectionLabel()}
				connectionColor={connectionColor()}
				showProgressRails={status().found}
				stageItems={stageItems()}
				taskItems={taskItems()}
				focusArea={focusArea()}
				consoleTabs={renderedConsoleTabs()}
				selectedConsoleTabId={selectedConsoleTab()?.id}
				consoleContent={consoleContent()}
				onConsoleTabSelect={selectConsoleTab}
				{...(mainPanel() ? { mainPanel: mainPanel() } : {})}
				isRunningCommand={isRunningCommand()}
				inputValue={inputValue()}
				commandHelp={commandHelp()}
				onInputChange={(value) => {
					const nextValue = normalizeCommandInputValue(value);
					setInputValue(nextValue);
					updateCommandPicker(nextValue);
					if (parseCommandQuery(nextValue) === '/') {
						setFocusArea('command');
					}
				}}
				onInputSubmit={() => {
					const value = inputValue();
					if (parseCommandQuery(value) && commandPickerItems().length > 0) {
						const selectedCommandId = selectedCommandPickerItemId() ?? commandPickerItems()[0]?.id;
						if (selectedCommandId) {
							selectCommandById(selectedCommandId);
						}
						return;
					}
					if (value.trim() === '/') {
						updateCommandPicker(value);
						if (commandPickerItems().length > 0) {
							setFocusArea('command');
						} else {
							appendLog('No commands are available for the current selection.');
						}
						return;
					}
					setInputValue('');
					void executeCommand(value);
				}}
			/>
		</Show>
	);
}

function applyConsoleEvent(event: MissionAgentConsoleEvent): MissionAgentConsoleState {
	return event.state;
}

function asMissionStatusNotification(
	event: unknown
): { type: 'mission.status'; status: MissionStatus } | undefined {
	if (!event || typeof event !== 'object') {
		return undefined;
	}
	const candidate = event as { type?: unknown; status?: unknown };
	if (candidate.type !== 'mission.status') {
		return undefined;
	}
	if (!candidate.status || typeof candidate.status !== 'object') {
		return undefined;
	}
	return candidate as { type: 'mission.status'; status: MissionStatus };
}

function pickPreferredStageId(
	stages: MissionStageStatus[],
	current: MissionStageId | undefined,
	preferred: MissionStageId | undefined
): MissionStageId | undefined {
	if (stages.length === 0) {
		return undefined;
	}
	if (current && stages.some((stage) => stage.stage === current)) {
		return current;
	}
	if (preferred && stages.some((stage) => stage.stage === preferred)) {
		return preferred;
	}
	return stages[0]?.stage;
}

function pickPreferredTaskId(tasks: MissionTaskState[], current: string): string {
	if (tasks.length === 0) {
		return '';
	}
	if (current && tasks.some((task) => task.taskId === current)) {
		return current;
	}
	const preferred =
		tasks.find((task) => task.status === 'active') ??
		tasks.find((task) => task.status === 'todo' && task.blockedBy.length === 0) ??
		tasks[0];
	return preferred?.taskId ?? '';
}

function pickPreferredSessionId(
	sessions: MissionAgentSessionRecord[],
	current: string | undefined
): string | undefined {
	if (sessions.length === 0) {
		return undefined;
	}
	if (current && sessions.some((session) => session.sessionId === current)) {
		return current;
	}
	const preferred =
		sessions.find((session) => session.lifecycleState === 'awaiting-input') ??
		sessions.find((session) => session.lifecycleState === 'running' || session.lifecycleState === 'starting') ??
		sessions[0];
	return preferred?.sessionId;
}

function pickPreferredConsoleTabId(
	tabs: ConsoleTabDescriptor[],
	current: string | undefined,
	preferredSessionId: string | undefined
): string | undefined {
	if (tabs.length === 0) {
		return undefined;
	}
	if (current && tabs.some((tab) => tab.id === current)) {
		return current;
	}
	if (preferredSessionId) {
		const sessionTabId = createSessionTabId(preferredSessionId);
		if (tabs.some((tab) => tab.id === sessionTabId)) {
			return sessionTabId;
		}
	}
	return tabs[0]?.id;
}

function moveStageSelection(
	stages: MissionStageStatus[],
	current: MissionStageId | undefined,
	delta: number
): MissionStageId | undefined {
	if (stages.length === 0) {
		return undefined;
	}
	const currentIndex = Math.max(0, stages.findIndex((stage) => stage.stage === current));
	const nextIndex = clampIndex(currentIndex + delta, stages.length);
	return stages[nextIndex]?.stage;
}

function moveTaskSelection(tasks: MissionTaskState[], current: string, delta: number): string {
	if (tasks.length === 0) {
		return '';
	}
	const currentIndex = Math.max(0, tasks.findIndex((task) => task.taskId === current));
	const nextIndex = clampIndex(currentIndex + delta, tasks.length);
	return tasks[nextIndex]?.taskId ?? '';
}

function moveConsoleTabSelection(
	tabs: ConsoleTabDescriptor[],
	current: string | undefined,
	delta: number
): string | undefined {
	if (tabs.length === 0) {
		return undefined;
	}
	const currentId = current && tabs.some((tab) => tab.id === current) ? current : tabs[0]?.id;
	const currentIndex = Math.max(0, tabs.findIndex((tab) => tab.id === currentId));
	const nextIndex = clampIndex(currentIndex + delta, tabs.length);
	return tabs[nextIndex]?.id;
}

function clampIndex(index: number, length: number): number {
	return Math.max(0, Math.min(length - 1, index));
}

function mapStageState(state: string): ProgressRailItemState {
	if (state === 'done') {
		return 'done';
	}
	if (state === 'active') {
		return 'active';
	}
	if (state === 'blocked') {
		return 'blocked';
	}
	return 'pending';
}

function mapTaskState(state: MissionTaskState['status']): ProgressRailItemState {
	if (state === 'done') {
		return 'done';
	}
	if (state === 'active') {
		return 'active';
	}
	if (state === 'blocked') {
		return 'blocked';
	}
	return 'pending';
}

function formatStageLabel(stage: MissionStageId): string {
	if (stage === 'implementation') {
		return 'IMPLEMENT';
	}
	if (stage === 'verification') {
		return 'VERIFY';
	}
	return stage.toUpperCase();
}

function describeAgentEvent(event: { type: string; state: { sessionId: string } }): string {
	return `${event.type} · ${event.state.sessionId}`;
}

function daemonStateIcon(state: DaemonState): string {
	if (state === 'connected') {
		return '●';
	}
	if (state === 'booting') {
		return '◐';
	}
	return '○';
}

function daemonStateColor(state: DaemonState): string {
	if (state === 'connected') {
		return cockpitTheme.success;
	}
	if (state === 'booting') {
		return cockpitTheme.warning;
	}
	return cockpitTheme.danger;
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function createInitialStatusMessage(initialConnectionError?: string): string {
	if (initialConnectionError) {
		return `Cockpit could not connect immediately: ${initialConnectionError}`;
	}
	return 'Connecting to the Mission daemon.';
}

function formatMissionPickerDescription(
	candidate: NonNullable<MissionStatus['availableMissions']>[number]
): string {
	const issueLabel = candidate.issueId !== undefined ? `#${String(candidate.issueId)} | ` : '';
	return `${issueLabel}${candidate.missionId} | ${candidate.branchRef}`;
}

function isCommandQueryInput(value: string): boolean {
	return /^\/\S*$/u.test(value.trim());
}

function parseCommandQuery(value: string): string {
	const trimmed = value.trim();
	return isCommandQueryInput(trimmed) ? trimmed : '';
}

function normalizeCommandInputValue(value: string): string {
	if (value.startsWith('/')) {
		return value.replace(/^\/+/u, '/');
	}
	return value;
}

const daemonTabId = 'daemon';

function stageArtifactProductKey(stage: MissionStageId): MissionProductKey | undefined {
	if (stage === 'prd' || stage === 'spec' || stage === 'plan' || stage === 'verification' || stage === 'audit') {
		return stage;
	}
	return undefined;
}

function createArtifactTabId(product: MissionProductKey): string {
	return `artifact:${product}`;
}

function createTaskTabId(taskId: string): string {
	return `task:${taskId}`;
}

function createSessionTabId(sessionId: string): string {
	return `session:${sessionId}`;
}

function formatSessionTabLabel(session: MissionAgentSessionRecord): string {
	return `${session.runtimeId} ${session.sessionId.slice(-4)}`;
}

function isPrintableCommandFilterKey(sequence: string | undefined): boolean {
	return typeof sequence === 'string' && /^[ -~]$/u.test(sequence);
}

function buildCommandPickerItems(
	commands: MissionCommandDescriptor[],
	query: string
): CommandItem[] {
	const normalizedQuery = query.toLowerCase();
	const seenCommands = new Set<string>();
	return commands
		.filter((command) => command.enabled)
		.filter((command) => {
			if (seenCommands.has(command.command)) {
				return false;
			}
			seenCommands.add(command.command);
			return true;
		})
		.map((command) => ({
			id: command.command,
			command: command.command,
			label: command.command,
			description: command.label
		}))
		.filter((command) => {
			if (!normalizedQuery) {
				return true;
			}
			const commandText = command.command.toLowerCase();
			const labelText = command.label.toLowerCase();
			const descriptionText = command.description.toLowerCase();
			return (
				commandText.includes(normalizedQuery) ||
				labelText.includes(normalizedQuery) ||
				descriptionText.includes(normalizedQuery)
			);
		});
}

function buildThemePickerItems(selectedTheme: CockpitThemeName): SelectItem[] {
	return Object.keys(cockpitThemes).map((themeName) => {
		const isSelected = themeName === selectedTheme;
		return {
			id: themeName,
			label: themeName.toUpperCase(),
			description: isSelected ? 'Current session theme' : 'Apply for this cockpit session'
		};
	});
}

function buildFocusOrder(baseOrder: FocusArea[], pickerVisible: boolean): FocusArea[] {
	if (!pickerVisible) {
		return baseOrder;
	}
	return ['actions', ...baseOrder.filter((area) => area !== 'actions' && area !== 'command'), 'command'];
}

function pickSelectItemId(items: SelectItem[], current: string | undefined): string | undefined {
	if (items.length === 0) {
		return undefined;
	}
	if (current && items.some((item) => item.id === current)) {
		return current;
	}
	return items[0]?.id;
}

function movePickerSelection(items: SelectItem[], current: string | undefined, delta: number): string | undefined {
	if (items.length === 0) {
		return undefined;
	}
	const currentId = pickSelectItemId(items, current);
	const currentIndex = Math.max(0, items.findIndex((item) => item.id === currentId));
	const nextIndex = (currentIndex + delta + items.length) % items.length;
	return items[nextIndex]?.id;
}

function pickIssueNumberId(
	issues: TrackedIssueSummary[],
	current: string | undefined
): string | undefined {
	if (issues.length === 0) {
		return undefined;
	}
	if (current && issues.some((issue) => String(issue.number) === current)) {
		return current;
	}
	return String(issues[0]?.number ?? '');
}

function buildSelectorFromStatus(status: MissionStatus): MissionSelector {
	return {
		...(status.missionId ? { missionId: status.missionId } : {}),
		...(status.issueId !== undefined ? { issueId: status.issueId } : {}),
		...(status.branchRef ? { branchRef: status.branchRef } : {})
	};
}

function normalizeMissionType(value: string): MissionType | undefined {
	if (value === 'feat' || value === 'fix' || value === 'docs' || value === 'refactor' || value === 'task') {
		return value;
	}
	return undefined;
}

const themeCommandDescriptor: MissionCommandDescriptor = {
	id: 'builtin:theme',
	label: 'Select cockpit session theme',
	command: '/theme',
	scope: 'mission',
	enabled: true
};

function gateIntentForStage(stage: MissionStageId | undefined): GateIntent {
	if (stage === 'prd' || stage === 'spec' || stage === 'plan') {
		return 'implement';
	}
	if (stage === 'implementation') {
		return 'verify';
	}
	if (stage === 'verification') {
		return 'audit';
	}
	return 'deliver';
}

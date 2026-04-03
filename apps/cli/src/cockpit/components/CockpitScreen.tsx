/** @jsxImportSource @opentui/solid */

import { useTerminalDimensions } from '@opentui/solid';
import type { JSXElement } from 'solid-js';
import { CockpitHeader } from './CockpitHeader.js';
import { CommandDock } from './CommandDock.js';
import { ConsolePanel, type ConsolePanelContent, type ConsolePanelTab } from './ConsolePanel.js';
import type { FocusArea } from './types.js';
import { KeyHintsRow } from './KeyHintsRow.js';
import { ProgressRail, type ProgressRailItem } from './ProgressRail.js';
import { cockpitTheme } from './cockpitTheme.js';

const cockpitLayout = {
	headerHeight: 6,
	commandDockHeight: 4,
	commandHelpHeight: 1,
	keyHintsHeight: 1
} as const;

type CockpitScreenProps = {
	title: string;
	missionStatus: string;
	stageLabel: string;
	taskLabel: string;
	connectionLabel: string;
	connectionColor: string;
	showProgressRails: boolean;
	stageItems: ProgressRailItem[];
	taskItems: ProgressRailItem[];
	focusArea: FocusArea;
	consoleTabs: ConsolePanelTab[];
	selectedConsoleTabId: string | undefined;
	consoleContent: ConsolePanelContent;
	onConsoleTabSelect: (tabId: string) => void;
	mainPanel?: JSXElement;
	inputValue: string;
	isRunningCommand: boolean;
	commandHelp: string;
	onInputChange: (value: string) => void;
	onInputSubmit: () => void;
};

export function CockpitScreen(props: CockpitScreenProps) {
	const terminal = useTerminalDimensions();
	const stackGap = 0;
	const progressRailsHeight = props.showProgressRails
		? estimateProgressRailHeight(props.stageItems) + estimateProgressRailHeight(props.taskItems)
		: 0;
	const childCount = props.showProgressRails ? 7 : 5;
	const gapRows = (childCount - 1) * stackGap;
	const mainPanelHeight = Math.max(
		terminal().height - (2 + cockpitLayout.headerHeight + progressRailsHeight + cockpitLayout.commandDockHeight + cockpitLayout.commandHelpHeight + cockpitLayout.keyHintsHeight + gapRows),
		8
	);
	const consoleBodyRows = Math.max(mainPanelHeight - 5, 3);

	return (
		<box style={{ flexDirection: 'column', flexGrow: 1, padding: 1, gap: stackGap, backgroundColor: cockpitTheme.background }}>
			<CockpitHeader
				title={props.title}
				missionStatus={props.missionStatus}
				stageLabel={props.stageLabel}
				taskLabel={props.taskLabel}
				connectionLabel={props.connectionLabel}
				connectionColor={props.connectionColor}
				style={{ height: cockpitLayout.headerHeight, flexShrink: 0 }}
			/>

			{props.showProgressRails ? (
				<>
					<ProgressRail
						title="STAGES"
						items={props.stageItems}
						focused={props.focusArea === 'stages'}
						emptyLabel="No mission stage is available yet."
					/>

					<ProgressRail
						title="TASKS"
						items={props.taskItems}
						focused={props.focusArea === 'tasks'}
						emptyLabel="No tasks exist for the selected stage."
					/>
				</>
			) : null}

			{props.mainPanel ?? (
				<ConsolePanel
					focused={props.focusArea === 'sessions'}
					tabs={props.consoleTabs}
					selectedTabId={props.selectedConsoleTabId}
					content={props.consoleContent}
					bodyRows={consoleBodyRows}
					onTabSelect={props.onConsoleTabSelect}
				/>
			)}

			<CommandDock
				focusArea={props.focusArea}
				isRunningCommand={props.isRunningCommand}
				inputValue={props.inputValue}
				onInputChange={props.onInputChange}
				onInputSubmit={props.onInputSubmit}
				style={{ height: cockpitLayout.commandDockHeight, flexShrink: 0 }}
			/>

			<box style={{ paddingLeft: 1, height: cockpitLayout.commandHelpHeight, flexShrink: 0 }}>
				<text style={{ fg: cockpitTheme.mutedText }}>{props.commandHelp}</text>
			</box>

			<box style={{ height: cockpitLayout.keyHintsHeight, flexShrink: 0 }}>
				<KeyHintsRow />
			</box>
		</box>
	);
}

function estimateProgressRailHeight(items: ProgressRailItem[]): number {
	if (items.length === 0) {
		return 5;
	}
	const contentHeight = items.some((item) => Boolean(item.subtitle)) ? 3 : 2;
	return contentHeight + 4;
}
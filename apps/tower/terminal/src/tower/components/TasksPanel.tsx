/** @jsxImportSource @opentui/solid */

import { For, Show } from 'solid-js';
import { towerTheme } from './towerTheme.js';
import { Panel } from './Panel.js';

type TasksPanelProps = {
	lines: string[];
};

export function TasksPanel(props: TasksPanelProps) {
	return (
		<Panel title="TASKS" style={{ flexGrow: 1 }}>
			<Show when={props.lines.length > 0} fallback={<text style={{ fg: towerTheme.secondaryText }}>No active or ready tasks.</text>}>
				<For each={props.lines}>{(line) => <text style={{ fg: towerTheme.bodyText }}>{line}</text>}</For>
			</Show>
		</Panel>
	);
}
/** @jsxImportSource @opentui/solid */

import { For } from 'solid-js';
import { cockpitTheme } from './cockpitTheme.js';
import { Panel } from './Panel.js';

type FlightConsolePanelProps = {
	lines: string[];
};

export function FlightConsolePanel(props: FlightConsolePanelProps) {
	return (
		<Panel title="FLIGHT CONSOLE" style={{ flexGrow: 1 }} contentStyle={{ flexGrow: 1 }}>
			<scrollbox style={{ flexGrow: 1 }}>
				<box style={{ flexDirection: 'column' }}>
					<For each={props.lines}>{(line) => <text style={{ fg: cockpitTheme.bodyText }}>{line}</text>}</For>
				</box>
			</scrollbox>
		</Panel>
	);
}
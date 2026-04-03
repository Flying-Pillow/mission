/** @jsxImportSource @opentui/solid */

import { cockpitTheme } from './cockpitTheme.js';
import { Panel } from './Panel.js';
import type { FocusArea } from './types.js';

type PanelStyle = Record<string, string | number | undefined>;

type CommandDockProps = {
	focusArea: FocusArea;
	isRunningCommand: boolean;
	inputValue: string;
	onInputChange: (value: string) => void;
	onInputSubmit: () => void;
	style?: PanelStyle;
};

export function CommandDock(props: CommandDockProps) {
	return (
		<Panel
			title="COMMAND DOCK"
			borderColor={props.focusArea === 'command' ? cockpitTheme.accent : cockpitTheme.border}
			style={{ height: 4, ...(props.style ?? {}) }}
			footerBadges={[
				{ text: props.isRunningCommand ? 'running' : 'idle', tone: props.isRunningCommand ? 'warning' : 'neutral' },
				{ text: props.focusArea === 'command' ? 'focused' : 'background', tone: props.focusArea === 'command' ? 'accent' : 'neutral' }
			]}
		>
			<input
				focused={props.focusArea === 'command'}
				width="100%"
				placeholder={props.isRunningCommand ? 'Running command...' : 'Enter command or agent reply'}
				value={props.inputValue}
				onChange={props.onInputChange}
				onSubmit={props.onInputSubmit}
			/>
		</Panel>
	);
}
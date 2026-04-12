/** @jsxImportSource @opentui/solid */

import type { InputRenderable } from '@opentui/core';
import { For, Show } from 'solid-js';
import { towerTheme } from '../towerTheme.js';
import { Panel } from '../Panel.js';
import type { CommandItem, TowerKeyEvent, FocusArea } from '../types.js';

type PanelStyle = Record<string, string | number | undefined>;

type CommandPanelProps = {
	title: string;
	focusArea: FocusArea;
	isRunningCommand: boolean;
	commandPrefix?: string | undefined;
	inputValue: string;
	placeholder: string;
	confirmationPrompt?: string | undefined;
	showCommandPicker: boolean;
	commandPickerItems: CommandItem[];
	selectedCommandPickerItemId: string | undefined;
	onInputChange: (value: string) => void;
	onInputSubmit: (value?: string) => void;
	onInputKeyDown?: (event: TowerKeyEvent) => void;
	style?: PanelStyle;
};

export function CommandPanel(props: CommandPanelProps) {
	let inputRef: InputRenderable | undefined;
	const commandFocused = () => props.focusArea === 'command';

	const showIdleBadge = () => !props.isRunningCommand;

	return (
		<Panel
			title={props.title}
			borderColor={commandFocused() ? towerTheme.accent : towerTheme.border}
			style={{ ...(props.style ?? {}) }}
			{...(showIdleBadge() ? { footerBadges: [{ text: 'idle', tone: 'neutral' as const }] } : {})}
		>
			<box style={{ flexDirection: 'column', gap: 1 }}>
				<box style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
					<Show when={props.commandPrefix}>
						<text
							style={{
								fg: towerTheme.brightText,
								bg: towerTheme.accentSoft
							}}
						>
							{` ${props.commandPrefix} `}
						</text>
					</Show>
					<box style={{ flexGrow: 1 }}>
						<input
							ref={(value) => {
								inputRef = value;
							}}
							focused={commandFocused()}
							width="100%"
							placeholder={props.isRunningCommand ? 'Running...' : props.placeholder}
							value={props.inputValue}
							onChange={(value) => {
								props.onInputChange(inputRef?.value ?? value);
							}}
							onKeyDown={(event) => {
								props.onInputKeyDown?.(event);
							}}
							onSubmit={(value) => {
								props.onInputSubmit(inputRef?.value ?? (typeof value === 'string' ? value : props.inputValue));
							}}
						/>
					</box>
				</box>
				{props.confirmationPrompt ? (
					<text style={{ fg: towerTheme.mutedText }}>{props.confirmationPrompt}</text>
				) : null}
				<Show when={props.showCommandPicker && props.commandPickerItems.length > 0}>
					<box style={{ flexDirection: 'column', gap: 0 }}>
						<For each={props.commandPickerItems}>
							{(item) => (
								<text
									style={{
										fg: item.id === props.selectedCommandPickerItemId ? towerTheme.brightText : towerTheme.bodyText,
										bg: item.id === props.selectedCommandPickerItemId ? towerTheme.accentSoft : towerTheme.panelBackground
									}}
								>
									{item.command}
								</text>
							)}
						</For>
					</box>
				</Show>
				<Show when={props.showCommandPicker && props.commandPickerItems.length === 0}>
					<text style={{ fg: towerTheme.secondaryText }}>No commands are available for the current selection.</text>
				</Show>
			</box>
		</Panel>
	);
}
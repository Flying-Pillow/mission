/** @jsxImportSource @opentui/solid */

import { SyntaxStyle, type TextareaRenderable } from '@opentui/core';
import { Show, createEffect, createMemo, createSignal } from 'solid-js';
import { towerTheme } from '../towerTheme.js';
import { Panel, type PanelBadge } from '../Panel.js';

type EditorTab = 'write' | 'preview';

type FlowTextareaPanelProps = {
	title: string;
	stepLabel: string;
	helperText: string;
	initialValue: string;
	placeholder: string;
	focused: boolean;
	format: 'plain' | 'markdown';
	onValueChange: (value: string) => void;
	onSubmit: (value: string) => void;
	onCancel?: () => void;
};

const composerMarkdownSyntaxStyle = SyntaxStyle.fromTheme([
	{
		scope: ['default'],
		style: { foreground: towerTheme.bodyText }
	},
	{
		scope: ['markup.heading'],
		style: { foreground: towerTheme.brightText, bold: true }
	},
	{
		scope: ['markup.raw'],
		style: { foreground: towerTheme.metaText }
	},
	{
		scope: ['markup.link', 'markup.link.label'],
		style: { foreground: towerTheme.accent, underline: true }
	},
	{
		scope: ['markup.link.url'],
		style: { foreground: towerTheme.secondaryText, underline: true }
	},
	{
		scope: ['markup.strong'],
		style: { foreground: towerTheme.primaryText, bold: true }
	},
	{
		scope: ['markup.italic'],
		style: { foreground: towerTheme.primaryText, italic: true }
	},
	{
		scope: ['conceal'],
		style: { foreground: towerTheme.border }
	}
]);

export function FlowTextareaPanel(props: FlowTextareaPanelProps) {
	let textareaRef: TextareaRenderable | undefined;
	const [draft, setDraft] = createSignal(props.initialValue);
	const previewEnabled = createMemo(() => props.format === 'markdown');
	const [activeTab, setActiveTab] = createSignal<EditorTab>('write');
	const footerBadges = createMemo<PanelBadge[]>(() => [
		{ text: props.stepLabel },
		{
			text: activeTab() === 'preview' ? 'preview' : 'write',
			tone: activeTab() === 'preview' ? ('accent' as const) : ('neutral' as const)
		},
		...(previewEnabled() ? [{ text: 'Ctrl+P/Tab preview', framed: false as const }] : []),
		{ text: 'Enter submit', framed: false as const },
		{ text: 'Shift+Enter newline', framed: false as const },
		{
			text: props.focused ? 'focused' : 'background',
			tone: props.focused ? ('accent' as const) : ('neutral' as const)
		}
	]);

	createEffect(() => {
		setDraft(props.initialValue);
	});

	createEffect(() => {
		if (!previewEnabled()) {
			setActiveTab('write');
		}
	});

	function togglePreview(): void {
		if (!previewEnabled()) {
			return;
		}
		setActiveTab((current) => current === 'write' ? 'preview' : 'write');
	}

	return (
		<Panel
			title={props.title}
			borderColor={props.focused ? towerTheme.accent : towerTheme.border}
			style={{ flexGrow: 1 }}
			contentStyle={{ flexGrow: 1, gap: 1 }}
			footerBadges={footerBadges()}
		>
			<text style={{ fg: towerTheme.secondaryText }}>{props.helperText}</text>

			<Show when={previewEnabled()}>
				<box style={{ flexDirection: 'row', gap: 2 }}>
					<text style={{ fg: activeTab() === 'write' ? towerTheme.accent : towerTheme.labelText }}>
						{activeTab() === 'write' ? 'WRITE' : 'write'}
					</text>
					<text style={{ fg: towerTheme.border }}>|</text>
					<text style={{ fg: activeTab() === 'preview' ? towerTheme.accent : towerTheme.labelText }}>
						{activeTab() === 'preview' ? 'PREVIEW' : 'preview'}
					</text>
				</box>
			</Show>

			<box style={{ flexGrow: 1 }}>
				<Show
					when={previewEnabled() && activeTab() === 'preview'}
					fallback={
						<textarea
							ref={(value) => {
								textareaRef = value;
							}}
							onKeyDown={(event) => {
								if (previewEnabled() && (event.name === 'tab' || (event.ctrl && event.name === 'p'))) {
									event.preventDefault();
									event.stopPropagation();
									togglePreview();
									return;
								}
								if (event.name === 'escape') {
									event.preventDefault();
									event.stopPropagation();
									props.onCancel?.();
									return;
								}
								if ((event.name === 'return' || event.name === 'enter') && !event.shift) {
									event.preventDefault();
									event.stopPropagation();
									props.onSubmit(textareaRef?.plainText ?? draft());
								}
							}}
							focused={props.focused}
							width="100%"
							height="100%"
							placeholder={props.placeholder}
							initialValue={draft()}
							backgroundColor={towerTheme.panelBackground}
							textColor={towerTheme.bodyText}
							focusedBackgroundColor={towerTheme.panelBackground}
							focusedTextColor={towerTheme.primaryText}
							placeholderColor={towerTheme.mutedText}
							onContentChange={() => {
								const nextValue = textareaRef?.plainText ?? draft();
								setDraft(nextValue);
								props.onValueChange(nextValue);
							}}
							onSubmit={() => {
								props.onSubmit(textareaRef?.plainText ?? draft());
							}}
						/>
					}
				>
					<scrollbox
						focused={props.focused}
						style={{ flexGrow: 1 }}
						onKeyDown={(event) => {
							if (previewEnabled() && (event.name === 'tab' || (event.ctrl && event.name === 'p'))) {
								event.preventDefault();
								event.stopPropagation();
								togglePreview();
								return;
							}
							if (event.name === 'escape') {
								event.preventDefault();
								event.stopPropagation();
								props.onCancel?.();
							}
						}}
					>
						<Show
							when={draft().trim().length > 0}
							fallback={
								<box style={{ flexDirection: 'column' }}>
									<text style={{ fg: towerTheme.secondaryText }}>Nothing to preview yet.</text>
								</box>
							}
						>
							<markdown
								content={draft()}
								syntaxStyle={composerMarkdownSyntaxStyle}
								fg={towerTheme.bodyText}
								width="100%"
							/>
						</Show>
					</scrollbox>
				</Show>
			</box>
		</Panel>
	);
}
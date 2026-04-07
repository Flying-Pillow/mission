/** @jsxImportSource @opentui/solid */

import { createCliRenderer, SyntaxStyle, type TextareaRenderable } from '@opentui/core';
import { DaemonApi, type DaemonControlApi, readMissionDaemonSettings } from '@flying-pillow/mission-core';
import { render, useKeyboard, useRenderer } from '@opentui/solid';
import path from 'node:path';
import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { CommandContext } from '../commands/types.js';
import { Panel, type PanelBadge } from '../cockpit/components/Panel.js';
import {
	applyCockpitTheme,
	cockpitTheme,
	type CockpitThemeName,
	isCockpitThemeName
} from '../cockpit/components/cockpitTheme.js';
import { connectSurfaceDaemon, resolveSurfaceDaemonLaunchMode } from '../daemon/connectSurfaceDaemon.js';

type MissionArtifactOptions = {
	filePath: string;
	workspaceRoot: string;
	title: string;
	initialTheme: CockpitThemeName;
	controlApi: DaemonControlApi;
};

const artifactMarkdownSyntaxStyle = SyntaxStyle.fromTheme([
	{
		scope: ['default'],
		style: { foreground: cockpitTheme.bodyText }
	},
	{
		scope: ['markup.heading'],
		style: { foreground: cockpitTheme.brightText, bold: true }
	},
	{
		scope: ['markup.raw'],
		style: { foreground: cockpitTheme.metaText }
	},
	{
		scope: ['markup.link', 'markup.link.label'],
		style: { foreground: cockpitTheme.accent, underline: true }
	},
	{
		scope: ['markup.link.url'],
		style: { foreground: cockpitTheme.secondaryText, underline: true }
	},
	{
		scope: ['markup.strong'],
		style: { foreground: cockpitTheme.primaryText, bold: true }
	},
	{
		scope: ['markup.italic'],
		style: { foreground: cockpitTheme.primaryText, italic: true }
	},
	{
		scope: ['conceal'],
		style: { foreground: cockpitTheme.border }
	}
]);

export async function launchArtifact(context: CommandContext): Promise<void> {
	const filePathArgument = process.env['MISSION_ARTIFACT_PATH']?.trim() || context.args[0]?.trim();
	if (!filePathArgument) {
		throw new Error('Mission artifact mode requires a file path.');
	}

	if (!process.versions['bun']) {
		throw new Error(
			'Mission artifact mode currently requires Bun because @opentui/core imports bun:ffi at runtime. Install Bun and relaunch the artifact surface.'
		);
	}

	const absoluteFilePath = path.isAbsolute(filePathArgument)
		? filePathArgument
		: path.resolve(context.launchCwd, filePathArgument);
	const configuredTheme = readMissionDaemonSettings(context.controlRoot)?.cockpitTheme;
	const initialTheme: CockpitThemeName = isCockpitThemeName(configuredTheme)
		? configuredTheme
		: 'ocean';
	applyCockpitTheme(initialTheme);

	const title = process.env['MISSION_ARTIFACT_TITLE']?.trim()
		|| context.args[1]?.trim()
		|| path.basename(absoluteFilePath);

	const renderer = await createCliRenderer({
		exitOnCtrlC: false,
		targetFps: 30
	});
	const client = await connectSurfaceDaemon({
		surfacePath: context.launchCwd,
		launchMode: resolveSurfaceDaemonLaunchMode(import.meta.url)
	});
	const controlApi = new DaemonApi(client).control;

	let exitAfterDestroy = false;
	const teardownOnSignal = () => {
		exitAfterDestroy = true;
		renderer.destroy();
	};
	const signalNames: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGHUP'];
	for (const signalName of signalNames) {
		process.once(signalName, teardownOnSignal);
	}

	try {
		await render(
			() => (
				<MissionArtifactApp
					filePath={absoluteFilePath}
					workspaceRoot={context.controlRoot}
					title={title}
					initialTheme={initialTheme}
					controlApi={controlApi}
				/>
			),
			renderer
		);

		renderer.setBackgroundColor(cockpitTheme.background);
		await new Promise<void>((resolve) => {
			renderer.once('destroy', () => {
				for (const signalName of signalNames) {
					process.removeListener(signalName, teardownOnSignal);
				}
				client.dispose();
				if (exitAfterDestroy) {
					process.exit(0);
				}
				resolve();
			});
		});
	} catch (error) {
		client.dispose();
		throw error;
	}
}

function MissionArtifactApp(props: MissionArtifactOptions) {
	const renderer = useRenderer();
	let textareaRef: TextareaRenderable | undefined;
	const [draft, setDraft] = createSignal('');
	const [savedValue, setSavedValue] = createSignal('');
	const [statusMessage, setStatusMessage] = createSignal('loading');
	const [mode, setMode] = createSignal<'write' | 'preview'>('write');
	const [ready, setReady] = createSignal(false);
	const [saveError, setSaveError] = createSignal<string | undefined>();
	const [isSaving, setIsSaving] = createSignal(false);
	const [editorRevision, setEditorRevision] = createSignal(0);
	const isDirty = createMemo(() => draft() !== savedValue());
	const statusBadge = createMemo<PanelBadge>(() => {
		if (saveError()) {
			return { text: 'error', tone: 'danger' };
		}
		if (isSaving()) {
			return { text: 'saving', tone: 'warning' };
		}
		if (isDirty()) {
			return { text: 'dirty', tone: 'accent' };
		}
		return { text: statusMessage(), tone: 'success' };
	});
	const footerBadges = createMemo<PanelBadge[]>(() => [
		{ text: mode() === 'preview' ? 'preview' : 'write', tone: mode() === 'preview' ? 'accent' : 'neutral' },
		statusBadge(),
		{ text: 'Ctrl+S save', framed: false },
		{ text: 'Ctrl+P preview', framed: false },
		{ text: 'Ctrl+R reload', framed: false },
		{ text: 'Ctrl+Q quit', framed: false }
	]);

	createEffect(() => {
		applyCockpitTheme(props.initialTheme);
		renderer.setBackgroundColor(cockpitTheme.background);
	});

	onMount(() => {
		void loadArtifactFromDisk();
	});

	createEffect(() => {
		if (!ready()) {
			return;
		}
		const nextDraft = draft();
		if (nextDraft === savedValue()) {
			return;
		}
		const autosaveHandle = setTimeout(() => {
			void saveArtifact(nextDraft, 'Autosaved');
		}, 350);
		onCleanup(() => {
			clearTimeout(autosaveHandle);
		});
	});

	useKeyboard((key) => {
		if (key.ctrl && key.name === 's') {
			void saveArtifact();
			return;
		}
		if (key.ctrl && key.name === 'p') {
			setMode((current) => (current === 'write' ? 'preview' : 'write'));
			return;
		}
		if (key.ctrl && key.name === 'r') {
			void loadArtifactFromDisk();
			return;
		}
		if (key.ctrl && key.name === 'q') {
			if (isDirty()) {
				void saveArtifact(draft(), 'Saved on exit').finally(() => {
					renderer.destroy();
				});
				return;
			}
			renderer.destroy();
		}
	});

	async function loadArtifactFromDisk(): Promise<void> {
		try {
			const fileContents = await props.controlApi.readDocument(props.filePath).then((document) => document.content);
			setDraft(fileContents);
			setSavedValue(fileContents);
			setEditorRevision((current) => current + 1);
			setStatusMessage('loaded');
			setSaveError(undefined);
			setReady(true);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setSaveError(message);
			setStatusMessage('load failed');
			setReady(true);
		}
	}

	async function saveArtifact(nextValue: string = draft(), savedLabel = 'Saved'): Promise<void> {
		setIsSaving(true);
		try {
			await props.controlApi.writeDocument(props.filePath, nextValue);
			setSavedValue(nextValue);
			setSaveError(undefined);
			setStatusMessage(`${savedLabel.toLowerCase()} ${formatTimestamp(new Date())}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setSaveError(message);
			setStatusMessage('save failed');
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<box
			style={{
				flexDirection: 'column',
				flexGrow: 1,
				flexShrink: 1,
				minHeight: 0,
				padding: 1,
				gap: 1,
				backgroundColor: cockpitTheme.background
			}}
		>
			<Panel
				title={props.title}
				titleColor={cockpitTheme.title}
				borderColor={mode() === 'write' ? cockpitTheme.accent : cockpitTheme.border}
				style={{ flexGrow: 1, minHeight: 0 }}
				contentStyle={{ flexGrow: 1, minHeight: 0, gap: 1 }}
				footerBadges={footerBadges()}
			>
				<Show when={ready()} fallback={<text style={{ fg: cockpitTheme.secondaryText }}>Loading artifact...</text>}>
					<Show
						when={mode() === 'preview'}
						fallback={
							<Show when={editorRevision()} keyed>
								<textarea
									ref={(value) => {
										textareaRef = value;
									}}
									focused={true}
									width="100%"
									height="100%"
									placeholder=""
									initialValue={draft()}
									backgroundColor={cockpitTheme.panelBackground}
									textColor={cockpitTheme.bodyText}
									focusedBackgroundColor={cockpitTheme.panelBackground}
									focusedTextColor={cockpitTheme.primaryText}
									placeholderColor={cockpitTheme.mutedText}
									onContentChange={() => {
										setDraft(textareaRef?.plainText ?? draft());
									}}
								/>
							</Show>
						}
					>
						<scrollbox
							focused={true}
							style={{
								flexGrow: 1,
								flexShrink: 1,
								minHeight: 0,
								scrollbarOptions: {
									trackOptions: {
										foregroundColor: cockpitTheme.accent,
										backgroundColor: cockpitTheme.panelBackground
									}
								}
							}}
						>
							<Show
								when={draft().trim().length > 0}
								fallback={<text style={{ fg: cockpitTheme.secondaryText }}>Nothing to preview yet.</text>}
							>
								<markdown
									content={draft()}
									syntaxStyle={artifactMarkdownSyntaxStyle}
									fg={cockpitTheme.bodyText}
									width="100%"
								/>
							</Show>
						</scrollbox>
					</Show>
				</Show>
			</Panel>
			<Show when={saveError()}>
				<box style={{ flexDirection: 'column', gap: 0 }}>
					<text style={{ fg: cockpitTheme.danger }}>{saveError()}</text>
				</box>
			</Show>
		</box>
	);
}

function formatTimestamp(date: Date): string {
	return date.toISOString().slice(11, 19);
}
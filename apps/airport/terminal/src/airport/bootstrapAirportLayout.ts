import { execFile, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { readMissionUserConfig } from '@flying-pillow/mission-core';
import type { EntryContext } from '../entry/entryContext.js';

const execFileAsync = promisify(execFile);

export async function bootstrapAirportLayout(context: EntryContext): Promise<void> {
	const sessionName = resolveTerminalManagerSessionName(context.controlRoot);
	const terminalManagerBinary = resolveTerminalManagerBinary();
	const runtimeRoot = resolveRuntimeRoot();
	const sessionSlug = slugifySessionName(sessionName);
	const runtimeConfigRoot = path.join(runtimeRoot, 'mission', `runtime-${sessionSlug}`);
	const terminalManagerConfigDir = path.join(runtimeConfigRoot, 'terminal-manager');
	const layoutFile = path.join(runtimeRoot, 'mission', `airport-layout-${sessionSlug}.kdl`);
	const rightWidth = process.env['MISSION_TERMINAL_RIGHT_COLUMN_WIDTH']?.trim()
		|| process.env['MISSION_TERMINAL_OPERATOR_PANE_SIZE']?.trim()
		|| '50%';
	const repoRoot = context.controlRoot;
	const missionEntry = path.join(repoRoot, 'mission');
	const towerCommand = buildShellCommand([
		'env',
		'MISSION_TERMINAL_ACTIVE=1',
		'MISSION_GATE_ID=dashboard',
		`MISSION_TERMINAL_SESSION=${sessionName}`,
		missionEntry,
		...context.args
	]);
	const editorCommand = buildShellCommand([
		'env',
		'MISSION_GATE_ID=editor',
		`MISSION_TERMINAL_SESSION=${sessionName}`,
		missionEntry,
		'__airport-layout-briefing-room-pane'
	]);

	await mkdir(terminalManagerConfigDir, { recursive: true });
	await mkdir(path.dirname(layoutFile), { recursive: true });
	await writeFile(path.join(terminalManagerConfigDir, 'config.kdl'), buildTerminalManagerConfig(), 'utf8');
	await writeFile(layoutFile, buildAirportLayout({
		repoRoot,
		towerCommand,
		editorCommand,
		rightWidth
	}), 'utf8');

	await resetTerminalManagerSession(terminalManagerBinary, sessionName);

	const child = spawn(
		terminalManagerBinary,
		['--config-dir', terminalManagerConfigDir, '--session', sessionName, '--new-session-with-layout', layoutFile],
		{
			stdio: 'inherit',
			env: process.env
		}
	);

	await new Promise<void>((resolve, reject) => {
		child.once('error', reject);
		child.once('exit', (code, signal) => {
			if (signal) {
				reject(new Error(`terminal manager exited from signal ${signal}.`));
				return;
			}
			if ((code ?? 0) !== 0) {
				reject(new Error(`terminal manager exited with code ${String(code ?? 1)}.`));
				return;
			}
			resolve();
		});
	});
}

function resolveTerminalManagerSessionName(controlRoot: string): string {
	return process.env['MISSION_TERMINAL_SESSION']?.trim()
		|| process.env['MISSION_TERMINAL_SESSION_NAME']?.trim()
		|| `mission-${path.basename(controlRoot)}`;
}

function slugifySessionName(sessionName: string): string {
	return sessionName.replace(/[^A-Za-z0-9._-]+/gu, '_');
}

function resolveRuntimeRoot(): string {
	return process.env['XDG_RUNTIME_DIR']?.trim() || process.env['TMPDIR']?.trim() || os.tmpdir();
}

async function resetTerminalManagerSession(terminalManagerBinary: string, sessionName: string): Promise<void> {
	const normalizedSessionName = sessionName.trim();
	if (!normalizedSessionName) {
		throw new Error('Terminal-manager session name is required.');
	}

	const existingSession = (await listTerminalManagerSessions(terminalManagerBinary))
		.find((session) => session.name === normalizedSessionName);
	if (!existingSession) {
		return;
	}

	await execTerminalManager(terminalManagerBinary, ['delete-session', '--force', normalizedSessionName]);

	const lingeringSession = await waitForSessionToDisappear(terminalManagerBinary, normalizedSessionName);
	if (lingeringSession) {
		throw new Error(
			`Unable to reset terminal-manager session '${normalizedSessionName}' before launch (${lingeringSession.state}).`
		);
	}
}

async function waitForSessionToDisappear(
	terminalManagerBinary: string,
	sessionName: string
): Promise<TerminalManagerSessionSummary | undefined> {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const lingeringSession = (await listTerminalManagerSessions(terminalManagerBinary))
			.find((session) => session.name === sessionName);
		if (!lingeringSession) {
			return undefined;
		}
		await delay(100);
	}

	return (await listTerminalManagerSessions(terminalManagerBinary))
		.find((session) => session.name === sessionName);
}

function buildShellCommand(args: string[]): string {
	return args.map(shellEscape).join(' ');
}

function shellEscape(value: string): string {
	return `'${value.replace(/'/gu, `'\\''`)}'`;
}

function buildTerminalManagerConfig(): string {
	return `themes {
    tower {
        bg "#0F1419"
        fg "#555555"
        green "#1E40AF"
        black "#000000"
        red "#FF3333"
        yellow "#E5C07B"
        blue "#61AFEF"
        magenta "#C678DD"
        cyan "#56B6C2"
        white "#FFFFFF"
        orange "#D19A66"
    }
}

theme "tower"
show_startup_tips false

ui {
    pane_frames {
        rounded_corners true
    }
}
`;
}

function buildAirportLayout(input: {
	repoRoot: string;
	towerCommand: string;
	editorCommand: string;
	rightWidth: string;
}): string {
	return `layout {
	default_tab_template {
		children
	}
	tab name="TOWER" {
		pane split_direction="vertical" {
			pane name="MISSION" focus=true command="sh" cwd="${kdlEscape(input.repoRoot)}" {
				args "-lc" "${kdlEscape(`exec ${input.towerCommand}`)}"
			}
			pane size="${kdlEscape(input.rightWidth)}" name="EDITOR" command="sh" cwd="${kdlEscape(input.repoRoot)}" {
				args "-lc" "${kdlEscape(`exec ${input.editorCommand}`)}"
			}
		}
	}
}
`;
}

function kdlEscape(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"');
}

function resolveTerminalManagerBinary(): string {
	return process.env['MISSION_TERMINAL_BINARY']?.trim()
		|| readMissionUserConfig()?.terminalBinary?.trim()
		|| 'zellij';
}

type TerminalManagerSessionState = 'live' | 'exited';

type TerminalManagerSessionSummary = {
	name: string;
	state: TerminalManagerSessionState;
};

async function listTerminalManagerSessions(terminalManagerBinary: string): Promise<TerminalManagerSessionSummary[]> {
	const result = await execTerminalManager(terminalManagerBinary, ['list-sessions']);
	return result.stdout
		.split(/\r?\n/gu)
		.map((line) => stripAnsi(line).trim())
		.filter((line) => line.length > 0)
		.map(parseTerminalManagerSessionSummary)
		.filter((session): session is TerminalManagerSessionSummary => session !== undefined);
}

function parseTerminalManagerSessionSummary(line: string): TerminalManagerSessionSummary | undefined {
	const name = line.match(/^(\S+)/u)?.[1];
	if (!name) {
		return undefined;
	}
	return {
		name,
		state: line.includes('(EXITED') ? 'exited' : 'live'
	};
}

async function execTerminalManager(terminalManagerBinary: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
	const result = await execFileAsync(terminalManagerBinary, args, {
		encoding: 'utf8',
		env: { ...process.env, ZELLIJ: undefined }
	});
	return {
		stdout: result.stdout,
		stderr: result.stderr
	};
}

async function delay(ms: number): Promise<void> {
	await new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

function stripAnsi(value: string): string {
	let output = '';
	for (let index = 0; index < value.length; index += 1) {
		if (value.charCodeAt(index) !== 27) {
			output += value[index] ?? '';
			continue;
		}
		if (value[index + 1] !== '[') {
			continue;
		}
		index += 2;
		while (index < value.length && /[0-9;]/u.test(value[index] ?? '')) {
			index += 1;
		}
		if (index < value.length && value[index] !== 'm') {
			index -= 1;
		}
	}
	return output;
}
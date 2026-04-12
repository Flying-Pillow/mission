import { intro } from '@clack/prompts';
import { getWorkspaceRoot } from '@flying-pillow/mission-core';
import { bootstrapAirportLayout } from '../airport/bootstrapAirportLayout.js';
import { bootstrapBriefingRoomPane } from '../briefing-room/bootstrapBriefingRoomPane.js';
import { bootstrapRunwayPane } from '../runway/bootstrapRunwayPane.js';
import { bootstrapTowerPane } from '../tower/bootstrapTowerPane.js';
import { ensureMissionInstallation } from './ensureMissionInstallation.js';
import type { EntryContext, MissionEntryHandler } from './entryContext.js';
import { runAirportStatusCommand } from './runAirportStatusCommand.js';
import { runDaemonStopCommand } from './runDaemonStopCommand.js';
import { runInstallCommand } from './runInstallCommand.js';

export async function routeMissionEntry(argv: string[] = process.argv.slice(2)): Promise<void> {
	const [firstArg, ...restArgs] = argv;
	const command = !firstArg || firstArg.startsWith('--') ? '__tower__' : firstArg;
	const args = !firstArg ? [] : firstArg.startsWith('--') ? argv : restArgs;
	const json = argv.includes('--json');
	if (firstArg === 'help' || firstArg === '--help' || firstArg === '-h') {
		printHelp();
		return;
	}

	if (!json && command !== '__tower__' && !command.startsWith('__')) {
		intro('Mission');
	}

	const context: EntryContext = {
		controlRoot: process.env['MISSION_CONTROL_ROOT']?.trim() || getWorkspaceRoot(),
		launchCwd: process.env['MISSION_LAUNCH_CWD']?.trim() || process.cwd(),
		args,
		json
	};

	const handlers: Record<string, MissionEntryHandler> = {
		__tower__: bootstrapTowerPane,
		'__airport-layout-launch__': bootstrapAirportLayout,
		'__airport-layout-briefing-room-pane': bootstrapBriefingRoomPane,
		'__airport-layout-runway-pane': bootstrapRunwayPane,
		install: runInstallCommand,
		'airport:status': runAirportStatusCommand,
		'daemon:stop': runDaemonStopCommand
	};

	const handler = handlers[command];
	if (!handler) {
		throw new Error(`Unknown command '${command}'. Run 'mission help' for the supported surface.`);
	}

	if (command === '__tower__' || command === 'install') {
		await ensureMissionInstallation({
			interactive: !json && process.stdout.isTTY,
			verbose: false
		});
	}

	await handler(context);
}

export function printHelp(): void {
	process.stdout.write(
		`Mission\n\nCommands:\n  mission [--hmr] [--banner] [--no-banner]\n  mission install [--json]\n  mission airport:status [--json]\n  mission daemon:stop [--json]\n\nRelated commands:\n  missiond [--socket <path>]\n\nNotes:\n  Bare 'mission' launches the Mission terminal surface.\n  On POSIX shells, Mission bootstraps the airport layout through the terminal manager when available.\n  The airport layout places Tower on the left and execution details on the right.\n  The right side always hosts the briefing-room surface; the runway surface is inserted only while an agent session is selected.\n  Mission resets the repository-scoped terminal-manager session at startup so each airport-layout launch begins from the initial layout state for that repository.\n  Launching from a mission worktree auto-selects that mission.\n  Launching from the repository checkout opens repository mode.\n  The OpenTUI Airport terminal surfaces currently require Bun at runtime.\n  Use '--hmr' to run the terminal surfaces with automatic restart on Mission surface changes; package source changes use built exports in HMR mode.\n  Mission will auto-start the daemon with 'missiond' if it is not already running.\n  Starting Mission scaffolds user config automatically and prompts only when setup cannot be inferred safely.\n  Starting Mission will scaffold control-repo state automatically if it is missing.\n  Install '@flying-pillow/mission' globally if you want persistent 'mission' and 'missiond' commands.\n`
	);
}
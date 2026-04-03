import {
	connectDaemonClient,
	Mission,
	type MissionSelector,
	resolveDaemonLaunchModeFromModule
} from '@flying-pillow/mission-core';
import { resolveMissionSelector } from '../commands/daemonClient.js';
import type { CommandContext } from '../commands/types.js';
import { applyCockpitTheme, type CockpitThemeName } from './components/cockpitTheme.js';
import { playMissionStartupBanner } from './components/MissionStartupBanner.js';

export async function launchCockpit(context: CommandContext): Promise<void> {
	if (
		context.args.includes('--help') ||
		context.args.includes('-h') ||
		context.args.includes('help')
	) {
		process.stdout.write('mission [--issue <id>] [--branch <ref>]\n');
		return;
	}

	const flags = new Map<string, string | true>();
	for (let index = 0; index < context.args.length; index += 1) {
		const token = context.args[index];
		if (!token?.startsWith('--')) {
			continue;
		}

		const flag = token.slice(2);
		const [key, inlineValue] = flag.split('=', 2);
		if (!key) {
			continue;
		}

		if (inlineValue !== undefined) {
			flags.set(key, inlineValue);
			continue;
		}

		const nextToken = context.args[index + 1];
		if (nextToken && !nextToken.startsWith('--')) {
			flags.set(key, nextToken);
			index += 1;
			continue;
		}

		flags.set(key, true);
	}

	const { selector } = resolveMissionSelector(flags);
	const initialTheme: CockpitThemeName = 'ocean';
	applyCockpitTheme(initialTheme);
	const connect = async (nextSelector: MissionSelector = selector) => {
		const client = await connectDaemonClient({
			repoRoot: context.repoRoot,
			preferredLaunchMode: resolveDaemonLaunchModeFromModule(import.meta.url)
		});
		const mission = new Mission(client);
		const status = await mission.withSelector(nextSelector).status();
		return {
			mission,
			status,
			dispose: () => {
				client.dispose();
			}
		};
	};

	let initialConnection: Awaited<ReturnType<typeof connect>> | undefined;
	let initialConnectionError: string | undefined;
	try {
		initialConnection = await connect(selector);
	} catch (error) {
		initialConnectionError = error instanceof Error ? error.message : String(error);
	}

	if (!process.versions['bun']) {
		throw new Error(
			'Mission cockpit currently requires Bun because @opentui/core imports bun:ffi at runtime. Install Bun and relaunch the cockpit, or use non-cockpit Mission commands from Node.'
		);
	}

	await playMissionStartupBanner();

	const { runCockpitApp } = await import('./runCockpitApp.js');

	try {
		await runCockpitApp({
			initialSelector: selector,
			initialTheme,
			...(initialConnection ? { initialConnection } : {}),
			...(initialConnectionError ? { initialConnectionError } : {}),
			connect
		});
	} finally {
		initialConnection?.dispose();
	}
}
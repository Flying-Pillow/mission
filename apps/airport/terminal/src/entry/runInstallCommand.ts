import { getMissionUserConfigPath } from '@flying-pillow/mission-core';
import { ensureMissionInstallation, getMissionInstallationOutput } from './ensureMissionInstallation.js';
import type { EntryContext } from './entryContext.js';

export async function runInstallCommand(context: EntryContext): Promise<void> {
	const config = await ensureMissionInstallation({
		interactive: !context.json && process.stdout.isTTY,
		verbose: !context.json
	});
	if (context.json) {
		process.stdout.write(`${JSON.stringify(getMissionInstallationOutput(config), null, 2)}\n`);
	}
}

export { ensureMissionInstallation, getMissionUserConfigPath };
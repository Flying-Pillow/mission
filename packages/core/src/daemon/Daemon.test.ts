import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getMissionSettingsPath } from '../lib/repoConfig.js';
import { startDaemon } from './Daemon.js';

describe('Daemon', () => {
	it('scaffolds the control repository when the daemon starts', async () => {
		const repoRoot = await createTempRepo();

		try {
			const daemon = await startDaemon({ repoRoot, socketPath: path.join(repoRoot, '.mission-daemon-test.sock') });
			try {
				const settingsContent = await fs.readFile(getMissionSettingsPath(repoRoot), 'utf8');
				expect(JSON.parse(settingsContent)).toMatchObject({
					trackingProvider: 'github'
				});
			} finally {
				await daemon.close();
			}
		} finally {
			await fs.rm(repoRoot, { recursive: true, force: true });
		}
	});
});

async function createTempRepo(): Promise<string> {
	const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-daemon-'));
	runGit(repoRoot, ['init']);
	runGit(repoRoot, ['config', 'user.email', 'mission@example.com']);
	runGit(repoRoot, ['config', 'user.name', 'Mission Test']);
	await fs.writeFile(path.join(repoRoot, 'README.md'), '# Mission Test\n', 'utf8');
	runGit(repoRoot, ['add', 'README.md']);
	runGit(repoRoot, ['commit', '-m', 'init']);
	return repoRoot;
}

function runGit(repoRoot: string, args: string[]): void {
	const result = spawnSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf8'
	});
	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed.`);
	}
}
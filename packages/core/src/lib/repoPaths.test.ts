import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getRepoRoot, resolveGitControlRepoRoot } from './repoPaths.js';

describe('repoPaths', () => {
	it('resolves the control repository root from within a git worktree', async () => {
		const repoRoot = await createTempRepo();
		const worktreePath = path.join(repoRoot, '.mission-worktree-test');

		try {
			runGit(repoRoot, ['worktree', 'add', worktreePath, '-b', 'mission/test-worktree']);

			expect(resolveGitControlRepoRoot(worktreePath)).toBe(repoRoot);
			expect(getRepoRoot(worktreePath)).toBe(repoRoot);
		} finally {
			runGit(repoRoot, ['worktree', 'remove', '--force', worktreePath]);
			await fs.rm(repoRoot, { recursive: true, force: true });
		}
	});
});

async function createTempRepo(): Promise<string> {
	const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-repopaths-'));
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
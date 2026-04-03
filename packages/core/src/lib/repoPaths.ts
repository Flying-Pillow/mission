/**
 * @file packages/core/src/lib/repoPaths.ts
 * @description Resolves repository-root paths for the Mission package runtime.
 */

import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export function getRepoRoot(startPath = process.cwd()): string {
	return resolveGitControlRepoRoot(startPath) ?? path.resolve(currentDirectory, '../..');
}

export function resolveGitControlRepoRoot(startPath = process.cwd()): string | undefined {
	const commonDirectory = runGit(startPath, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
	if (commonDirectory) {
		return path.basename(commonDirectory) === '.git'
			? path.dirname(commonDirectory)
			: commonDirectory;
	}

	return runGit(startPath, ['rev-parse', '--path-format=absolute', '--show-toplevel']);
}

function runGit(startPath: string, args: string[]): string | undefined {
	try {
		const output = execFileSync('git', args, {
			cwd: startPath,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}).trim();
		return output.length > 0 ? output : undefined;
	} catch {
		return undefined;
	}
}
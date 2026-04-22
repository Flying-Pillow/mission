import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userArgs = process.argv.slice(2);

function runChecked(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: workspaceRoot,
		stdio: 'inherit',
		env: process.env,
		...options
	});

	if (result.error) {
		throw result.error;
	}

	if ((result.status ?? 0) !== 0) {
		process.exit(result.status ?? 1);
	}
}

function spawnManaged(command, args, extraEnv = {}) {
	const child = spawn(command, args, {
		cwd: workspaceRoot,
		stdio: 'inherit',
		env: {
			...process.env,
			...extraEnv
		}
	});

	child.on('error', (error) => {
		throw error;
	});

	return child;
}

let shuttingDown = false;
const children = new Set();

function shutdown(exitCode = 0, signal) {
	if (shuttingDown) {
		return;
	}

	shuttingDown = true;
	for (const child of children) {
		if (!child.killed) {
			child.kill(signal ?? 'SIGTERM');
		}
	}

	if (signal) {
		process.kill(process.pid, signal);
		return;
	}

	process.exit(exitCode);
}

runChecked('pnpm', ['run', 'mission:install:local:dev']);
runChecked('pnpm', [
	'--dir',
	'./packages/mission',
	'exec',
	'node',
	'--conditions=development',
	'--import',
	'tsx',
	'./src/mission.ts',
	'daemon:stop',
	'--json'
]);

const supervisedEnv = {
	MISSION_DAEMON_SUPERVISED: '1'
};

const daemon = spawnManaged('pnpm', ['--dir', './packages/core', 'run', 'daemon:dev'], supervisedEnv);
const web = spawnManaged(
	'pnpm',
	['--dir', './apps/airport/web', 'run', 'dev', '--', ...userArgs],
	supervisedEnv
);

children.add(daemon);
children.add(web);

for (const child of children) {
	child.on('exit', (code, signal) => {
		children.delete(child);
		if (shuttingDown) {
			return;
		}

		shutdown(code ?? 0, signal ?? undefined);
	});
}

process.once('SIGINT', () => shutdown(0, 'SIGINT'));
process.once('SIGTERM', () => shutdown(0, 'SIGTERM'));
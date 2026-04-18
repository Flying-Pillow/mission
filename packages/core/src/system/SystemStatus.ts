// /packages/core/src/system/SystemStatus.ts: Resolves GitHub CLI authentication state and GitHub account identity for Mission surfaces.
import { spawnSync } from 'node:child_process';
import { getMissionGitHubCliBinary } from '../lib/userConfig.js';
import type { SystemStatus } from '../types.js';

let cachedSystemStatus: { checkedAt: number; cacheKey: string; status: SystemStatus } | undefined;

export function readSystemStatus(options: { cwd?: string; authToken?: string } = {}): SystemStatus {
	const now = Date.now();
	const authToken = options.authToken?.trim();
	const cwd = options.cwd?.trim() || process.cwd();
	const ghBinary = getMissionGitHubCliBinary() ?? 'gh';
	const cacheKey = `${cwd}\u0000${ghBinary}\u0000${process.env['PATH'] ?? ''}`;
	if (
		!authToken
		&& cachedSystemStatus
		&& cachedSystemStatus.cacheKey === cacheKey
		&& now - cachedSystemStatus.checkedAt < 10_000
	) {
		return structuredClone(cachedSystemStatus.status);
	}

	if (authToken) {
		return readTokenBackedSystemStatus({ cwd, ghBinary, authToken });
	}

	const authResult = spawnSync(ghBinary, ['auth', 'status'], {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	});
	const detail = resolveGitHubCliDetail(authResult.stdout ?? '', authResult.stderr ?? '');
	const authenticated = authResult.status === 0;
	const identity = authenticated
		? readGitHubIdentity({ cwd, ghBinary })
		: undefined;
	const user = identity?.user;
	const email = identity?.email;
	const avatarUrl = identity?.avatarUrl;

	const status: SystemStatus = {
		github: {
			cliAvailable: !(authResult.error && 'code' in authResult.error && authResult.error.code === 'ENOENT'),
			authenticated,
			...(user ? { user } : {}),
			...(email ? { email } : {}),
			...(avatarUrl ? { avatarUrl } : {}),
			...(detail
				? { detail }
				: authResult.error && 'code' in authResult.error && authResult.error.code === 'ENOENT'
					? { detail: `GitHub CLI is not installed at '${ghBinary}'.` }
					: authenticated
						? { detail: 'GitHub CLI authenticated.' }
						: { detail: 'GitHub CLI authentication is required.' })
		}
	};

	cachedSystemStatus = {
		checkedAt: now,
		cacheKey,
		status
	};
	return structuredClone(status);
}

function readTokenBackedSystemStatus(input: {
	cwd: string;
	ghBinary: string;
	authToken: string;
}): SystemStatus {
	const authEnv = buildGitHubAuthEnv(input.authToken);
	const authResult = spawnSync(input.ghBinary, ['api', 'user'], {
		cwd: input.cwd,
		encoding: 'utf8',
		env: authEnv,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	const detail = authResult.status === 0
		? undefined
		: resolveGitHubCliDetail(authResult.stdout ?? '', authResult.stderr ?? '');
	const cliAvailable = !(authResult.error && 'code' in authResult.error && authResult.error.code === 'ENOENT');
	const identity = authResult.status === 0
		? readGitHubIdentity({
			cwd: input.cwd,
			ghBinary: input.ghBinary,
			env: authEnv,
			userOutput: authResult.stdout ?? ''
		})
		: undefined;
	const user = authResult.status === 0 ? identity?.user : undefined;
	const email = identity?.email;
	const avatarUrl = identity?.avatarUrl;

	return {
		github: {
			cliAvailable,
			authenticated: authResult.status === 0,
			...(user ? { user } : {}),
			...(email ? { email } : {}),
			...(avatarUrl ? { avatarUrl } : {}),
			...(detail
				? { detail }
				: !cliAvailable
					? { detail: `GitHub CLI is not installed at '${input.ghBinary}'.` }
					: authResult.status === 0
						? { detail: `GitHub token authenticated${user ? ` as ${user}` : ''}.` }
						: { detail: 'GitHub token is invalid or missing required scopes.' })
		}
	};
}

function readGitHubIdentity(input: {
	cwd: string;
	ghBinary: string;
	env?: NodeJS.ProcessEnv;
	userOutput?: string;
}): { user?: string; email?: string; avatarUrl?: string } {
	const userOutput = input.userOutput ?? spawnSync(input.ghBinary, ['api', 'user'], {
		cwd: input.cwd,
		encoding: 'utf8',
		env: input.env,
		stdio: ['ignore', 'pipe', 'ignore']
	}).stdout ?? '';
	const parsedUser = parseGitHubUserResponse(userOutput);
	const user = parsedUser?.login;
	const directEmail = normalizeOptionalString(parsedUser?.email);
	const avatarUrl = normalizeOptionalString(parsedUser?.avatar_url);
	if (directEmail) {
		return {
			...(user ? { user } : {}),
			email: directEmail,
			...(avatarUrl ? { avatarUrl } : {})
		};
	}

	const emailResult = spawnSync(input.ghBinary, ['api', 'user/emails'], {
		cwd: input.cwd,
		encoding: 'utf8',
		env: input.env,
		stdio: ['ignore', 'pipe', 'ignore']
	});
	const email = resolvePrimaryGitHubEmail(emailResult.stdout ?? '');
	return {
		...(user ? { user } : {}),
		...(avatarUrl ? { avatarUrl } : {}),
		...(email ? { email } : {})
	};
}

function buildGitHubAuthEnv(authToken: string): NodeJS.ProcessEnv {
	return {
		...process.env,
		GH_TOKEN: authToken,
		GITHUB_TOKEN: authToken
	};
}

function resolveGitHubCliDetail(stdout: string, stderr: string): string | undefined {
	const normalizedStderr = stderr
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.find((line) => line.length > 0);
	if (normalizedStderr) {
		return normalizedStderr.replace(/^gh:\s*/u, '').trim();
	}

	const trimmedStdout = stdout.trim();
	if (!trimmedStdout) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(trimmedStdout) as { message?: unknown };
		const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';
		if (message) {
			return message;
		}
	} catch {
		// ignore JSON parse errors and fall back to the first non-empty line
	}

	return trimmedStdout
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.find((line) => line.length > 0);
}
function parseGitHubUserResponse(output: string): { login?: string; email?: string; avatar_url?: string } | undefined {
	const normalizedOutput = output.trim();
	if (!normalizedOutput) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(normalizedOutput) as {
			login?: unknown;
			email?: unknown;
			avatar_url?: unknown;
		};
		const login = normalizeOptionalString(parsed.login);
		const email = normalizeOptionalString(parsed.email);
		const avatarUrl = normalizeOptionalString(parsed.avatar_url);
		return {
			...(login ? { login } : {}),
			...(email ? { email } : {}),
			...(avatarUrl ? { avatar_url: avatarUrl } : {})
		};
	} catch {
		return undefined;
	}
}

function resolvePrimaryGitHubEmail(output: string): string | undefined {
	const normalizedOutput = output.trim();
	if (!normalizedOutput) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(normalizedOutput) as Array<{
			email?: unknown;
			primary?: unknown;
			verified?: unknown;
			visibility?: unknown;
		}>;
		const preferred = parsed.find((entry) => entry.primary === true && entry.verified === true)
			?? parsed.find((entry) => entry.primary === true)
			?? parsed.find((entry) => entry.verified === true)
			?? parsed.find((entry) => normalizeOptionalString(entry.visibility) === 'public')
			?? parsed[0];
		return normalizeOptionalString(preferred?.email);
	} catch {
		return undefined;
	}
}

function normalizeOptionalString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
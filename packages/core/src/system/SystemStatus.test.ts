import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('SystemStatus', () => {
    afterEach(async () => {
        vi.resetModules();
        vi.unstubAllEnvs();
    });

    it('falls back to gh on PATH when Mission config has no ghBinary', async () => {
        const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-system-status-'));
        const configHome = path.join(sandboxRoot, 'config-home');
        const binDirectory = path.join(sandboxRoot, 'bin');
        await fs.mkdir(binDirectory, { recursive: true });
        await fs.writeFile(
            path.join(binDirectory, 'gh'),
            `#!/bin/sh
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  echo "authentication required" >&2
  exit 1
fi
if [ "$1" = "api" ] && [ "$2" = "user" ]; then
  echo "fallback-user"
  exit 0
fi
exit 1
`,
            { mode: 0o755 }
        );

        vi.stubEnv('XDG_CONFIG_HOME', configHome);
        vi.stubEnv('PATH', `${binDirectory}:${process.env['PATH'] ?? ''}`);

        const { readSystemStatus } = await import('./SystemStatus.js');
        const status = readSystemStatus({ cwd: sandboxRoot });

        expect(status.github.cliAvailable).toBe(true);
        expect(status.github.authenticated).toBe(false);
        expect(status.github.detail).toBe('authentication required');

        await fs.rm(sandboxRoot, { recursive: true, force: true });
    });

    it('reports gh as missing when Mission config has no ghBinary and gh is not on PATH', async () => {
        const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-system-status-'));
        const configHome = path.join(sandboxRoot, 'config-home');
        const emptyPathDirectory = path.join(sandboxRoot, 'empty-path');
        await fs.mkdir(emptyPathDirectory, { recursive: true });

        vi.stubEnv('XDG_CONFIG_HOME', configHome);
        vi.stubEnv('PATH', emptyPathDirectory);

        const { readSystemStatus } = await import('./SystemStatus.js');
        const status = readSystemStatus({ cwd: sandboxRoot });

        expect(status.github.cliAvailable).toBe(false);
        expect(status.github.authenticated).toBe(false);
        expect(status.github.detail).toBe("GitHub CLI is not installed at 'gh'.");

        await fs.rm(sandboxRoot, { recursive: true, force: true });
    });

    it('invalidates cached status when PATH changes', async () => {
        const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-system-status-'));
        const configHome = path.join(sandboxRoot, 'config-home');
        const missingPathDirectory = path.join(sandboxRoot, 'missing-path');
        const binDirectory = path.join(sandboxRoot, 'bin');
        await fs.mkdir(missingPathDirectory, { recursive: true });
        await fs.mkdir(binDirectory, { recursive: true });
        await fs.writeFile(
            path.join(binDirectory, 'gh'),
            `#!/bin/sh
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  echo "Logged in to github.com as mission-test"
  exit 0
fi
if [ "$1" = "api" ] && [ "$2" = "user" ]; then
  echo "mission-test"
  exit 0
fi
exit 1
`,
            { mode: 0o755 }
        );

        vi.stubEnv('XDG_CONFIG_HOME', configHome);
        vi.stubEnv('PATH', missingPathDirectory);

        const { readSystemStatus } = await import('./SystemStatus.js');
        const missing = readSystemStatus({ cwd: sandboxRoot });
        expect(missing.github.cliAvailable).toBe(false);

        vi.stubEnv('PATH', `${binDirectory}:${missingPathDirectory}`);
        const available = readSystemStatus({ cwd: sandboxRoot });
        expect(available.github.cliAvailable).toBe(true);
        expect(available.github.authenticated).toBe(true);
        expect(available.github.user).toBe('mission-test');

        await fs.rm(sandboxRoot, { recursive: true, force: true });
    });

    it('resolves GitHub email from token-backed identity when available', async () => {
        const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-system-status-'));
        const configHome = path.join(sandboxRoot, 'config-home');
        const binDirectory = path.join(sandboxRoot, 'bin');
        await fs.mkdir(binDirectory, { recursive: true });
        await fs.writeFile(
            path.join(binDirectory, 'gh'),
            `#!/bin/sh
if [ "$1" = "api" ] && [ "$2" = "user" ] && [ "$3" = "--jq" ] && [ "$4" = ".login" ]; then
  echo "mission-test"
  exit 0
fi
if [ "$1" = "api" ] && [ "$2" = "user" ]; then
  echo '{"login":"mission-test","email":null}'
  exit 0
fi
if [ "$1" = "api" ] && [ "$2" = "user/emails" ]; then
  echo '[{"email":"mission@example.com","primary":true,"verified":true}]'
  exit 0
fi
exit 1
`,
            { mode: 0o755 }
        );

        vi.stubEnv('XDG_CONFIG_HOME', configHome);
        vi.stubEnv('PATH', `${binDirectory}:${process.env['PATH'] ?? ''}`);

        const { readSystemStatus } = await import('./SystemStatus.js');
        const status = readSystemStatus({ cwd: sandboxRoot, authToken: 'ghp_test_token' });

        expect(status.github.authenticated).toBe(true);
        expect(status.github.user).toBe('mission-test');
        expect(status.github.email).toBe('mission@example.com');

        await fs.rm(sandboxRoot, { recursive: true, force: true });
    });
});
import { describe, expect, it } from 'vitest';
import { createResponse } from './runDaemonMain.js';

describe('minimal source daemon request handling', () => {
    it('acknowledges event subscriptions so SSE streams can stay open', async () => {
        await expect(createResponse({
            type: 'request',
            id: 'request-1',
            method: 'event.subscribe',
            params: {
                channels: ['mission:mission-29.status']
            }
        }, '2026-04-26T18:05:00.000Z')).resolves.toEqual({
            type: 'response',
            id: 'request-1',
            ok: true,
            result: null
        });
    });

    it.each([
        'session.terminal.state',
        'session.terminal.input'
    ] as const)('returns null for unavailable terminal method %s', async (method) => {
        await expect(createResponse({
            type: 'request',
            id: `request-${method}`,
            method,
            params: {
                selector: { missionId: 'mission-29' },
                sessionId: 'session-1'
            }
        }, '2026-04-26T18:15:00.000Z')).resolves.toEqual({
            type: 'response',
            id: `request-${method}`,
            ok: true,
            result: null
        });
    });

    it('returns null for mission terminal state requests when no terminal exists', async () => {
        const response = await createResponse({
            type: 'request',
            id: 'request-mission-terminal-state',
            method: 'mission.terminal.state',
            surfacePath: '/repositories/Flying-Pillow/connect-four',
            params: {
                selector: { missionId: '1-initial-setup' }
            }
        }, '2026-04-26T18:15:00.000Z');

        expect(response).toEqual({
            type: 'response',
            id: 'request-mission-terminal-state',
            ok: true,
            result: null
        });
    });

    it('returns a mission terminal snapshot for mission terminal ensure requests', async () => {
        const response = await createResponse({
            type: 'request',
            id: 'request-mission-terminal-ensure',
            method: 'mission.terminal.ensure',
            surfacePath: '/repositories/Flying-Pillow/connect-four',
            params: {
                selector: { missionId: '1-initial-setup' }
            }
        }, '2026-04-26T18:15:00.000Z');

        expect(response.type).toBe('response');
        expect(response.id).toBe('request-mission-terminal-ensure');
        expect(response.ok).toBe(true);
        if (!response.ok) {
            return;
        }
        expect(response.result).toMatchObject({
            sessionId: expect.stringContaining('mission-shell:'),
            connected: true,
            dead: false,
            exitCode: null,
            screen: expect.any(String)
        });
    });

    it('returns a mission terminal snapshot for mission terminal input requests after explicit ensure', async () => {
        await createResponse({
            type: 'request',
            id: 'request-mission-terminal-ensure-for-input',
            method: 'mission.terminal.ensure',
            surfacePath: '/repositories/Flying-Pillow/connect-four',
            params: {
                selector: { missionId: '1-initial-setup' }
            }
        }, '2026-04-26T18:15:00.000Z');

        const response = await createResponse({
            type: 'request',
            id: 'request-mission-terminal-input',
            method: 'mission.terminal.input',
            surfacePath: '/repositories/Flying-Pillow/connect-four',
            params: {
                selector: { missionId: '1-initial-setup' },
                data: 'printf daemon-terminal-test\n',
                respondWithState: true
            }
        }, '2026-04-26T18:15:00.000Z');

        expect(response.type).toBe('response');
        expect(response.id).toBe('request-mission-terminal-input');
        expect(response.ok).toBe(true);
        if (!response.ok) {
            return;
        }
        expect(response.result).toMatchObject({
            sessionId: expect.stringContaining('mission-shell:'),
            connected: true,
            dead: false,
            exitCode: null,
            screen: expect.any(String)
        });
    });
});
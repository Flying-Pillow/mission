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

    it('returns a mission terminal snapshot for mission entity ensure requests', async () => {
        const response = await createResponse({
            type: 'request',
            id: 'request-mission-terminal-ensure',
            method: 'entity.command',
            surfacePath: '/repositories/Flying-Pillow/connect-four',
            params: {
                entity: 'Mission',
                method: 'ensureTerminal',
                payload: { missionId: '1-initial-setup' }
            }
        }, '2026-04-26T18:15:00.000Z');

        expect(response.type).toBe('response');
        expect(response.id).toBe('request-mission-terminal-ensure');
        expect(response.ok).toBe(true);
        if (!response.ok) {
            return;
        }
        expect(response.result).toMatchObject({
            missionId: '1-initial-setup',
            connected: true,
            dead: false,
            exitCode: null,
            screen: expect.any(String)
        });
    });

    it('returns a mission terminal snapshot for mission entity input requests after explicit ensure', async () => {
        await createResponse({
            type: 'request',
            id: 'request-mission-terminal-ensure-for-input',
            method: 'entity.command',
            surfacePath: '/repositories/Flying-Pillow/connect-four',
            params: {
                entity: 'Mission',
                method: 'ensureTerminal',
                payload: { missionId: '1-initial-setup' }
            }
        }, '2026-04-26T18:15:00.000Z');

        const response = await createResponse({
            type: 'request',
            id: 'request-mission-terminal-input',
            method: 'entity.command',
            surfacePath: '/repositories/Flying-Pillow/connect-four',
            params: {
                entity: 'Mission',
                method: 'sendTerminalInput',
                payload: {
                    missionId: '1-initial-setup',
                    data: 'printf daemon-terminal-test\n'
                }
            }
        }, '2026-04-26T18:15:00.000Z');

        expect(response.type).toBe('response');
        expect(response.id).toBe('request-mission-terminal-input');
        expect(response.ok).toBe(true);
        if (!response.ok) {
            return;
        }
        expect(response.result).toMatchObject({
            missionId: '1-initial-setup',
            connected: true,
            dead: false,
            exitCode: null,
            screen: expect.any(String)
        });
    });
});
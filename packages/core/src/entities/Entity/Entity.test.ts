import { describe, expect, it } from 'vitest';
import {
    createEntityChannel,
    createEntityId,
    getEntityTable,
    matchesEntityChannel
} from './Entity.js';

describe('Entity event identity', () => {
    it('creates canonical table ids and event channels', () => {
        const entityId = createEntityId('task', 'mission-29/stage/task-1');

        expect(entityId).toBe('task:mission-29/stage/task-1');
        expect(getEntityTable(entityId)).toBe('task');
        expect(createEntityChannel(entityId, 'snapshot.changed')).toBe('task:mission-29/stage/task-1.snapshot.changed');
    });

    it('matches exact and wildcard channel subscriptions', () => {
        const channel = createEntityChannel(createEntityId('task', 'mission-29/stage/task-1'), 'snapshot.changed');

        expect(matchesEntityChannel(channel, 'task:mission-29/*.*')).toBe(true);
        expect(matchesEntityChannel(channel, 'task:mission-30/*.*')).toBe(false);
        expect(matchesEntityChannel(channel, channel)).toBe(true);
    });
});

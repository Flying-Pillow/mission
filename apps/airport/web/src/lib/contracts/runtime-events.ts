import type {
    AgentSessionSnapshot,
    EntityEventEnvelope,
    MissionActionListSnapshot,
    MissionArtifactSnapshot,
    MissionSnapshot,
    MissionStageSnapshot,
    MissionStatusSnapshot,
    MissionTaskSnapshot
} from '@flying-pillow/mission-core/entities';

export { entityEventEnvelopeSchema as airportRuntimeEventEnvelopeSchema } from '@flying-pillow/mission-core/entities';

type AirportRuntimeEventBase = Omit<EntityEventEnvelope, 'type' | 'payload'>;

export type AirportRuntimeEventEnvelope = AirportRuntimeEventBase & (
    | {
        type: 'mission.snapshot.changed';
        payload: {
            snapshot: MissionSnapshot;
        };
    }
    | {
        type: 'mission.actions.changed';
        payload: {
            actions?: MissionActionListSnapshot;
        };
    }
    | {
        type: 'mission.status';
        payload: {
            status: MissionStatusSnapshot;
        };
    }
    | {
        type: 'stage.snapshot.changed';
        payload: {
            snapshot: MissionStageSnapshot;
        };
    }
    | {
        type: 'task.snapshot.changed';
        payload: {
            snapshot: MissionTaskSnapshot;
        };
    }
    | {
        type: 'artifact.snapshot.changed';
        payload: {
            snapshot: MissionArtifactSnapshot;
        };
    }
    | {
        type: 'agentSession.snapshot.changed';
        payload: {
            snapshot: AgentSessionSnapshot;
        };
    }
    | {
        type: 'session.event';
        payload: {
            session: AgentSessionSnapshot;
        };
    }
    | {
        type: 'session.lifecycle';
        payload: unknown;
    }
);

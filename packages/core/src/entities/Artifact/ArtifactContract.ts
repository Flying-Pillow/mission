import type { EntityContractType } from '../Entity/EntitySchema.js';
import { Artifact } from './Artifact.js';
import {
    artifactEntityName,
    ArtifactLocatorSchema,
    ArtifactWriteInputSchema,
    ArtifactStorageSchema,
    ArtifactDataSchema,
    ArtifactBodySnapshotSchema,
    ArtifactSnapshotChangedEventSchema
} from './ArtifactSchema.js';

export const ArtifactContract: EntityContractType = {
    entity: artifactEntityName,
    entityClass: Artifact,
    inputSchema: ArtifactLocatorSchema,
    storageSchema: ArtifactStorageSchema,
    dataSchema: ArtifactDataSchema,
    methods: {
        read: {
            kind: 'query',
            payload: ArtifactLocatorSchema,
            result: ArtifactDataSchema,
            execution: 'class'
        },
        readDocument: {
            kind: 'query',
            payload: ArtifactLocatorSchema,
            result: ArtifactBodySnapshotSchema,
            execution: 'class'
        },
        writeDocument: {
            kind: 'mutation',
            payload: ArtifactWriteInputSchema,
            result: ArtifactBodySnapshotSchema,
            execution: 'class'
        }
    },
    events: {
        'snapshot.changed': {
            payload: ArtifactSnapshotChangedEventSchema
        }
    }
};

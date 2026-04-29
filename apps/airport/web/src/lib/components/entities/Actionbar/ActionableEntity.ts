import type { EntityCommandDescriptor } from '@flying-pillow/mission-core/entities/Entity/EntitySchema';

export type ActionableEntity = {
    readonly entityName: string;
    readonly entityId: string;
    readonly commands: EntityCommandDescriptor[];
    executeCommand(commandId: string, input?: unknown): Promise<void>;
};
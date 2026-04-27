import { z } from 'zod/v4';

export type EntityStateSnapshot<TSnapshot extends object, TCommandSnapshot extends object> = {
	data: TSnapshot;
	commands?: TCommandSnapshot;
};

export abstract class Entity<
	TSnapshot extends object,
	TId extends string = string,
	TCommandSnapshot extends object = never
> {
	private snapshotState: TSnapshot;
	private commandState: TCommandSnapshot | undefined;

	protected constructor(snapshot: TSnapshot) {
		this.snapshotState = structuredClone(snapshot);
	}

	public abstract get id(): TId;

	protected get data(): TSnapshot {
		return this.snapshotState;
	}

	protected set data(snapshot: TSnapshot) {
		this.snapshotState = structuredClone(snapshot);
	}

	public updateFromSnapshot(snapshot: TSnapshot): this {
		this.data = snapshot;
		return this;
	}

	public toSnapshot(): TSnapshot {
		return structuredClone(this.data);
	}

	protected get commands(): TCommandSnapshot | undefined {
		return this.commandState
			? structuredClone(this.commandState)
			: undefined;
	}

	protected set commands(snapshot: TCommandSnapshot | undefined) {
		this.commandState = snapshot
			? structuredClone(snapshot)
			: undefined;
	}

	public toStateSnapshot(): EntityStateSnapshot<TSnapshot, TCommandSnapshot> {
		return {
			data: this.toSnapshot(),
			...(this.commands ? { commands: this.commands } : {})
		};
	}

	public toJSON(): TSnapshot {
		return this.toSnapshot();
	}
}

const entityTableSchema = z.string().trim().min(1).regex(/^[a-z][a-z0-9_]*$/);
const nonEmptyStringSchema = z.string().trim().min(1);

export const entityIdSchema = z.string().trim().min(1).refine((value) => {
	const separatorIndex = value.indexOf(':');
	if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
		return false;
	}
	return entityTableSchema.safeParse(value.slice(0, separatorIndex)).success;
}, {
	message: 'Entity ids must use the table:uniqueId shape.'
});

export const entityChannelSchema = z.string().trim().min(1).refine((value) => {
	const tableSeparatorIndex = value.indexOf(':');
	const eventSeparatorIndex = value.lastIndexOf('.');
	if (tableSeparatorIndex <= 0 || tableSeparatorIndex === value.length - 1) {
		return false;
	}
	if (eventSeparatorIndex <= tableSeparatorIndex + 1 || eventSeparatorIndex === value.length - 1) {
		return false;
	}
	return entityTableSchema.safeParse(value.slice(0, tableSeparatorIndex)).success;
}, {
	message: 'Entity channels must use the table:uniqueId.event shape.'
});

export const entityEventAddressSchema = z.object({
	entityId: entityIdSchema,
	channel: entityChannelSchema,
	eventName: nonEmptyStringSchema
}).strict();

export type EntityId = z.infer<typeof entityIdSchema>;
export type EntityChannel = z.infer<typeof entityChannelSchema>;
export type EntityEventAddress = z.infer<typeof entityEventAddressSchema>;

export function createEntityId(table: string, uniqueId: string): EntityId {
	const normalizedTable = entityTableSchema.parse(table);
	const normalizedUniqueId = nonEmptyStringSchema.parse(uniqueId);
	return entityIdSchema.parse(`${normalizedTable}:${normalizedUniqueId}`);
}

export function createEntityChannel(entityId: EntityId | string, eventName: string): EntityChannel {
	const normalizedEntityId = entityIdSchema.parse(entityId);
	const normalizedEventName = nonEmptyStringSchema.parse(eventName);
	return entityChannelSchema.parse(`${normalizedEntityId}.${normalizedEventName}`);
}

export function getEntityTable(entityId: EntityId | string): string {
	const normalizedEntityId = entityIdSchema.parse(entityId);
	return normalizedEntityId.slice(0, normalizedEntityId.indexOf(':'));
}

export function matchesEntityChannel(channel: string, pattern: string): boolean {
	const normalizedChannel = entityChannelSchema.parse(channel);
	const normalizedPattern = nonEmptyStringSchema.parse(pattern);
	if (normalizedPattern === '*') {
		return true;
	}
	if (!normalizedPattern.includes('*')) {
		return normalizedChannel === normalizedPattern;
	}
	const expression = `^${normalizedPattern.split('*').map(escapeRegExp).join('.*')}$`;
	return new RegExp(expression).test(normalizedChannel);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
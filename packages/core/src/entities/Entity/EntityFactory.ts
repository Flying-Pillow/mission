import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod/v4';
import { getMissionDaemonDirectory } from '../../lib/config.js';
import type { Entity } from './Entity.js';
import { entityTableSchema } from './EntitySchema.js';

export type EntityConstructor<
	TEntity extends Entity<TStorage, string>,
	TStorage extends object
> = {
	readonly entityName: string;
	new(data: TStorage): TEntity;
};

export type EntityFactoryDefinition<
	TEntity extends Entity<TStorage, string>,
	TStorage extends object
> = {
	entityName: string;
	table: string;
	entityClass: EntityConstructor<TEntity, TStorage>;
	storageSchema: z.ZodType<TStorage>;
	getId(record: TStorage): string;
};

export interface EntityStore {
	read(table: string, id: string): Promise<unknown | undefined>;
	list(table: string): Promise<unknown[]>;
	write(table: string, id: string, record: unknown): Promise<void>;
	delete(table: string, id: string): Promise<void>;
}

export class EntityFactory {
	private readonly definitionsByClass = new WeakMap<Function, EntityFactoryDefinition<any, any>>();
	private readonly definitionsByName = new Map<string, EntityFactoryDefinition<any, any>>();

	public constructor(private readonly store: EntityStore = new FilesystemEntityStore()) { }

	public register<
		TEntity extends Entity<TStorage, string>,
		TStorage extends object
	>(definition: EntityFactoryDefinition<TEntity, TStorage>): this {
		const normalizedDefinition = {
			...definition,
			table: entityTableSchema.parse(definition.table)
		};
		this.definitionsByClass.set(definition.entityClass, normalizedDefinition);
		this.definitionsByName.set(definition.entityName, normalizedDefinition);
		return this;
	}

	public has(entityClass: Function): boolean {
		return this.definitionsByClass.has(entityClass);
	}

	public async create<
		TEntity extends Entity<TStorage, string>,
		TStorage extends object
	>(entityClass: EntityConstructor<TEntity, TStorage>, record: TStorage): Promise<TEntity> {
		const definition = this.requireDefinition(entityClass);
		const parsedRecord = definition.storageSchema.parse(record) as TStorage;
		await this.store.write(definition.table, definition.getId(parsedRecord), parsedRecord);
		return this.hydrate(entityClass, parsedRecord);
	}

	public async save<
		TEntity extends Entity<TStorage, string>,
		TStorage extends object
	>(entityClass: EntityConstructor<TEntity, TStorage>, record: TStorage): Promise<TEntity> {
		return this.create(entityClass, record);
	}

	public async read<
		TEntity extends Entity<TStorage, string>,
		TStorage extends object
	>(entityClass: EntityConstructor<TEntity, TStorage>, id: string): Promise<TEntity | undefined> {
		const definition = this.requireDefinition(entityClass);
		const record = await this.store.read(definition.table, id);
		return record === undefined ? undefined : this.hydrate(entityClass, record);
	}

	public async find<
		TEntity extends Entity<TStorage, string>,
		TStorage extends object
	>(entityClass: EntityConstructor<TEntity, TStorage>): Promise<TEntity[]> {
		const definition = this.requireDefinition(entityClass);
		return (await this.store.list(definition.table)).map((record) => this.hydrate(entityClass, record));
	}

	public async remove<
		TEntity extends Entity<TStorage, string>,
		TStorage extends object
	>(entityClass: EntityConstructor<TEntity, TStorage>, id: string): Promise<void> {
		const definition = this.requireDefinition(entityClass);
		await this.store.delete(definition.table, id);
	}

	public hydrate<
		TEntity extends Entity<TStorage, string>,
		TStorage extends object
	>(entityClass: EntityConstructor<TEntity, TStorage>, record: unknown): TEntity {
		const definition = this.requireDefinition(entityClass);
		return new entityClass(definition.storageSchema.parse(record) as TStorage);
	}

	private requireDefinition<
		TEntity extends Entity<TStorage, string>,
		TStorage extends object
	>(entityClass: EntityConstructor<TEntity, TStorage>): EntityFactoryDefinition<TEntity, TStorage> {
		const definition = this.definitionsByClass.get(entityClass);
		if (!definition) {
			throw new Error(`Entity '${entityClass.entityName}' is not registered in the Entity factory.`);
		}
		return definition as EntityFactoryDefinition<TEntity, TStorage>;
	}
}

export class FilesystemEntityStore implements EntityStore {
	public constructor(private readonly rootPath = path.join(getMissionDaemonDirectory(), 'entities')) { }

	public async read(table: string, id: string): Promise<unknown | undefined> {
		return (await this.readTable(table))[id];
	}

	public async list(table: string): Promise<unknown[]> {
		return Object.values(await this.readTable(table));
	}

	public async write(table: string, id: string, record: unknown): Promise<void> {
		const records = await this.readTable(table);
		records[id] = record;
		await this.writeTable(table, records);
	}

	public async delete(table: string, id: string): Promise<void> {
		const records = await this.readTable(table);
		if (!(id in records)) {
			return;
		}
		delete records[id];
		await this.writeTable(table, records);
	}

	private async readTable(table: string): Promise<Record<string, unknown>> {
		const tablePath = this.getTablePath(table);
		try {
			const content = await fs.readFile(tablePath, 'utf8');
			const parsed = JSON.parse(content) as unknown;
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				throw new Error(`Entity table '${tablePath}' must contain a JSON object.`);
			}
			return parsed as Record<string, unknown>;
		} catch (error) {
			if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
				return {};
			}
			throw error;
		}
	}

	private async writeTable(table: string, records: Record<string, unknown>): Promise<void> {
		const tablePath = this.getTablePath(table);
		await fs.mkdir(path.dirname(tablePath), { recursive: true });
		const temporaryPath = `${tablePath}.${process.pid.toString(36)}.${Date.now().toString(36)}.tmp`;
		await fs.writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
		await fs.rename(temporaryPath, tablePath);
	}

	private getTablePath(table: string): string {
		return path.join(this.rootPath, `${entityTableSchema.parse(table)}.json`);
	}
}

let defaultEntityFactory: EntityFactory | undefined;

export function getDefaultEntityFactory(): EntityFactory {
	defaultEntityFactory ??= new EntityFactory();
	return defaultEntityFactory;
}

export function setDefaultEntityFactory(factory: EntityFactory): void {
	defaultEntityFactory = factory;
}
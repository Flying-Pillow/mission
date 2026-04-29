export interface EntityStore {
    read(table: string, id: string): Promise<unknown | undefined>;
    list(table: string): Promise<unknown[]>;
    write(table: string, id: string, record: unknown): Promise<void>;
    delete(table: string, id: string): Promise<void>;
}
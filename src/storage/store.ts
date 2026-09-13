export interface EntityStore<T> {
  get(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
  put(id: string, value: T): Promise<void>;
  delete(id: string): Promise<boolean>;
}

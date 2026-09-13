import type { EntityStore } from "./store.js";

export class MemoryStore<T> implements EntityStore<T> {
  private readonly values = new Map<string, T>();

  async get(id: string): Promise<T | undefined> {
    return this.values.get(id);
  }

  async list(): Promise<T[]> {
    return [...this.values.values()];
  }

  async put(id: string, value: T): Promise<void> {
    this.values.set(id, value);
  }

  async delete(id: string): Promise<boolean> {
    return this.values.delete(id);
  }
}

import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EntityStore } from "./store.js";

interface StoredEnvelope<T> {
  id: string;
  value: T;
}

function safeFileName(id: string): string {
  if (!id.trim()) throw new Error("Entity id must not be empty");
  return `${encodeURIComponent(id).replace(/\./g, "%2E")}.json`;
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

export class JsonDirectoryStore<T> implements EntityStore<T> {
  constructor(private readonly directory: string) {}

  private async ensureDirectory(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  private pathFor(id: string): string {
    return join(this.directory, safeFileName(id));
  }

  async get(id: string): Promise<T | undefined> {
    await this.ensureDirectory();
    try {
      const raw = await readFile(this.pathFor(id), "utf8");
      const envelope = JSON.parse(raw) as StoredEnvelope<T>;
      if (envelope.id !== id) throw new Error(`Stored entity id mismatch for ${id}`);
      return envelope.value;
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  async list(): Promise<T[]> {
    await this.ensureDirectory();
    const entries = (await readdir(this.directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort();

    const values: T[] = [];
    for (const fileName of entries) {
      const raw = await readFile(join(this.directory, fileName), "utf8");
      const envelope = JSON.parse(raw) as StoredEnvelope<T>;
      values.push(envelope.value);
    }
    return values;
  }

  async put(id: string, value: T): Promise<void> {
    await this.ensureDirectory();
    const target = this.pathFor(id);
    const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
    const payload = `${JSON.stringify({ id, value } satisfies StoredEnvelope<T>, null, 2)}\n`;
    await writeFile(temp, payload, { encoding: "utf8", mode: 0o600 });
    await rename(temp, target);
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureDirectory();
    try {
      await unlink(this.pathFor(id));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}

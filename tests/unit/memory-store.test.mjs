import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore } from "../../dist/storage/memory-store.js";

test("memory store implements the storage boundary", async () => {
  const store = new MemoryStore();
  await store.put("one", { value: 1 });
  assert.deepEqual(await store.get("one"), { value: 1 });
  assert.equal((await store.list()).length, 1);
  assert.equal(await store.delete("one"), true);
  assert.equal(await store.get("one"), undefined);
});

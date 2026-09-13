import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JsonDirectoryStore } from "../../dist/storage/json-directory-store.js";

test("json directory store persists across store instances and prevents path traversal ids", async () => {
  const root = await mkdtemp(join(tmpdir(), "joblens-store-"));
  try {
    const first = new JsonDirectoryStore(root);
    await first.put("../job:1", { title: "Backend" });

    const second = new JsonDirectoryStore(root);
    assert.deepEqual(await second.get("../job:1"), { title: "Backend" });
    assert.deepEqual(await second.list(), [{ title: "Backend" }]);

    const files = await import("node:fs/promises").then(({ readdir }) => readdir(root));
    assert.equal(files.length, 1);
    assert.equal(files[0].includes("/"), false);
    const raw = await readFile(join(root, files[0]), "utf8");
    assert.match(raw, /"id": "\.\.\/job:1"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

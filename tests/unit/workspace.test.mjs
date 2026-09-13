import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initializeWorkspace } from "../../dist/workspace/workspace.js";

test("workspace initializes private runtime directories and persistent stores", async () => {
  const root = await mkdtemp(join(tmpdir(), "joblens-workspace-"));
  try {
    const stores = await initializeWorkspace(root);
    await stores.jobs.put("job:1", { id: "job:1" });
    assert.equal((await stores.jobs.get("job:1")).id, "job:1");
    const directories = await readdir(root);
    for (const expected of ["profile", "documents", "jobs", "opportunities", "research", "applications", "tracker", "cache", "logs", "tmp"]) {
      assert.equal(directories.includes(expected), true);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

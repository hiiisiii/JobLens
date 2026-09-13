import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore } from "../../dist/storage/memory-store.js";
import { persistDiscoveredJobs } from "../../dist/discovery/persistence.js";

function job(id, sourceId, externalId, url, title = "Backend Engineer") {
  return {
    id,
    sourceRefs: [{ sourceId, externalId, url, canonicalUrl: url }],
    companyName: "Example",
    title,
    locations: ["Seoul"],
    requiredSkills: [],
    preferredSkills: [],
    status: "open",
    fullText: `${title} at Example`,
    fingerprint: `fingerprint:${id}`,
    discoveredAt: "2026-09-14T00:00:00Z",
    updatedAt: "2026-09-14T00:00:00Z",
  };
}

test("persistence preserves canonical job id when a later source finds the same URL", async () => {
  const store = new MemoryStore();
  await store.put("job:first", job("job:first", "source-a", "1", "https://company.example/jobs/1"));

  const result = await persistDiscoveredJobs({
    store,
    jobs: [job("job:second", "source-b", "2", "https://company.example/jobs/1")],
    now: "2026-09-14T01:00:00Z",
  });

  assert.equal(result.created, 0);
  assert.equal(result.updated, 1);
  assert.deepEqual(result.persistedJobIds, ["job:first"]);
  const persisted = await store.get("job:first");
  assert.equal(persisted.sourceRefs.length, 2);
  assert.equal(await store.get("job:second"), undefined);
});

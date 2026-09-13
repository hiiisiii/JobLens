import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore } from "../../dist/storage/memory-store.js";
import { rankAndPersistJobs } from "../../dist/ranking/ranking-service.js";

const profile = {
  profileId: "candidate",
  version: "v1",
  updatedAt: "2026-09-14T00:00:00Z",
  targetRoles: ["Backend Developer"],
  targetLevels: ["Junior"],
  skills: [
    { name: "Node.js", evidenceIds: ["candidate:node"] },
    { name: "TypeScript", evidenceIds: ["candidate:ts"] },
  ],
  locations: ["Seoul"],
  mustHaves: [],
  dealBreakers: [],
  documentRefs: [],
};

function job(overrides = {}) {
  return {
    id: "job:1",
    sourceRefs: [{ sourceId: "manual", url: "https://example.com/jobs/1" }],
    companyName: "Example",
    title: "Junior Backend Developer",
    locations: ["Seoul"],
    requiredSkills: ["Node.js", "TypeScript"],
    preferredSkills: [],
    contentCompleteness: "full",
    status: "open",
    fullText: "Junior backend role using Node.js and TypeScript",
    fingerprint: "fingerprint",
    discoveredAt: "2026-09-14T00:00:00Z",
    updatedAt: "2026-09-14T00:00:00Z",
    ...overrides,
  };
}

test("ranking persists evaluation and creates an evaluated opportunity", async () => {
  const evaluations = new MemoryStore();
  const opportunities = new MemoryStore();
  const result = await rankAndPersistJobs({
    jobs: [job()],
    profile,
    evaluationStore: evaluations,
    opportunityStore: opportunities,
    now: "2026-09-14T00:01:00Z",
  });

  assert.equal(result.createdOpportunities, 1);
  assert.equal(result.updatedOpportunities, 0);
  assert.equal(result.opportunities[0].state, "EVALUATED");
  assert.equal((await evaluations.list()).length, 1);
  assert.equal((await opportunities.list()).length, 1);
});

test("failed hard gate persists an excluded opportunity without fit score", async () => {
  const evaluations = new MemoryStore();
  const opportunities = new MemoryStore();
  const result = await rankAndPersistJobs({
    jobs: [job({ experienceRequirement: { minYears: 5, rawText: "5+ years" } })],
    profile,
    evaluationStore: evaluations,
    opportunityStore: opportunities,
    now: "2026-09-14T00:01:00Z",
  });

  assert.equal(result.opportunities[0].state, "EXCLUDED");
  assert.equal(result.evaluations[0].hardGate, "FAIL");
  assert.equal(result.evaluations[0].fitScore, undefined);
});

test("reranking is idempotent and preserves explicit user decision state", async () => {
  const evaluations = new MemoryStore();
  const opportunities = new MemoryStore();
  const first = await rankAndPersistJobs({
    jobs: [job()],
    profile,
    evaluationStore: evaluations,
    opportunityStore: opportunities,
    now: "2026-09-14T00:01:00Z",
  });
  const existing = first.opportunities[0];
  await opportunities.put(existing.opportunityId, { ...existing, state: "HOLD", decisionReason: "wait for portfolio update" });

  const second = await rankAndPersistJobs({
    jobs: [job()],
    profile,
    evaluationStore: evaluations,
    opportunityStore: opportunities,
    now: "2026-09-14T00:02:00Z",
  });

  assert.equal(second.createdOpportunities, 0);
  assert.equal(second.updatedOpportunities, 1);
  assert.equal(second.opportunities[0].state, "HOLD");
  assert.equal(second.opportunities[0].decisionReason, "wait for portfolio update");
  assert.equal((await evaluations.list()).length, 1);
});

import assert from "node:assert/strict";
import test from "node:test";
import { discoverJobs } from "../../dist/discovery/orchestrator.js";

const ctx = { requestId: "req-1", now: "2026-09-14T03:00:00+09:00", timeoutMs: 1000 };

function source({ id, url, externalId, title = "Backend Engineer", company = "Example", failSearch = false }) {
  return {
    metadata: { id, kind: "official_api", displayName: id, capabilities: ["HEALTH", "SEARCH", "DETAIL", "NORMALIZE"] },
    async healthCheck() { return { ok: true, data: { status: "healthy", checkedAt: ctx.now }, warnings: [] }; },
    async search() {
      if (failSearch) return { ok: false, error: { code: "TEMPORARY_UNAVAILABLE", sourceId: id, operation: "search", retryable: true, message: "down", occurredAt: ctx.now } };
      return { ok: true, data: { items: [{ ref: { sourceId: id, externalId, url, canonicalUrl: url }, title, company }], fetchedAt: ctx.now }, warnings: [] };
    },
    async fetch(ref) { return { ok: true, data: { ref, fetchedAt: ctx.now, payload: { title, company }, rawText: `${company} ${title}`, rawHash: `hash:${id}:${externalId}` }, warnings: [] }; },
    async normalize(raw) { return { ok: true, data: { sourceRef: raw.ref, company: { name: company }, title, locations: ["Seoul"], requiredSkills: [], preferredSkills: [], responsibilities: [], status: "open", fullText: `${company} ${title}`, rawHash: raw.rawHash, contentCompleteness: "partial" }, warnings: [] }; },
  };
}

test("one failing source does not fail discovery from other sources", async () => {
  const result = await discoverJobs({
    sources: [
      source({ id: "down", url: "https://down.example/1", externalId: "1", failSearch: true }),
      source({ id: "ok", url: "https://ok.example/2", externalId: "2" }),
    ],
    query: { keywords: ["backend"] },
    context: ctx,
  });
  assert.equal(result.jobs.length, 1);
  assert.equal(result.sourceFailures.length, 1);
  assert.equal(result.sourceFailures[0].sourceId, "down");
});

test("same canonical URL from multiple sources is merged", async () => {
  const url = "https://company.example/jobs/42";
  const result = await discoverJobs({
    sources: [
      source({ id: "a", url, externalId: "a-42" }),
      source({ id: "b", url, externalId: "b-42" }),
    ],
    query: { keywords: ["backend"] },
    context: ctx,
  });
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].sourceRefs.length, 2);
});

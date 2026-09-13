import assert from "node:assert/strict";
import test from "node:test";
import { WebSearchSource } from "../../dist/sources/web-search/web-search-source.js";
import { discoverJobs } from "../../dist/discovery/orchestrator.js";

const ctx = { requestId: "req-web", now: "2026-09-14T03:10:00+09:00", timeoutMs: 1000 };

test("web search provider is agent-agnostic and surfaces unmaterialized hits", async () => {
  let request;
  const provider = {
    id: "test-provider",
    async search(input) {
      request = input;
      return {
        items: [{ title: "Backend Engineer", url: "https://company.example/jobs/7?utm_source=x", snippet: "Node.js TypeScript" }],
        warnings: [],
      };
    },
  };
  const source = new WebSearchSource(provider);
  const result = await discoverJobs({
    sources: [source],
    query: { keywords: ["Node.js"], targetRoles: ["Backend"], locations: ["Seoul"] },
    context: ctx,
  });
  assert.equal(request.query, "Node.js Backend Seoul");
  assert.equal(result.jobs.length, 0);
  assert.equal(result.discoveredHits.length, 1);
  assert.equal(result.discoveredHits[0].ref.canonicalUrl, "https://company.example/jobs/7");
});

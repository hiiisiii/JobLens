import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JobLensToolService } from "../../dist/index.js";

function context(requestId) {
  return {
    requestId,
    workspaceId: "web-discovery-test",
    client: "chatgpt",
    actor: "assistant",
  };
}

async function withWorkspace(run) {
  const root = await mkdtemp(join(tmpdir(), "joblens-web-discovery-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const results = [
  {
    title: "Backend Developer - Example One",
    url: "https://example.com/jobs/one?utm_source=chat",
    snippet: "Node.js backend developer in Seoul",
  },
  {
    title: "Junior TypeScript Backend - Example Two",
    url: "https://example.org/careers/two",
    snippet: "TypeScript API role",
  },
];

test("client-assisted web search persists durable unmaterialized discovery hits", async () => {
  await withWorkspace(async (root) => {
    const service = new JobLensToolService(root, {});
    const discovered = await service.invoke({
      tool: "joblens_discover",
      input: {
        source: "web_search",
        providerId: "chatgpt",
        query: { keywords: ["Node.js", "TypeScript"], locations: ["Seoul"], pageSize: 10 },
        results,
      },
    }, context("req-web-1"));

    assert.equal(discovered.ok, true);
    assert.equal(discovered.data.discovery.jobs.length, 0);
    assert.equal(discovered.data.hits.records.length, 2);
    assert.equal(discovered.data.hits.created, 2);
    assert.equal(discovered.data.hits.records.every((item) => item.status === "DISCOVERED"), true);

    const persisted = await service.invoke({
      tool: "joblens_discovery_hits_list",
      input: { status: "DISCOVERED" },
    }, context("req-web-list"));
    assert.equal(persisted.ok, true);
    assert.equal(persisted.data.length, 2);
    assert.equal(persisted.data[0].sourceId, "web-search:provided:chatgpt");

    const jobs = await service.invoke({ tool: "joblens_jobs_list" }, context("req-jobs"));
    assert.equal(jobs.ok, true);
    assert.equal(jobs.data.length, 0);
  });
});

test("repeated web results keep stable hit ids instead of duplicating durable state", async () => {
  await withWorkspace(async (root) => {
    const service = new JobLensToolService(root, {});
    const input = {
      source: "web_search",
      providerId: "chatgpt",
      query: { keywords: ["backend"], locations: ["Seoul"] },
      results: [results[0]],
    };
    const first = await service.invoke({ tool: "joblens_discover", input }, context("req-repeat-1"));
    const second = await service.invoke({ tool: "joblens_discover", input }, context("req-repeat-2"));
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(first.data.hits.records[0].hitId, second.data.hits.records[0].hitId);
    assert.equal(second.data.hits.created, 0);
    assert.equal(second.data.hits.updated, 1);

    const persisted = await service.invoke({ tool: "joblens_discovery_hits_list" }, context("req-repeat-list"));
    assert.equal(persisted.ok, true);
    assert.equal(persisted.data.length, 1);
  });
});

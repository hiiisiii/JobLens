import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initializeWorkspace } from "../../dist/workspace/workspace.js";
import { materializeDiscoveryHit } from "../../dist/discovery/materialization-service.js";

function hit(overrides = {}) {
  return {
    hitId: "hit:web-1",
    sourceId: "web-search:test-client",
    sourceRef: {
      sourceId: "web-search:test-client",
      url: "https://search.example/jobs/backend?utm_source=test",
      canonicalUrl: "https://search.example/jobs/backend",
    },
    queryKey: "query:test",
    title: "Backend Developer",
    company: "Example Labs",
    location: "Seoul",
    snippet: "Search-result snippet only",
    status: "DISCOVERED",
    discoveredAt: "2026-09-14T00:00:00Z",
    lastSeenAt: "2026-09-14T00:00:00Z",
    ...overrides,
  };
}

function posting(overrides = {}) {
  return {
    sourceUrl: "https://careers.example.com/jobs/backend?utm_source=search",
    company: "Example Labs",
    title: "Backend Developer",
    fullText: "Example Labs is hiring a backend developer. Build Node.js and TypeScript APIs with PostgreSQL and collaborate with the product team.",
    contentCompleteness: "full",
    locations: ["Seoul"],
    requiredSkills: ["Node.js", "TypeScript", "PostgreSQL"],
    preferredSkills: ["AWS"],
    responsibilities: ["Build REST APIs"],
    status: "open",
    ...overrides,
  };
}

test("verified page content materializes a discovery hit into a canonical JobPosting", async () => {
  const root = await mkdtemp(join(tmpdir(), "joblens-materialize-"));
  try {
    const stores = await initializeWorkspace(root);
    await stores.discoveryHits.put("hit:web-1", hit());

    const result = await materializeDiscoveryHit({
      hitId: "hit:web-1",
      verifiedPosting: posting(),
      discoveryHitStore: stores.discoveryHits,
      jobStore: stores.jobs,
      now: "2026-09-14T01:00:00Z",
    });

    assert.equal(result.idempotent, false);
    assert.equal(result.hit.status, "MATERIALIZED");
    assert.equal(result.hit.materializedJobId, result.job.id);
    assert.equal(result.hit.verification.method, "client_fetched_page");
    assert.equal(result.hit.verification.sourceUrl, "https://careers.example.com/jobs/backend");
    assert.equal(result.job.companyName, "Example Labs");
    assert.equal(result.job.contentCompleteness, "full");
    assert.equal(result.job.sourceRefs.some((ref) => ref.sourceId === "web-search:test-client"), true);
    assert.equal(result.job.sourceRefs.some((ref) => ref.sourceId === "verified-page:web-search:test-client"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("materializing the same hit twice is idempotent and does not duplicate jobs", async () => {
  const root = await mkdtemp(join(tmpdir(), "joblens-materialize-idempotent-"));
  try {
    const stores = await initializeWorkspace(root);
    await stores.discoveryHits.put("hit:web-1", hit());
    const input = {
      hitId: "hit:web-1",
      verifiedPosting: posting(),
      discoveryHitStore: stores.discoveryHits,
      jobStore: stores.jobs,
      now: "2026-09-14T01:00:00Z",
    };
    const first = await materializeDiscoveryHit(input);
    const second = await materializeDiscoveryHit({ ...input, now: "2026-09-14T01:10:00Z" });

    assert.equal(first.job.id, second.job.id);
    assert.equal(second.idempotent, true);
    assert.equal((await stores.jobs.list()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("search snippets alone cannot materialize without explicit verified posting content", async () => {
  const root = await mkdtemp(join(tmpdir(), "joblens-materialize-guard-"));
  try {
    const stores = await initializeWorkspace(root);
    await stores.discoveryHits.put("hit:web-1", hit());

    await assert.rejects(
      materializeDiscoveryHit({
        hitId: "hit:web-1",
        verifiedPosting: posting({ fullText: "   " }),
        discoveryHitStore: stores.discoveryHits,
        jobStore: stores.jobs,
        now: "2026-09-14T01:00:00Z",
      }),
      /fullText must be a non-empty string/,
    );
    assert.equal((await stores.jobs.list()).length, 0);
    assert.equal((await stores.discoveryHits.get("hit:web-1")).status, "DISCOVERED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("materialization rejects missing hits and non-http source URLs", async () => {
  const root = await mkdtemp(join(tmpdir(), "joblens-materialize-invalid-"));
  try {
    const stores = await initializeWorkspace(root);
    await assert.rejects(
      materializeDiscoveryHit({
        hitId: "hit:missing",
        verifiedPosting: posting(),
        discoveryHitStore: stores.discoveryHits,
        jobStore: stores.jobs,
        now: "2026-09-14T01:00:00Z",
      }),
      /discovery hit not found/,
    );

    await stores.discoveryHits.put("hit:web-1", hit());
    await assert.rejects(
      materializeDiscoveryHit({
        hitId: "hit:web-1",
        verifiedPosting: posting({ sourceUrl: "file:///tmp/job.html" }),
        discoveryHitStore: stores.discoveryHits,
        jobStore: stores.jobs,
        now: "2026-09-14T01:00:00Z",
      }),
      /sourceUrl must use http or https/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

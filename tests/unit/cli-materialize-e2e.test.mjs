import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseCommand } from "../../dist/cli/index.js";
import { executeCommand } from "../../dist/cli/runtime.js";
import { initializeWorkspace } from "../../dist/workspace/workspace.js";

function profile() {
  return {
    profileId: "cli-e2e-candidate",
    version: "v1",
    updatedAt: "2026-09-14T00:00:00Z",
    targetRoles: ["Backend Developer"],
    targetLevels: ["Entry", "Junior"],
    skills: [
      { name: "Node.js", evidenceIds: ["candidate:node"] },
      { name: "TypeScript", evidenceIds: ["candidate:typescript"] },
      { name: "PostgreSQL", evidenceIds: ["candidate:postgres"] },
    ],
    locations: ["Seoul"],
    mustHaves: [],
    dealBreakers: [],
    documentRefs: [],
  };
}

function discoveryHit() {
  return {
    hitId: "hit:cli-web-1",
    sourceId: "web-search:cli-fixture",
    sourceRef: {
      sourceId: "web-search:cli-fixture",
      url: "https://search.example/jobs/backend",
      canonicalUrl: "https://search.example/jobs/backend",
    },
    queryKey: "query:cli-e2e",
    title: "Backend Developer",
    company: "CLI Example Labs",
    location: "Seoul",
    snippet: "Search snippet that must not be ranked before materialization.",
    status: "DISCOVERED",
    discoveredAt: "2026-09-14T00:00:00Z",
    lastSeenAt: "2026-09-14T00:00:00Z",
  };
}

function verifiedPosting() {
  return {
    sourceUrl: "https://careers.example.com/backend?utm_source=search",
    company: "CLI Example Labs",
    title: "Backend Developer",
    fullText: "CLI Example Labs is hiring an entry backend developer to build Node.js and TypeScript REST APIs backed by PostgreSQL.",
    contentCompleteness: "full",
    locations: ["Seoul"],
    requiredSkills: ["Node.js", "TypeScript", "PostgreSQL"],
    preferredSkills: [],
    responsibilities: ["Build REST APIs"],
    status: "open",
  };
}

test("CLI materialize promotes a durable hit and rank creates an opportunity", async () => {
  const root = await mkdtemp(join(tmpdir(), "joblens-cli-e2e-"));
  try {
    const env = { JOBLENS_WORKSPACE: root };
    const profilePath = join(root, "candidate-input.json");
    const postingPath = join(root, "verified-posting.json");
    await writeFile(profilePath, `${JSON.stringify(profile(), null, 2)}\n`, "utf8");
    await writeFile(postingPath, `${JSON.stringify(verifiedPosting(), null, 2)}\n`, "utf8");

    const parsed = parseCommand(["materialize", "hit:cli-web-1", "--input", postingPath]);
    assert.equal(parsed.command, "materialize");

    await executeCommand("setup", ["--profile", profilePath], env);
    const stores = await initializeWorkspace(root);
    await stores.discoveryHits.put("hit:cli-web-1", discoveryHit());

    assert.equal((await stores.jobs.list()).length, 0, "search hit must not be rankable before materialization");
    const materialized = await executeCommand("materialize", ["hit:cli-web-1", "--input", postingPath], env);
    assert.match(materialized, /MATERIALIZED/);
    assert.match(materialized, /idempotent: false/);
    assert.equal((await stores.jobs.list()).length, 1);

    const ranked = await executeCommand("rank", [], env);
    assert.match(ranked, /CLI Example Labs — Backend Developer/);
    assert.match(ranked, /opportunities: 1 created/);
    assert.equal((await stores.opportunities.list()).length, 1);

    const second = await executeCommand("materialize", ["hit:cli-web-1", "--input", postingPath], env);
    assert.match(second, /idempotent: true/);
    assert.equal((await stores.jobs.list()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("executeCommand dispatches outcome instead of treating it as an unimplemented command", async () => {
  const root = await mkdtemp(join(tmpdir(), "joblens-cli-outcome-"));
  try {
    const env = { JOBLENS_WORKSPACE: root };
    const stores = await initializeWorkspace(root);
    await stores.applications.put("application:cli-ready", {
      applicationId: "application:cli-ready",
      opportunityId: "opportunity:cli",
      jobId: "job:cli",
      candidateProfileVersion: "v1",
      state: "READY",
      reviewerStatus: "PASS",
      groundingBlockers: [],
      events: [],
    });

    const outcomePath = join(root, "outcome.json");
    await writeFile(outcomePath, `${JSON.stringify({
      event: {
        type: "WITHDRAW",
        occurredAt: "2026-09-14T03:00:00Z",
        reason: "test withdrawal",
      },
    }, null, 2)}\n`, "utf8");

    const output = await executeCommand("outcome", ["application:cli-ready", "--input", outcomePath], env);
    assert.match(output, /application: application:cli-ready -> WITHDRAWN/);
    assert.equal((await stores.applications.get("application:cli-ready")).state, "WITHDRAWN");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

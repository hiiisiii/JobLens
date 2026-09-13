import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JobLensToolService } from "../../dist/index.js";

function context(requestId) {
  return {
    requestId,
    workspaceId: "workspace-test",
    client: "other",
    actor: "user",
  };
}

function profile() {
  return {
    profileId: "candidate-test",
    version: "v1",
    updatedAt: "2026-09-14T00:00:00Z",
    targetRoles: ["Backend Developer"],
    targetLevels: ["Entry"],
    skills: [{ name: "Node.js", evidenceIds: ["candidate:node"] }],
    locations: ["Seoul"],
    mustHaves: [],
    dealBreakers: [],
    documentRefs: [],
  };
}

async function withWorkspace(run) {
  const root = await mkdtemp(join(tmpdir(), "joblens-tool-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("setup and profile_get use durable workspace state instead of chat memory", async () => {
  await withWorkspace(async (root) => {
    const service = new JobLensToolService(root, {});
    const setup = await service.invoke({ tool: "joblens_setup", input: { profile: profile() } }, context("req-setup"));
    assert.equal(setup.ok, true);

    const secondClient = new JobLensToolService(root, {});
    const result = await secondClient.invoke({ tool: "joblens_profile_get" }, context("req-read"));
    assert.equal(result.ok, true);
    assert.equal(result.data.profileId, "candidate-test");
    assert.equal(result.data.version, "v1");
  });
});

test("manual discovery can be invoked through the canonical tool service", async () => {
  await withWorkspace(async (root) => {
    const service = new JobLensToolService(root, {});
    await service.invoke({ tool: "joblens_setup", input: { profile: profile() } }, context("req-setup"));
    const discovered = await service.invoke({
      tool: "joblens_discover",
      input: {
        source: "manual",
        posting: {
          sourceId: "manual:test",
          url: "https://example.com/jobs/backend",
          companyName: "Example Co",
          title: "Backend Developer",
          locations: ["Seoul"],
          requiredSkills: ["Node.js"],
          preferredSkills: [],
          responsibilities: ["Build APIs"],
          status: "open",
          fullText: "Backend Developer Node.js Build APIs",
        },
      },
    }, context("req-discover"));
    assert.equal(discovered.ok, true);

    const jobs = await service.invoke({ tool: "joblens_jobs_list" }, context("req-jobs"));
    assert.equal(jobs.ok, true);
    assert.equal(jobs.data.length, 1);
    assert.equal(jobs.data[0].companyName, "Example Co");
  });
});

test("explicit-decision tool does not infer approval", async () => {
  await withWorkspace(async (root) => {
    const service = new JobLensToolService(root, {});
    const result = await service.invoke({
      tool: "joblens_prepare",
      input: { opportunityId: "opp-missing", userApproved: false, draft: { artifacts: [] } },
    }, context("req-prepare"));
    assert.equal(result.ok, false);
    assert.match(result.error.message, /explicit userApproved/);
  });
});

test("tool calls write metadata-only audit traces without raw tool payloads", async () => {
  await withWorkspace(async (root) => {
    const service = new JobLensToolService(root, {});
    await service.invoke({ tool: "joblens_setup", input: { profile: profile() } }, context("req-trace"));
    const traceDir = join(root, "logs", "tool-calls");
    const files = await readdir(traceDir);
    assert.equal(files.length, 1);
    const trace = JSON.parse(await readFile(join(traceDir, files[0]), "utf8"));
    assert.equal(trace.requestId, "req-trace");
    assert.equal(trace.tool, "joblens_setup");
    assert.equal(trace.approvalClass, "LOCAL_MUTATION");
    assert.equal(trace.ok, true);
    assert.equal(Object.hasOwn(trace, "input"), false);
    assert.equal(JSON.stringify(trace).includes("Node.js"), false);
  });
});

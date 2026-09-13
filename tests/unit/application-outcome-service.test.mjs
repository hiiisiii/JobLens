import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore, recordOutcome } from "../../dist/index.js";

function stores() {
  return { applications: new MemoryStore(), packages: new MemoryStore() };
}

function readyApplication() {
  return {
    applicationId: "application-1",
    opportunityId: "opp-1",
    jobId: "job-1",
    candidateProfileVersion: "v1",
    state: "READY",
    reviewerStatus: "PASS",
    groundingBlockers: [],
    events: [],
  };
}

function applicationPackage() {
  return {
    packageId: "package-1",
    applicationId: "application-1",
    opportunityId: "opp-1",
    jobId: "job-1",
    candidateProfileVersion: "v1",
    researchId: "research-1",
    preparedAt: "2026-09-14T00:00:00Z",
    artifacts: [{
      artifactId: "artifact-1",
      type: "resume",
      version: "v-hash",
      content: "resume",
      contentHash: "content-hash",
      claims: [],
    }],
    sourceSnapshot: {
      candidateProfile: {},
      job: {},
      research: {},
      allowedEvidenceIds: [],
      jobSnapshotEvidenceId: "job-snapshot:job-1",
      snapshotHash: "snapshot-hash",
    },
  };
}

async function seeded() {
  const value = stores();
  await value.applications.put("application-1", readyApplication());
  await value.packages.put("package-1", applicationPackage());
  return value;
}

test("APPLIED requires explicit user confirmation", async () => {
  const value = await seeded();
  await assert.rejects(() => recordOutcome({
    applicationId: "application-1",
    event: { type: "APPLIED", submittedAt: "2026-09-14T03:00:00Z", channel: "company careers", userConfirmed: false },
    applicationStore: value.applications,
    packageStore: value.packages,
    now: "2026-09-14T03:01:00Z",
  }), /explicit user confirmation/);
});

test("recording APPLIED freezes submitted artifact versions and hashes", async () => {
  const value = await seeded();
  const result = await recordOutcome({
    applicationId: "application-1",
    event: { type: "APPLIED", submittedAt: "2026-09-14T03:00:00Z", channel: "company careers", userConfirmed: true },
    applicationStore: value.applications,
    packageStore: value.packages,
    now: "2026-09-14T03:01:00Z",
  });
  assert.equal(result.state, "APPLIED");
  assert.equal(result.submissionSnapshot.candidateProfileVersion, "v1");
  assert.equal(result.submissionSnapshot.artifactVersions.resume, "v-hash");
  assert.equal(result.submissionSnapshot.artifactHashes.resume, "content-hash");
  assert.equal(result.submissionSnapshot.channel, "company careers");
});

test("same APPLIED event is idempotent", async () => {
  const value = await seeded();
  const event = { type: "APPLIED", submittedAt: "2026-09-14T03:00:00Z", channel: "company careers", userConfirmed: true };
  const first = await recordOutcome({ applicationId: "application-1", event, applicationStore: value.applications, packageStore: value.packages, now: "2026-09-14T03:01:00Z" });
  const count = first.events.length;
  const second = await recordOutcome({ applicationId: "application-1", event, applicationStore: value.applications, packageStore: value.packages, now: "2026-09-14T03:02:00Z" });
  assert.equal(second.events.length, count);
  assert.equal(second.state, "APPLIED");
});

test("interview remains event-based and complete records final outcome", async () => {
  const value = await seeded();
  await recordOutcome({
    applicationId: "application-1",
    event: { type: "APPLIED", submittedAt: "2026-09-14T03:00:00Z", channel: "company careers", userConfirmed: true },
    applicationStore: value.applications,
    packageStore: value.packages,
    now: "2026-09-14T03:01:00Z",
  });
  const interviewing = await recordOutcome({
    applicationId: "application-1",
    event: { type: "INTERVIEW", occurredAt: "2026-09-20T10:00:00Z", round: "technical" },
    applicationStore: value.applications,
    packageStore: value.packages,
    now: "2026-09-20T10:00:00Z",
  });
  assert.equal(interviewing.state, "INTERVIEWING");
  const completed = await recordOutcome({
    applicationId: "application-1",
    event: { type: "COMPLETE", outcome: "REJECTED", occurredAt: "2026-09-22T12:00:00Z" },
    applicationStore: value.applications,
    packageStore: value.packages,
    now: "2026-09-22T12:00:00Z",
  });
  assert.equal(completed.state, "COMPLETED");
  assert.equal(completed.outcome, "REJECTED");
});

test("READY application can be withdrawn without pretending it was submitted", async () => {
  const value = await seeded();
  const result = await recordOutcome({
    applicationId: "application-1",
    event: { type: "WITHDRAW", occurredAt: "2026-09-14T04:00:00Z", reason: "role no longer preferred" },
    applicationStore: value.applications,
    packageStore: value.packages,
    now: "2026-09-14T04:00:00Z",
  });
  assert.equal(result.state, "WITHDRAWN");
  assert.equal(result.outcome, "WITHDRAWN");
  assert.equal(result.submissionSnapshot, undefined);
});

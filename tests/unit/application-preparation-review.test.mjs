import assert from "node:assert/strict";
import test from "node:test";
import {
  MemoryStore,
  prepareApplication,
  reviewApplication,
} from "../../dist/index.js";

function fixture() {
  const profile = {
    profileId: "candidate",
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
  const job = {
    id: "job-1",
    companyName: "Example Co",
    title: "Backend Developer",
    locations: ["Seoul"],
    requiredSkills: ["Node.js"],
    preferredSkills: [],
    responsibilities: [],
    status: "open",
    fullText: "Build backend APIs",
    sourceRefs: [],
    contentCompleteness: "full",
    firstSeenAt: "2026-09-14T00:00:00Z",
    lastSeenAt: "2026-09-14T00:00:00Z",
  };
  const research = {
    researchId: "research-1",
    companyId: "company-1",
    jobId: "job-1",
    researchedAt: "2026-09-14T00:00:00Z",
    verifiedFacts: ["Official backend role"],
    analysis: [],
    communitySignals: [],
    opportunities: [],
    risks: [],
    evidenceIds: ["evidence:official"],
    unresolvedQuestions: [],
  };
  const opportunity = {
    opportunityId: "opp-1",
    jobId: "job-1",
    candidateProfileVersion: "v1",
    state: "REVIEWABLE",
    researchId: "research-1",
  };
  const stores = {
    opportunities: new MemoryStore(),
    jobs: new MemoryStore(),
    research: new MemoryStore(),
    applications: new MemoryStore(),
    packages: new MemoryStore(),
    reviews: new MemoryStore(),
  };
  return { profile, job, research, opportunity, stores };
}

async function seeded() {
  const value = fixture();
  await value.stores.opportunities.put(value.opportunity.opportunityId, value.opportunity);
  await value.stores.jobs.put(value.job.id, value.job);
  await value.stores.research.put(value.research.researchId, value.research);
  return value;
}

function draft(extraEvidence = []) {
  return {
    artifacts: [{
      type: "resume",
      content: "Node.js backend developer tailored to the selected role.",
      claims: [
        { claimId: "candidate-claim", text: "Candidate has Node.js experience.", evidenceIds: ["candidate:node"] },
        { claimId: "job-claim", text: "The selected role is a backend role.", evidenceIds: ["job-snapshot:job-1", ...extraEvidence] },
        { claimId: "company-claim", text: "Company context comes from official research.", evidenceIds: ["evidence:official"] },
      ],
    }],
  };
}

async function prepare(value, draftValue = draft()) {
  return prepareApplication({
    opportunityId: value.opportunity.opportunityId,
    userApproved: true,
    draft: draftValue,
    profile: value.profile,
    opportunityStore: value.stores.opportunities,
    jobStore: value.stores.jobs,
    researchStore: value.stores.research,
    applicationStore: value.stores.applications,
    packageStore: value.stores.packages,
    now: "2026-09-14T01:00:00Z",
  });
}

test("prepare requires explicit user approval", async () => {
  const value = await seeded();
  await assert.rejects(() => prepareApplication({
    opportunityId: "opp-1",
    userApproved: false,
    draft: draft(),
    profile: value.profile,
    opportunityStore: value.stores.opportunities,
    jobStore: value.stores.jobs,
    researchStore: value.stores.research,
    applicationStore: value.stores.applications,
    packageStore: value.stores.packages,
    now: "2026-09-14T01:00:00Z",
  }), /explicit user approval/);
});

test("prepare freezes candidate job and research sources and creates PREPARING application", async () => {
  const value = await seeded();
  const result = await prepare(value);
  assert.equal(result.application.state, "PREPARING");
  assert.equal(result.opportunity.state, "APPLY_APPROVED");
  assert.equal(result.package.sourceSnapshot.candidateProfile.version, "v1");
  assert.equal(result.package.sourceSnapshot.job.id, "job-1");
  assert.equal(result.package.sourceSnapshot.research.researchId, "research-1");
  assert.ok(result.package.sourceSnapshot.allowedEvidenceIds.includes("candidate:node"));
  assert.ok(result.package.sourceSnapshot.allowedEvidenceIds.includes("evidence:official"));
  assert.ok(result.package.sourceSnapshot.allowedEvidenceIds.includes("job-snapshot:job-1"));
});

test("prepare rejects claims outside the frozen evidence set", async () => {
  const value = await seeded();
  await assert.rejects(() => prepare(value, draft(["invented:evidence"])), /outside the frozen source set/);
});

test("review PASS plus clean grounding audit moves application to READY", async () => {
  const value = await seeded();
  const prepared = await prepare(value);
  const result = await reviewApplication({
    applicationId: prepared.application.applicationId,
    packageId: prepared.package.packageId,
    reviewInput: { status: "PASS", findings: [{ severity: "WARNING", category: "clarity", message: "Shorten one sentence" }] },
    applicationStore: value.stores.applications,
    packageStore: value.stores.packages,
    reviewStore: value.stores.reviews,
    now: "2026-09-14T02:00:00Z",
  });
  assert.equal(result.application.state, "READY");
  assert.equal(result.application.reviewerStatus, "PASS");
  assert.deepEqual(result.application.groundingBlockers, []);
  assert.equal(result.review.resultState, "READY");
});

test("review FAIL moves application to REVISION_REQUIRED", async () => {
  const value = await seeded();
  const prepared = await prepare(value);
  const result = await reviewApplication({
    applicationId: prepared.application.applicationId,
    packageId: prepared.package.packageId,
    reviewInput: { status: "FAIL", findings: [{ severity: "BLOCKER", category: "relevance", message: "Draft is not tailored enough" }] },
    applicationStore: value.stores.applications,
    packageStore: value.stores.packages,
    reviewStore: value.stores.reviews,
    now: "2026-09-14T02:00:00Z",
  });
  assert.equal(result.application.state, "REVISION_REQUIRED");
  assert.equal(result.review.resultState, "REVISION_REQUIRED");
});

test("grounding audit blocks a tampered package even when reviewer says PASS", async () => {
  const value = await seeded();
  const prepared = await prepare(value);
  const tampered = {
    ...prepared.package,
    artifacts: prepared.package.artifacts.map((artifact) => ({ ...artifact, content: `${artifact.content} unsupported mutation` })),
  };
  await value.stores.packages.put(tampered.packageId, tampered);
  const result = await reviewApplication({
    applicationId: prepared.application.applicationId,
    packageId: tampered.packageId,
    reviewInput: { status: "PASS" },
    applicationStore: value.stores.applications,
    packageStore: value.stores.packages,
    reviewStore: value.stores.reviews,
    now: "2026-09-14T02:00:00Z",
  });
  assert.equal(result.application.state, "REVISION_REQUIRED");
  assert.ok(result.review.groundingBlockers.some((value) => value.includes("content hash mismatch")));
});

import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore } from "../../dist/storage/memory-store.js";
import { persistResearch } from "../../dist/research/research-service.js";

function baseStores(state = "EVALUATED") {
  const opportunities = new MemoryStore();
  const jobs = new MemoryStore();
  const research = new MemoryStore();
  const evidence = new MemoryStore();
  return { opportunities, jobs, research, evidence, state };
}

async function seed(stores, state = stores.state) {
  await stores.jobs.put("job:1", {
    id: "job:1",
    sourceRefs: [{ sourceId: "manual", url: "https://example.com/job/1" }],
    companyName: "Example Labs",
    title: "Backend Developer",
    locations: ["Seoul"],
    requiredSkills: ["Node.js"],
    preferredSkills: [],
    status: "open",
    fullText: "Backend role",
    fingerprint: "fp",
    discoveredAt: "2026-09-14T00:00:00Z",
    updatedAt: "2026-09-14T00:00:00Z",
  });
  await stores.opportunities.put("opp:1", {
    opportunityId: "opp:1",
    jobId: "job:1",
    candidateProfileVersion: "v1",
    state,
    evaluationId: "eval:1",
  });
}

const validInput = {
  evidence: [
    {
      key: "official-about",
      claim: "Example Labs operates a developer platform.",
      evidenceType: "company_official_page",
      sourceUri: "https://example.com/about",
      sourceTitle: "About Example Labs",
      authority: "primary",
      confidence: "HIGH",
    },
    {
      key: "community",
      claim: "Engineers mention a small-team environment.",
      evidenceType: "community_review",
      sourceUri: "https://community.example/review",
      authority: "community",
      confidence: "LOW",
    },
  ],
  findings: [
    { kind: "verified_fact", text: "The company operates a developer platform.", evidenceKeys: ["official-about"] },
    { kind: "analysis", text: "The product domain is adjacent to backend API work.", evidenceKeys: ["official-about"] },
    { kind: "community_signal", text: "There are anecdotal signs of a small-team environment.", evidenceKeys: ["community"] },
    { kind: "opportunity", text: "The role may provide broad backend ownership.", evidenceKeys: ["official-about"] },
  ],
  unresolvedQuestions: ["What is the exact backend team size?"],
};

test("research persists evidence, research record, and moves evaluated opportunity to reviewable", async () => {
  const stores = baseStores();
  await seed(stores);
  const result = await persistResearch({
    opportunityId: "opp:1",
    researchInput: validInput,
    opportunityStore: stores.opportunities,
    jobStore: stores.jobs,
    researchStore: stores.research,
    evidenceStore: stores.evidence,
    now: "2026-09-14T00:05:00Z",
  });

  assert.equal(result.opportunity.state, "REVIEWABLE");
  assert.equal(result.research.verifiedFacts.length, 1);
  assert.equal(result.research.communitySignals.length, 1);
  assert.equal(result.research.unresolvedQuestions.length, 1);
  assert.equal((await stores.evidence.list()).length, 2);
  assert.equal((await stores.research.list()).length, 1);
});

test("research preserves HOLD as an explicit user decision", async () => {
  const stores = baseStores("HOLD");
  await seed(stores, "HOLD");
  const result = await persistResearch({
    opportunityId: "opp:1",
    researchInput: validInput,
    opportunityStore: stores.opportunities,
    jobStore: stores.jobs,
    researchStore: stores.research,
    evidenceStore: stores.evidence,
    now: "2026-09-14T00:05:00Z",
  });
  assert.equal(result.opportunity.state, "HOLD");
  assert.ok(result.opportunity.researchId);
});

test("research rejects unsupported claims without evidence", async () => {
  const stores = baseStores();
  await seed(stores);
  await assert.rejects(
    persistResearch({
      opportunityId: "opp:1",
      researchInput: {
        evidence: validInput.evidence,
        findings: [{ kind: "analysis", text: "Unsupported inference", evidenceKeys: [] }],
      },
      opportunityStore: stores.opportunities,
      jobStore: stores.jobs,
      researchStore: stores.research,
      evidenceStore: stores.evidence,
      now: "2026-09-14T00:05:00Z",
    }),
    /requires evidenceKeys/,
  );
});

test("community signals require community-authority evidence", async () => {
  const stores = baseStores();
  await seed(stores);
  await assert.rejects(
    persistResearch({
      opportunityId: "opp:1",
      researchInput: {
        evidence: [validInput.evidence[0]],
        findings: [{ kind: "community_signal", text: "Community says something", evidenceKeys: ["official-about"] }],
      },
      opportunityStore: stores.opportunities,
      jobStore: stores.jobs,
      researchStore: stores.research,
      evidenceStore: stores.evidence,
      now: "2026-09-14T00:05:00Z",
    }),
    /community-authority evidence/,
  );
});

test("excluded opportunities cannot be researched", async () => {
  const stores = baseStores("EXCLUDED");
  await seed(stores, "EXCLUDED");
  await assert.rejects(
    persistResearch({
      opportunityId: "opp:1",
      researchInput: validInput,
      opportunityStore: stores.opportunities,
      jobStore: stores.jobs,
      researchStore: stores.research,
      evidenceStore: stores.evidence,
      now: "2026-09-14T00:05:00Z",
    }),
    /cannot research opportunity in EXCLUDED state/,
  );
});

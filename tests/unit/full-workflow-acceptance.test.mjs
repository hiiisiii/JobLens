import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  initializeWorkspace,
  materializeDiscoveryHit,
  persistResearch,
  prepareApplication,
  rankAndPersistJobs,
  recordOutcome,
  reviewApplication,
} from "../../dist/index.js";

const capturedPostingUrl = "https://www.jobkorea.co.kr/Recruit/GI_Read/49858205";

function candidateProfile() {
  return {
    profileId: "acceptance-backend-candidate",
    version: "v2",
    updatedAt: "2026-09-14T00:00:00Z",
    targetRoles: ["Node.js Backend Developer", "TypeScript Backend Developer", "Server Developer"],
    targetLevels: ["Entry", "Junior"],
    skills: [
      { name: "Node.js", evidenceIds: ["resume:node"] },
      { name: "TypeScript", evidenceIds: ["resume:typescript"] },
      { name: "PostgreSQL", evidenceIds: ["resume:postgres"] },
      { name: "Prisma ORM", evidenceIds: ["resume:prisma"] },
      { name: "Git", evidenceIds: ["resume:git"] },
      { name: "AWS EC2", evidenceIds: ["resume:aws"] },
    ],
    experienceEvidence: [
      {
        experienceId: "project:api-workflows",
        title: "API workflow project",
        summary: "Implemented layered Node.js APIs with authorization, transactions, validation, tests, and relational data integrity.",
        capabilities: ["api-design", "authorization", "transaction", "data-integrity", "validation", "testing", "api-documentation"],
        technologies: ["Node.js", "TypeScript", "Express", "PostgreSQL", "Prisma ORM", "Jest", "OpenAPI"],
        evidenceIds: ["portfolio:api-project", "pr:api-project"],
      },
      {
        experienceId: "project:cloud-operations",
        title: "Cloud operations project",
        summary: "Operated a small service on AWS EC2 with CI automation and monitoring.",
        capabilities: ["cloud-operations", "ci-cd", "monitoring"],
        technologies: ["AWS EC2", "Ubuntu", "GitHub Actions"],
        evidenceIds: ["portfolio:ops-project"],
      },
    ],
    locations: ["Seoul"],
    mustHaves: [],
    dealBreakers: [],
    documentRefs: ["resume.pdf", "portfolio.pdf"],
  };
}

function discoveryHit() {
  return {
    hitId: "hit:acceptance-live-derived-20260914",
    sourceId: "web-search:acceptance",
    sourceRef: {
      sourceId: "web-search:acceptance",
      url: capturedPostingUrl,
      canonicalUrl: capturedPostingUrl,
    },
    queryKey: "query:seoul-node-backend-entry",
    title: "[리비바이오] 백엔드개발자 (Node.js)",
    company: "리비바이오",
    location: "서울",
    snippet: "Current Seoul Node.js backend opening captured for a deterministic acceptance fixture.",
    status: "DISCOVERED",
    discoveredAt: "2026-09-14T03:30:00Z",
    lastSeenAt: "2026-09-14T03:30:00Z",
  };
}

function verifiedPosting() {
  return {
    sourceUrl: capturedPostingUrl,
    company: "리비바이오",
    title: "[리비바이오] 백엔드개발자 (Node.js)",
    fullText: "Entry or junior Node.js backend role covering REST API development, service architecture improvements, and AWS cloud operations. The posting values RDB experience and backend framework experience, with NestJS, Docker, GraphQL, and database performance work as adjacent or preferred signals.",
    contentCompleteness: "full",
    locations: ["서울"],
    requiredSkills: ["Node.js", "PostgreSQL", "Git"],
    preferredSkills: ["AWS", "NestJS", "Docker", "GraphQL"],
    responsibilities: ["RESTful API development", "service architecture improvements", "cloud infrastructure operations"],
    experienceRequirement: { maxYears: 3, rawText: "신입 또는 백엔드 개발 경력 3년 이하" },
    postedAt: "2026-08-26T00:00:00+09:00",
    expiresAt: "2026-10-25T23:59:59+09:00",
    status: "open",
  };
}

test("v0.1 acceptance: verified discovery reaches READY and records explicit user submission", async () => {
  const root = await mkdtemp(join(tmpdir(), "joblens-full-acceptance-"));
  try {
    const stores = await initializeWorkspace(root);
    const profile = candidateProfile();
    const hit = discoveryHit();
    await stores.discoveryHits.put(hit.hitId, hit);

    const materialized = await materializeDiscoveryHit({
      hitId: hit.hitId,
      verifiedPosting: verifiedPosting(),
      discoveryHitStore: stores.discoveryHits,
      jobStore: stores.jobs,
      now: "2026-09-14T03:35:00Z",
    });
    assert.equal(materialized.hit.status, "MATERIALIZED");
    assert.equal(materialized.job.status, "open");
    assert.equal((await stores.jobs.list()).length, 1);

    const ranked = await rankAndPersistJobs({
      jobs: [materialized.job],
      profile,
      evaluationStore: stores.evaluations,
      opportunityStore: stores.opportunities,
      now: "2026-09-14T03:40:00Z",
    });
    assert.equal(ranked.ranked[0].assessment.policyVersion, "v0.4");
    assert.equal(ranked.ranked[0].assessment.hardGate, "PASS");
    assert.equal(typeof ranked.ranked[0].assessment.fitScore, "number");
    const relevantExperience = ranked.ranked[0].assessment.dimensions.find((item) => item.id === "relevantExperience");
    assert.equal(relevantExperience?.evidenceIds.includes("portfolio:api-project"), true);
    assert.equal(relevantExperience?.evidenceIds.includes("portfolio:ops-project"), true);

    const opportunity = ranked.opportunities[0];
    const researched = await persistResearch({
      opportunityId: opportunity.opportunityId,
      researchInput: {
        evidence: [{
          key: "current-job-board",
          claim: "A current job-board listing shows this Seoul Node.js backend opening as active with an October 2026 closing date.",
          evidenceType: "job_board_posting",
          sourceUri: capturedPostingUrl,
          sourceTitle: "Current Node.js backend opening",
          authority: "secondary",
          confidence: "HIGH",
          subject: "job",
        }],
        findings: [
          { kind: "verified_fact", text: "The role is an active Seoul Node.js backend opening.", evidenceKeys: ["current-job-board"] },
          { kind: "analysis", text: "The role combines backend API work with architecture and cloud-operation responsibilities.", evidenceKeys: ["current-job-board"] },
        ],
        unresolvedQuestions: ["How much production ownership is expected from an entry-level hire?"],
      },
      opportunityStore: stores.opportunities,
      jobStore: stores.jobs,
      researchStore: stores.research,
      evidenceStore: stores.evidence,
      now: "2026-09-14T03:45:00Z",
    });
    assert.equal(researched.opportunity.state, "REVIEWABLE");

    const researchEvidenceId = researched.research.evidenceIds[0];
    const prepared = await prepareApplication({
      opportunityId: opportunity.opportunityId,
      userApproved: true,
      draft: {
        artifacts: [{
          type: "resume",
          content: "Early-career Node.js backend developer with grounded API, relational-data, transaction, testing, and scoped cloud-operations experience.",
          claims: [
            {
              claimId: "experience-claim",
              text: "The candidate implemented transaction-backed Node.js API workflows in a project.",
              evidenceIds: ["portfolio:api-project"],
            },
            {
              claimId: "job-claim",
              text: "The selected role includes Node.js backend API responsibilities.",
              evidenceIds: [`job-snapshot:${materialized.job.id}`],
            },
            {
              claimId: "research-claim",
              text: "The captured listing was active when the acceptance fixture was recorded.",
              evidenceIds: [researchEvidenceId],
            },
          ],
        }],
      },
      profile,
      opportunityStore: stores.opportunities,
      jobStore: stores.jobs,
      researchStore: stores.research,
      applicationStore: stores.applications,
      packageStore: stores.packages,
      now: "2026-09-14T03:50:00Z",
    });
    assert.equal(prepared.application.state, "PREPARING");
    assert.equal(prepared.package.sourceSnapshot.allowedEvidenceIds.includes("portfolio:api-project"), true);

    const reviewed = await reviewApplication({
      applicationId: prepared.application.applicationId,
      packageId: prepared.package.packageId,
      reviewInput: {
        status: "PASS",
        findings: [{ severity: "WARNING", category: "relevance", message: "Do not imply NestJS or Docker project experience unless separately evidenced." }],
      },
      applicationStore: stores.applications,
      packageStore: stores.packages,
      reviewStore: stores.reviews,
      now: "2026-09-14T03:55:00Z",
    });
    assert.equal(reviewed.application.state, "READY");
    assert.deepEqual(reviewed.application.groundingBlockers, []);

    const applied = await recordOutcome({
      applicationId: reviewed.application.applicationId,
      event: {
        type: "APPLIED",
        submittedAt: "2026-09-14T04:00:00Z",
        channel: "acceptance-fixture",
        userConfirmed: true,
        packageId: prepared.package.packageId,
      },
      applicationStore: stores.applications,
      packageStore: stores.packages,
      now: "2026-09-14T04:00:00Z",
    });
    assert.equal(applied.state, "APPLIED");
    assert.equal(applied.submissionSnapshot?.candidateProfileVersion, "v2");
    assert.equal(applied.submissionSnapshot?.channel, "acceptance-fixture");

    assert.equal((await stores.discoveryHits.list()).length, 1);
    assert.equal((await stores.evaluations.list()).length, 1);
    assert.equal((await stores.opportunities.list()).length, 1);
    assert.equal((await stores.research.list()).length, 1);
    assert.equal((await stores.applications.list()).length, 1);
    assert.equal((await stores.packages.list()).length, 1);
    assert.equal((await stores.reviews.list()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

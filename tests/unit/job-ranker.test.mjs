import assert from "node:assert/strict";
import test from "node:test";
import { rankJob, rankJobs } from "../../dist/ranking/job-ranker.js";

const profile = {
  profileId: "candidate-1",
  version: "v1",
  updatedAt: "2026-09-14T00:00:00.000Z",
  targetRoles: ["TypeScript Backend Developer", "Node.js Backend Developer"],
  targetLevels: ["Entry", "Junior"],
  skills: [
    { name: "Node.js", evidenceIds: ["resume"] },
    { name: "TypeScript", evidenceIds: ["resume"] },
    { name: "PostgreSQL", evidenceIds: ["resume"] },
  ],
  locations: ["Seoul"],
  mustHaves: [],
  dealBreakers: [],
  documentRefs: ["resume.pdf"],
};

function job(overrides = {}) {
  return {
    id: "job:1",
    sourceRefs: [{ sourceId: "manual", url: "https://example.com/jobs/1" }],
    companyName: "Example",
    title: "TypeScript Backend Developer",
    locations: ["Seoul"],
    requiredSkills: ["Node.js", "TypeScript", "PostgreSQL"],
    preferredSkills: [],
    status: "open",
    contentCompleteness: "full",
    fullText: "Build backend APIs with Node.js, TypeScript and PostgreSQL.",
    fingerprint: "fp:1",
    discoveredAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
    ...overrides,
  };
}

function dimension(result, id) {
  return result.assessment.dimensions.find((item) => item.id === id);
}

test("matching early-career backend role can pass with a high fit score", () => {
  const result = rankJob(job(), profile);
  assert.equal(result.assessment.hardGate, "PASS");
  assert.equal((result.assessment.fitScore ?? 0) >= 80, true);
  assert.equal(result.assessment.confidence, "HIGH");
});

test("five-year minimum requirement fails the hard gate for an early-career target", () => {
  const result = rankJob(job({ experienceRequirement: { minYears: 5, rawText: "5+ years" } }), profile);
  assert.equal(result.assessment.hardGate, "FAIL");
  assert.equal(result.assessment.fitScore, undefined);
});

test("three-year minimum requirement is flagged rather than silently ranked as a normal junior role", () => {
  const result = rankJob(job({ experienceRequirement: { minYears: 3, rawText: "3+ years" } }), profile);
  assert.equal(result.assessment.hardGate, "FLAG");
  assert.equal(typeof result.assessment.fitScore, "number");
});

test("explicit senior title fails and sorts below viable jobs", () => {
  const viable = job({ id: "job:viable" });
  const senior = job({ id: "job:senior", title: "Senior TypeScript Backend Developer" });
  const ranked = rankJobs([senior, viable], profile);
  assert.equal(ranked[0].job.id, "job:viable");
  assert.equal(ranked[1].assessment.hardGate, "FAIL");
});

test("Korean new-grad server title and Seoul location align with English backend targets", () => {
  const result = rankJob(job({
    title: "[Platform] 서버 개발자 (신입)",
    locations: ["서울"],
    requiredSkills: ["NodeJS", "TypeScript", "Postgres"],
    fullText: "신입 서버 개발자로 NodeJS, TypeScript, Postgres 기반 API를 개발합니다.",
  }), profile);
  assert.equal(result.assessment.hardGate, "PASS");
  assert.equal((dimension(result, "roleAndLevel")?.score ?? 0) >= 90, true);
  assert.equal((dimension(result, "careerAlignment")?.score ?? 0) >= 90, true);
  assert.equal((result.assessment.fitScore ?? 0) >= 85, true);
});

test("generic SQL evidence does not satisfy a specific MySQL requirement", () => {
  const sqlOnlyProfile = {
    ...profile,
    skills: [{ name: "SQL", evidenceIds: ["resume"] }],
  };
  const result = rankJob(job({ requiredSkills: ["MySQL"] }), sqlOnlyProfile);
  assert.equal(dimension(result, "requiredSkills")?.score, 0);
});

test("specific PostgreSQL evidence can satisfy a generic SQL requirement", () => {
  const result = rankJob(job({ requiredSkills: ["SQL"] }), profile);
  assert.equal(dimension(result, "requiredSkills")?.score, 100);
});

test("missing preferred skills do not create a free adjacency score", () => {
  const result = rankJob(job({ requiredSkills: ["NestJS"], preferredSkills: [] }), profile);
  assert.equal(dimension(result, "requiredSkills")?.score, 0);
  assert.equal(dimension(result, "adjacencyAndLearning")?.score, 0);
});

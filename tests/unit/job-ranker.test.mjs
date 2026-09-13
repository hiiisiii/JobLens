import assert from "node:assert/strict";
import test from "node:test";
import { rankJob, rankJobs } from "../../dist/ranking/job-ranker.js";
import { detectJobCapabilitySignals } from "../../dist/ranking/experience-matching.js";

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

const profileWithExperience = {
  ...profile,
  version: "v2",
  experienceEvidence: [
    {
      experienceId: "project:authorization-api",
      title: "Authorization and state backend project",
      summary: "Implemented member authorization, invitation state transitions, transaction boundaries, and REST APIs.",
      capabilities: ["api-design", "authorization", "state-management", "transaction", "data-modeling"],
      technologies: ["Node.js", "TypeScript", "Express", "PostgreSQL", "Prisma"],
      evidenceIds: ["portfolio:project-a", "pr:33"],
    },
    {
      experienceId: "project:data-integrity",
      title: "Data integrity and validation backend project",
      summary: "Implemented relational data workflows, validation, tests, and API documentation.",
      capabilities: ["api-design", "data-integrity", "validation", "testing", "api-documentation", "integration-debugging", "data-modeling"],
      technologies: ["Node.js", "TypeScript", "Express", "PostgreSQL", "Prisma", "Jest", "OpenAPI"],
      evidenceIds: ["portfolio:project-b", "pr:30"],
    },
  ],
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
    fullText: "Build backend REST APIs with Node.js, TypeScript and PostgreSQL.",
    fingerprint: "fp:1",
    discoveredAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
    ...overrides,
  };
}

function dimension(result, id) {
  return result.assessment.dimensions.find((item) => item.id === id);
}

test("legacy profile keeps fit scoring but downgrades confidence when structured experience is absent", () => {
  const result = rankJob(job(), profile);
  assert.equal(result.assessment.hardGate, "PASS");
  assert.equal((result.assessment.fitScore ?? 0) >= 80, true);
  assert.equal(result.assessment.confidence, "MEDIUM");
  assert.match(dimension(result, "relevantExperience")?.rationale ?? "", /legacy fallback/);
});

test("structured experience evidence raises relevant-experience confidence and carries evidence ids", () => {
  const result = rankJob(job({
    fullText: "Design REST APIs, enforce authorization, handle transaction boundaries, validate requests, and maintain integration tests with Node.js, TypeScript and PostgreSQL.",
  }), profileWithExperience);
  const relevant = dimension(result, "relevantExperience");
  assert.equal(result.assessment.policyVersion, "v0.4");
  assert.equal((relevant?.score ?? 0) >= 90, true);
  assert.equal(relevant?.evidenceConfidence, "HIGH");
  assert.equal(relevant?.evidenceIds.includes("portfolio:project-a"), true);
  assert.equal(relevant?.evidenceIds.includes("portfolio:project-b"), true);
  assert.match(relevant?.rationale ?? "", /structured experience evidence/);
});

test("structured relevant experience distinguishes actual project evidence from profile skill inventory", () => {
  const skillOnlyProfile = {
    ...profileWithExperience,
    skills: [...profileWithExperience.skills, { name: "Redis", evidenceIds: ["course"] }],
    experienceEvidence: profileWithExperience.experienceEvidence.map((item) => ({ ...item, technologies: item.technologies.filter((technology) => technology !== "Redis") })),
  };
  const result = rankJob(job({
    requiredSkills: ["Redis"],
    fullText: "Operate Redis-backed services and production monitoring with incident troubleshooting.",
  }), skillOnlyProfile);
  assert.equal(dimension(result, "requiredSkills")?.score, 100);
  assert.equal((dimension(result, "relevantExperience")?.score ?? 100) < 60, true);
});

test("technology-only structured evidence is shrunk instead of becoming 100 relevant experience", () => {
  const result = rankJob(job({
    fullText: "Node.js TypeScript PostgreSQL",
  }), profileWithExperience);
  const relevant = dimension(result, "relevantExperience");
  assert.equal(relevant?.score, 75);
  assert.equal(relevant?.evidenceConfidence, "MEDIUM");
  assert.match(relevant?.rationale ?? "", /conservatively shrunk toward neutral/);
});

test("live Korea JD wording surfaces unsupported incident architecture and performance responsibilities", () => {
  const liveStyle = job({
    title: "백엔드 개발자 (신입/경력)",
    experienceRequirement: { minYears: 2, rawText: "프로젝트 또는 실무 경력 2년 이상 또는 동등 수준" },
    fullText: "Node.js 기반 백엔드 API 서버 개발. 서비스 성능 개선, 서버 인프라 운영, 장애 대응 및 문제 해결, 시스템 아키텍처 설계.",
  });
  const signals = detectJobCapabilitySignals(liveStyle);
  assert.equal(signals.includes("api-design"), true);
  assert.equal(signals.includes("performance-optimization"), true);
  assert.equal(signals.includes("incident-response"), true);
  assert.equal(signals.includes("system-architecture"), true);

  const result = rankJob(liveStyle, profileWithExperience);
  assert.equal(result.assessment.hardGate, "PASS");
  assert.equal((dimension(result, "relevantExperience")?.score ?? 100) < 70, true);
});

test("live AI backend wording detects data modeling migration performance and LLM integration separately", () => {
  const liveStyle = job({
    title: "[AX] [인턴] 백엔드 개발자",
    experienceRequirement: { minYears: 0, rawText: "인턴 신입" },
    fullText: "Node.js TypeScript 기반 백엔드. PostgreSQL 데이터 모델링과 성능 최적화, 마이그레이션 정책을 수립하고 LLM API, RAG, 함수 호출, 에이전트 워크플로우를 구현합니다.",
  });
  const signals = detectJobCapabilitySignals(liveStyle);
  assert.equal(signals.includes("data-modeling"), true);
  assert.equal(signals.includes("performance-optimization"), true);
  assert.equal(signals.includes("database-migration"), true);
  assert.equal(signals.includes("llm-integration"), true);
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
    fullText: "신입 서버 개발자로 NodeJS, TypeScript, Postgres 기반 REST API를 개발합니다.",
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

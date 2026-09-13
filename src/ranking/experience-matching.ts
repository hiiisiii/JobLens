import type { CandidateProfile, ExperienceEvidence } from "../core/domain/candidate-profile.js";
import type { JobPosting } from "../core/domain/job-posting.js";
import type { Confidence } from "../core/domain/common.js";
import { normalizeMatchText, skillCoverage, skillMatchesRequirement } from "./matching.js";

interface CapabilityGroup {
  id: string;
  terms: readonly string[];
}

const CAPABILITY_GROUPS: readonly CapabilityGroup[] = [
  { id: "api-design", terms: ["rest api", "restful api", "api design", "api development", "api 설계", "api 개발", "crud api"] },
  { id: "authorization", terms: ["authorization", "authentication", "access control", "rbac", "jwt", "passport", "권한", "인증", "인가"] },
  { id: "transaction", terms: ["transaction", "atomicity", "atomic change", "트랜잭션", "원자성"] },
  { id: "data-integrity", terms: ["data integrity", "data consistency", "referential integrity", "foreign key", "데이터 무결성", "데이터 정합성", "외래 키", "관계 데이터"] },
  { id: "state-management", terms: ["state transition", "workflow state", "state machine", "상태 전이", "상태 관리", "상태값"] },
  { id: "validation", terms: ["input validation", "request validation", "dto validation", "validation", "유효성 검증", "입력 검증"] },
  { id: "testing", terms: ["unit test", "integration test", "api test", "testing", "jest", "단위 테스트", "통합 테스트", "테스트 자동화"] },
  { id: "api-documentation", terms: ["swagger", "openapi", "api documentation", "api docs", "api 문서", "문서화"] },
  { id: "ci-cd", terms: ["ci/cd", "continuous integration", "continuous deployment", "github actions", "gitlab ci", "jenkins", "배포 자동화"] },
  { id: "cloud-operations", terms: ["aws", "ec2", "cloud operations", "server operations", "production operations", "linux 운영", "서버 운영", "클라우드 운영"] },
  { id: "monitoring", terms: ["monitoring", "observability", "alerting", "metrics", "모니터링", "알림", "운영 로그"] },
  { id: "file-processing", terms: ["csv", "file upload", "file download", "bulk import", "파일 업로드", "파일 다운로드", "일괄 등록"] },
  { id: "integration-debugging", terms: ["integration debugging", "troubleshooting", "root cause", "debugging", "연동 오류", "원인 분석", "장애 분석"] },
];

const CAPABILITY_ALIASES: Readonly<Record<string, string>> = {
  "rest-api": "api-design",
  "api-development": "api-design",
  "access-control": "authorization",
  auth: "authorization",
  authentication: "authorization",
  authorization: "authorization",
  transactions: "transaction",
  atomicity: "transaction",
  "relational-integrity": "data-integrity",
  "database-integrity": "data-integrity",
  "state-transition": "state-management",
  "input-validation": "validation",
  "unit-testing": "testing",
  "integration-testing": "testing",
  swagger: "api-documentation",
  openapi: "api-documentation",
  cicd: "ci-cd",
  "ci-cd": "ci-cd",
  deployment: "cloud-operations",
  operations: "cloud-operations",
  observability: "monitoring",
  debugging: "integration-debugging",
};

function canonicalCapability(value: string): string {
  const normalized = normalizeMatchText(value).replace(/\s+/g, "-");
  return CAPABILITY_ALIASES[normalized] ?? normalized;
}

function containsTerm(text: string, term: string): boolean {
  return normalizeMatchText(text).includes(normalizeMatchText(term));
}

export function detectJobCapabilitySignals(job: JobPosting): string[] {
  const text = `${job.title}\n${job.fullText}`;
  return CAPABILITY_GROUPS
    .filter((group) => group.terms.some((term) => containsTerm(text, term)))
    .map((group) => group.id);
}

function experienceSupportsCapability(experience: ExperienceEvidence, capability: string): boolean {
  return experience.capabilities.some((candidate) => canonicalCapability(candidate) === capability);
}

function experienceSupportsRequiredSkill(experience: ExperienceEvidence, requiredSkill: string): boolean {
  return experience.technologies.some((technology) => skillMatchesRequirement(requiredSkill, technology));
}

export interface RelevantExperienceMatch {
  score: number;
  confidence: Confidence;
  evidenceIds: string[];
  matchedCapabilities: string[];
  requiredCapabilities: string[];
  rationale: string;
}

export function matchRelevantExperience(job: JobPosting, profile: CandidateProfile, legacyRequiredSkillScore: number): RelevantExperienceMatch {
  const experiences = profile.experienceEvidence ?? [];
  if (experiences.length === 0) {
    return {
      score: legacyRequiredSkillScore,
      confidence: "LOW",
      evidenceIds: [],
      matchedCapabilities: [],
      requiredCapabilities: [],
      rationale: "legacy fallback: no structured experienceEvidence is available, so required-skill coverage is used as a low-confidence proxy",
    };
  }

  const requiredCapabilities = detectJobCapabilitySignals(job);
  const matchedCapabilities = requiredCapabilities.filter((capability) =>
    experiences.some((experience) => experienceSupportsCapability(experience, capability)),
  );
  const capabilityScore = requiredCapabilities.length === 0
    ? undefined
    : Math.round((matchedCapabilities.length / requiredCapabilities.length) * 100);

  const experiencedTechnologies = experiences.flatMap((experience) => experience.technologies);
  const technologyScore = job.requiredSkills.length === 0
    ? undefined
    : skillCoverage(job.requiredSkills, experiencedTechnologies);

  const score = capabilityScore !== undefined && technologyScore !== undefined
    ? Math.round((capabilityScore * 0.6) + (technologyScore * 0.4))
    : capabilityScore ?? technologyScore ?? 50;

  const contributingExperiences = experiences.filter((experience) =>
    matchedCapabilities.some((capability) => experienceSupportsCapability(experience, capability))
      || job.requiredSkills.some((requiredSkill) => experienceSupportsRequiredSkill(experience, requiredSkill)),
  );
  const evidenceIds = [...new Set(contributingExperiences.flatMap((experience) => experience.evidenceIds))];
  const matchedExperienceCount = contributingExperiences.length;
  const confidence: Confidence = matchedExperienceCount >= 2 ? "HIGH" : matchedExperienceCount === 1 ? "MEDIUM" : "LOW";

  const capabilityText = requiredCapabilities.length === 0
    ? "no explicit capability signals detected"
    : `${matchedCapabilities.length}/${requiredCapabilities.length} capability signals matched`;
  const technologyText = technologyScore === undefined
    ? "no structured required-skill comparison"
    : `${technologyScore}/100 experienced-technology coverage`;

  return {
    score,
    confidence,
    evidenceIds,
    matchedCapabilities,
    requiredCapabilities,
    rationale: `structured experience evidence: ${capabilityText}; ${technologyText}`,
  };
}

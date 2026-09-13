import type { CandidateProfile } from "../core/domain/candidate-profile.js";
import type { JobPosting } from "../core/domain/job-posting.js";
import type { Confidence, HardGateResult } from "../core/domain/common.js";
import { DEFAULT_FIT_WEIGHTS, DEFAULT_RANKING_POLICY_VERSION } from "./default-policy.js";
import { evaluateFit, type FitAssessmentResult, type FitDimensionInput, type HardGateCheck } from "./scoring-engine.js";

function key(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}+#.]+/gu, " ").trim();
}

function overlap(required: string[], candidate: string[]): number {
  if (required.length === 0) return 100;
  const candidateKeys = candidate.map(key);
  const matched = required.filter((item) => candidateKeys.some((skill) => skill.includes(key(item)) || key(item).includes(skill))).length;
  return Math.round((matched / required.length) * 100);
}

function confidenceForJob(job: JobPosting): Confidence {
  if (job.contentCompleteness === "full" && job.requiredSkills.length > 0) return "HIGH";
  if (job.fullText.trim().length > 0) return "MEDIUM";
  return "LOW";
}

function hardGates(job: JobPosting, profile: CandidateProfile): HardGateCheck[] {
  const checks: HardGateCheck[] = [];
  if (job.status === "closed") checks.push({ id: "posting-open", result: "FAIL", reason: "posting is closed", evidenceIds: [] });
  else checks.push({ id: "posting-open", result: job.status === "unknown" ? "FLAG" : "PASS", reason: job.status === "unknown" ? "posting status is unknown" : "posting is open", evidenceIds: [] });

  const locationText = job.locations.map(key).join(" ");
  for (const dealBreaker of profile.dealBreakers) {
    const normalized = key(dealBreaker);
    if (normalized && (locationText.includes(normalized) || key(job.fullText).includes(normalized))) {
      checks.push({ id: `deal-breaker:${normalized}`, result: "FAIL", reason: `candidate deal-breaker matched: ${dealBreaker}`, evidenceIds: [] });
    }
  }
  return checks;
}

function roleScore(job: JobPosting, profile: CandidateProfile): number {
  const title = key(job.title);
  if (profile.targetRoles.some((role) => title.includes(key(role)) || key(role).includes(title))) return 100;
  if (profile.targetRoles.some((role) => key(role).split(" ").some((token) => token.length > 2 && title.includes(token)))) return 75;
  return 35;
}

function dimensions(job: JobPosting, profile: CandidateProfile): FitDimensionInput[] {
  const evidenceConfidence = confidenceForJob(job);
  const skills = profile.skills.map((skill) => skill.name);
  const requiredScore = overlap(job.requiredSkills, skills);
  const preferredScore = overlap(job.preferredSkills, skills);
  const locationScore = profile.locations.length === 0 || job.locations.length === 0
    ? 70
    : job.locations.some((location) => profile.locations.some((preferred) => key(location).includes(key(preferred)) || key(preferred).includes(key(location)))) ? 100 : 50;

  return [
    { id: "roleAndLevel", label: "Role and level", weight: DEFAULT_FIT_WEIGHTS.roleAndLevel, score: roleScore(job, profile), evidenceConfidence, evidenceIds: [] },
    { id: "requiredSkills", label: "Required skills", weight: DEFAULT_FIT_WEIGHTS.requiredSkills, score: requiredScore, evidenceConfidence, evidenceIds: [] },
    { id: "relevantExperience", label: "Relevant experience", weight: DEFAULT_FIT_WEIGHTS.relevantExperience, score: requiredScore, evidenceConfidence: "MEDIUM", evidenceIds: [], rationale: "v0.1 proxy: required-skill evidence; structured experience matching follows" },
    { id: "evidenceStrength", label: "Evidence strength", weight: DEFAULT_FIT_WEIGHTS.evidenceStrength, score: evidenceConfidence === "HIGH" ? 100 : evidenceConfidence === "MEDIUM" ? 70 : 35, evidenceConfidence, evidenceIds: [] },
    { id: "careerAlignment", label: "Career alignment", weight: DEFAULT_FIT_WEIGHTS.careerAlignment, score: Math.round((roleScore(job, profile) + locationScore) / 2), evidenceConfidence: "MEDIUM", evidenceIds: [] },
    { id: "adjacencyAndLearning", label: "Adjacency and learning", weight: DEFAULT_FIT_WEIGHTS.adjacencyAndLearning, score: Math.max(requiredScore, preferredScore), evidenceConfidence: "MEDIUM", evidenceIds: [] },
  ];
}

export interface RankedJob {
  job: JobPosting;
  assessment: FitAssessmentResult;
}

export function rankJob(job: JobPosting, profile: CandidateProfile): RankedJob {
  return { job, assessment: evaluateFit({ policyVersion: DEFAULT_RANKING_POLICY_VERSION, hardGates: hardGates(job, profile), dimensions: dimensions(job, profile) }) };
}

export function rankJobs(jobs: JobPosting[], profile: CandidateProfile): RankedJob[] {
  return jobs.map((job) => rankJob(job, profile)).sort((left, right) => {
    const gateOrder: Record<HardGateResult, number> = { PASS: 0, FLAG: 1, FAIL: 2 };
    return gateOrder[left.assessment.hardGate] - gateOrder[right.assessment.hardGate] || (right.assessment.fitScore ?? -1) - (left.assessment.fitScore ?? -1);
  });
}

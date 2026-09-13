import type { CandidateProfile } from "../core/domain/candidate-profile.js";
import type { JobPosting } from "../core/domain/job-posting.js";
import type { Confidence, HardGateResult } from "../core/domain/common.js";
import { DEFAULT_FIT_WEIGHTS, DEFAULT_RANKING_POLICY_VERSION } from "./default-policy.js";
import { matchRelevantExperience } from "./experience-matching.js";
import {
  locationMatchScore,
  normalizeMatchText,
  roleMatchScore,
  skillCoverage,
} from "./matching.js";
import { evaluateFit, type FitAssessmentResult, type FitDimensionInput, type HardGateCheck } from "./scoring-engine.js";

function confidenceForJob(job: JobPosting): Confidence {
  if (job.contentCompleteness === "full" && job.requiredSkills.length > 0) return "HIGH";
  if (job.fullText.trim().length > 0) return "MEDIUM";
  return "LOW";
}

function targetsEarlyCareer(profile: CandidateProfile): boolean {
  const levels = profile.targetLevels.map(normalizeMatchText);
  return levels.some((level) => ["entry", "junior", "intern", "new grad", "신입", "주니어", "인턴"].includes(level));
}

function hardGates(job: JobPosting, profile: CandidateProfile): HardGateCheck[] {
  const checks: HardGateCheck[] = [];
  if (job.status === "closed") checks.push({ id: "posting-open", result: "FAIL", reason: "posting is closed", evidenceIds: [] });
  else checks.push({ id: "posting-open", result: job.status === "unknown" ? "FLAG" : "PASS", reason: job.status === "unknown" ? "posting status is unknown" : "posting is open", evidenceIds: [] });

  const earlyCareer = targetsEarlyCareer(profile);
  if (earlyCareer && job.experienceRequirement?.minYears !== undefined) {
    if (job.experienceRequirement.minYears >= 5) {
      checks.push({ id: "experience-requirement", result: "FAIL", reason: `role requires at least ${job.experienceRequirement.minYears} years of experience`, evidenceIds: [] });
    } else if (job.experienceRequirement.minYears >= 3) {
      checks.push({ id: "experience-requirement", result: "FLAG", reason: `role requires at least ${job.experienceRequirement.minYears} years; review before applying as an early-career candidate`, evidenceIds: [] });
    }
  }

  if (earlyCareer) {
    const title = normalizeMatchText(job.title);
    const seniorTokens = ["senior", "principal", "staff engineer", "시니어", "수석"];
    const leadTokens = ["tech lead", "team lead", "리드"];
    if (seniorTokens.some((token) => title.includes(token))) {
      checks.push({ id: "seniority-title", result: "FAIL", reason: "title explicitly indicates a senior-level role", evidenceIds: [] });
    } else if (leadTokens.some((token) => title.includes(token))) {
      checks.push({ id: "seniority-title", result: "FLAG", reason: "title indicates a lead-level role", evidenceIds: [] });
    }
  }

  const locationText = job.locations.map(normalizeMatchText).join(" ");
  for (const dealBreaker of profile.dealBreakers) {
    const normalized = normalizeMatchText(dealBreaker);
    if (normalized && (locationText.includes(normalized) || normalizeMatchText(job.fullText).includes(normalized))) {
      checks.push({ id: `deal-breaker:${normalized}`, result: "FAIL", reason: `candidate deal-breaker matched: ${dealBreaker}`, evidenceIds: [] });
    }
  }
  return checks;
}

function levelScore(job: JobPosting, profile: CandidateProfile): number {
  if (!targetsEarlyCareer(profile)) return 75;
  const signal = normalizeMatchText(`${job.title} ${job.experienceRequirement?.rawText ?? ""}`);
  const earlyCareerSignals = ["entry", "junior", "intern", "new grad", "신입", "주니어", "인턴", "경력 무관", "경력무관"];
  if (earlyCareerSignals.some((token) => signal.includes(token))) return 100;

  const minYears = job.experienceRequirement?.minYears;
  if (minYears === undefined) return 75;
  if (minYears <= 1) return 100;
  if (minYears === 2) return 80;
  if (minYears <= 4) return 40;
  return 0;
}

function dimensions(job: JobPosting, profile: CandidateProfile): FitDimensionInput[] {
  const evidenceConfidence = confidenceForJob(job);
  const skills = profile.skills.map((skill) => skill.name);
  const requiredScore = skillCoverage(job.requiredSkills, skills);
  const preferredScore = job.preferredSkills.length === 0 ? undefined : skillCoverage(job.preferredSkills, skills);
  const roleScore = roleMatchScore(job.title, profile.targetRoles);
  const roleAndLevelScore = Math.round((roleScore * 0.8) + (levelScore(job, profile) * 0.2));
  const locationScore = locationMatchScore(job.locations, profile.locations);
  const adjacencyScore = preferredScore === undefined ? requiredScore : Math.max(requiredScore, preferredScore);
  const relevantExperience = matchRelevantExperience(job, profile, requiredScore);

  return [
    { id: "roleAndLevel", label: "Role and level", weight: DEFAULT_FIT_WEIGHTS.roleAndLevel, score: roleAndLevelScore, evidenceConfidence, evidenceIds: [] },
    { id: "requiredSkills", label: "Required skills", weight: DEFAULT_FIT_WEIGHTS.requiredSkills, score: requiredScore, evidenceConfidence, evidenceIds: [] },
    { id: "relevantExperience", label: "Relevant experience", weight: DEFAULT_FIT_WEIGHTS.relevantExperience, score: relevantExperience.score, evidenceConfidence: relevantExperience.confidence, evidenceIds: relevantExperience.evidenceIds, rationale: relevantExperience.rationale },
    { id: "evidenceStrength", label: "Evidence strength", weight: DEFAULT_FIT_WEIGHTS.evidenceStrength, score: evidenceConfidence === "HIGH" ? 100 : evidenceConfidence === "MEDIUM" ? 70 : 35, evidenceConfidence, evidenceIds: [] },
    { id: "careerAlignment", label: "Career alignment", weight: DEFAULT_FIT_WEIGHTS.careerAlignment, score: Math.round((roleAndLevelScore + locationScore) / 2), evidenceConfidence: "MEDIUM", evidenceIds: [] },
    { id: "adjacencyAndLearning", label: "Adjacency and learning", weight: DEFAULT_FIT_WEIGHTS.adjacencyAndLearning, score: adjacencyScore, evidenceConfidence: "MEDIUM", evidenceIds: [] },
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

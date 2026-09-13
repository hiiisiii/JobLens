import type { CandidateProfile } from "../core/domain/candidate-profile.js";
import type { JobPosting } from "../core/domain/job-posting.js";
import type { JobEvaluation, Opportunity, OpportunityState } from "../core/domain/opportunity.js";
import type { EntityStore } from "../storage/store.js";
import { stableFingerprint } from "../discovery/fingerprint.js";
import { rankJobs, type RankedJob } from "./job-ranker.js";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function evaluationIdentity(ranked: RankedJob, profile: CandidateProfile): string {
  const assessment = ranked.assessment;
  const material = JSON.stringify({
    jobId: ranked.job.id,
    profileId: profile.profileId,
    profileVersion: profile.version,
    policyVersion: assessment.policyVersion,
    hardGate: assessment.hardGate,
    fitScore: assessment.fitScore ?? null,
    confidence: assessment.confidence,
    hardGates: assessment.hardGates.map((gate) => [gate.id, gate.result, gate.reason]),
    dimensions: assessment.dimensions.map((dimension) => [dimension.id, dimension.score, dimension.weightedPoints]),
  });
  return `eval:${stableFingerprint(material)}`;
}

function opportunityIdentity(jobId: string, profile: CandidateProfile): string {
  return `opp:${stableFingerprint(`${profile.profileId}:${profile.version}:${jobId}`)}`;
}

function proposedState(ranked: RankedJob): OpportunityState {
  return ranked.assessment.hardGate === "FAIL" ? "EXCLUDED" : "EVALUATED";
}

const USER_DECISION_STATES = new Set<OpportunityState>([
  "RESEARCHING",
  "REVIEWABLE",
  "HOLD",
  "SKIPPED",
  "APPLY_APPROVED",
]);

function evaluationFromRanked(ranked: RankedJob, profile: CandidateProfile, now: string): JobEvaluation {
  const strengths = ranked.assessment.dimensions
    .filter((dimension) => dimension.score >= 75)
    .map((dimension) => `${dimension.label}: ${dimension.score}/100`);
  const gaps = [
    ...ranked.assessment.hardGates
      .filter((gate) => gate.result !== "PASS")
      .map((gate) => gate.reason),
    ...ranked.assessment.dimensions
      .filter((dimension) => dimension.score < 50)
      .map((dimension) => `${dimension.label}: ${dimension.score}/100`),
  ];
  const evidenceIds = unique([
    ...ranked.assessment.hardGates.flatMap((gate) => gate.evidenceIds),
    ...ranked.assessment.dimensions.flatMap((dimension) => dimension.evidenceIds),
  ]);
  return {
    evaluationId: evaluationIdentity(ranked, profile),
    jobId: ranked.job.id,
    candidateProfileVersion: profile.version,
    hardGate: ranked.assessment.hardGate,
    ...(ranked.assessment.fitScore === undefined ? {} : { fitScore: ranked.assessment.fitScore }),
    confidence: ranked.assessment.confidence,
    strengths,
    gaps,
    evidenceIds,
    createdAt: now,
  };
}

export interface PersistedRankingResult {
  ranked: RankedJob[];
  evaluations: JobEvaluation[];
  opportunities: Opportunity[];
  createdOpportunities: number;
  updatedOpportunities: number;
}

export async function rankAndPersistJobs(input: {
  jobs: JobPosting[];
  profile: CandidateProfile;
  evaluationStore: EntityStore<JobEvaluation>;
  opportunityStore: EntityStore<Opportunity>;
  now: string;
}): Promise<PersistedRankingResult> {
  const ranked = rankJobs(input.jobs, input.profile);
  const evaluations: JobEvaluation[] = [];
  const opportunities: Opportunity[] = [];
  let createdOpportunities = 0;
  let updatedOpportunities = 0;

  for (const item of ranked) {
    const evaluation = evaluationFromRanked(item, input.profile, input.now);
    await input.evaluationStore.put(evaluation.evaluationId, evaluation);
    evaluations.push(evaluation);

    const opportunityId = opportunityIdentity(item.job.id, input.profile);
    const existing = await input.opportunityStore.get(opportunityId);
    const nextState = existing && USER_DECISION_STATES.has(existing.state)
      ? existing.state
      : proposedState(item);
    const opportunity: Opportunity = {
      opportunityId,
      jobId: item.job.id,
      candidateProfileVersion: input.profile.version,
      state: nextState,
      evaluationId: evaluation.evaluationId,
      ...(existing?.researchId ? { researchId: existing.researchId } : {}),
      ...(existing?.decisionReason ? { decisionReason: existing.decisionReason } : {}),
    };
    await input.opportunityStore.put(opportunityId, opportunity);
    opportunities.push(opportunity);
    if (existing) updatedOpportunities += 1;
    else createdOpportunities += 1;
  }

  return { ranked, evaluations, opportunities, createdOpportunities, updatedOpportunities };
}

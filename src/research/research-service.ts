import type { Authority, Confidence } from "../core/domain/common.js";
import type { CompanyResearch } from "../core/domain/company-research.js";
import type { JobPosting } from "../core/domain/job-posting.js";
import type { Opportunity, OpportunityState } from "../core/domain/opportunity.js";
import type { SourceEvidence } from "../core/domain/source-evidence.js";
import { stableFingerprint } from "../discovery/fingerprint.js";
import type { EntityStore } from "../storage/store.js";

export type ResearchFindingKind =
  | "verified_fact"
  | "analysis"
  | "community_signal"
  | "opportunity"
  | "risk";

export interface ResearchEvidenceInput {
  key: string;
  claim: string;
  evidenceType: string;
  sourceUri?: string;
  sourceTitle?: string;
  authority: Authority;
  confidence: Confidence;
  subject?: "company" | "job";
  notes?: string;
}

export interface ResearchFindingInput {
  kind: ResearchFindingKind;
  text: string;
  evidenceKeys: string[];
}

export interface ResearchImportInput {
  evidence: ResearchEvidenceInput[];
  findings: ResearchFindingInput[];
  unresolvedQuestions?: string[];
  expiresAt?: string;
}

export interface PersistResearchResult {
  research: CompanyResearch;
  evidence: SourceEvidence[];
  opportunity: Opportunity;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function validateInput(input: ResearchImportInput): void {
  if (!input || typeof input !== "object") throw new Error("research input must be an object");
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) throw new Error("research input requires at least one evidence item");
  if (!Array.isArray(input.findings) || input.findings.length === 0) throw new Error("research input requires at least one finding");

  const keys = new Set<string>();
  for (const item of input.evidence) {
    const key = requiredText(item.key, "evidence.key");
    if (keys.has(key)) throw new Error(`duplicate research evidence key: ${key}`);
    keys.add(key);
    requiredText(item.claim, `evidence ${key} claim`);
    requiredText(item.evidenceType, `evidence ${key} evidenceType`);
    if (!(["primary", "secondary", "community", "user"] as Authority[]).includes(item.authority)) {
      throw new Error(`invalid authority for evidence ${key}`);
    }
    if (!(["HIGH", "MEDIUM", "LOW"] as Confidence[]).includes(item.confidence)) {
      throw new Error(`invalid confidence for evidence ${key}`);
    }
    if (item.authority !== "user" && !item.sourceUri?.trim()) {
      throw new Error(`evidence ${key} requires sourceUri unless authority is user`);
    }
  }

  for (const finding of input.findings) {
    requiredText(finding.text, "finding.text");
    if (!(["verified_fact", "analysis", "community_signal", "opportunity", "risk"] as ResearchFindingKind[]).includes(finding.kind)) {
      throw new Error(`invalid research finding kind: ${String(finding.kind)}`);
    }
    if (!Array.isArray(finding.evidenceKeys) || finding.evidenceKeys.length === 0) {
      throw new Error(`${finding.kind} finding requires evidenceKeys`);
    }
    for (const key of finding.evidenceKeys) {
      if (!keys.has(key)) throw new Error(`finding references unknown evidence key: ${key}`);
    }
    if (finding.kind === "community_signal") {
      const authorities = finding.evidenceKeys.map((key) => input.evidence.find((item) => item.key === key)?.authority);
      if (!authorities.includes("community")) throw new Error("community_signal finding requires community-authority evidence");
    }
  }

  if (input.expiresAt && Number.isNaN(Date.parse(input.expiresAt))) throw new Error("research expiresAt must be an ISO-compatible datetime");
}

function nextOpportunityState(state: OpportunityState): OpportunityState {
  if (state === "EXCLUDED" || state === "SKIPPED") throw new Error(`cannot research opportunity in ${state} state`);
  if (state === "DISCOVERED") throw new Error("opportunity must be ranked before research");
  if (state === "HOLD" || state === "APPLY_APPROVED") return state;
  return "REVIEWABLE";
}

function companyIdentity(companyName: string): string {
  return `company:${stableFingerprint(companyName)}`;
}

export async function persistResearch(input: {
  opportunityId: string;
  researchInput: ResearchImportInput;
  opportunityStore: EntityStore<Opportunity>;
  jobStore: EntityStore<JobPosting>;
  researchStore: EntityStore<CompanyResearch>;
  evidenceStore: EntityStore<SourceEvidence>;
  now: string;
}): Promise<PersistResearchResult> {
  validateInput(input.researchInput);
  const opportunity = await input.opportunityStore.get(input.opportunityId);
  if (!opportunity) throw new Error(`opportunity not found: ${input.opportunityId}`);
  const job = await input.jobStore.get(opportunity.jobId);
  if (!job) throw new Error(`job not found for opportunity: ${opportunity.jobId}`);

  const companyId = companyIdentity(job.companyName);
  const evidenceByKey = new Map<string, SourceEvidence>();
  for (const item of input.researchInput.evidence) {
    const subjectType = item.subject ?? "company";
    const subjectId = subjectType === "job" ? job.id : companyId;
    const evidenceId = `evidence:${stableFingerprint(JSON.stringify({
      subjectType,
      subjectId,
      claim: item.claim,
      sourceUri: item.sourceUri ?? null,
      evidenceType: item.evidenceType,
    }))}`;
    const evidence: SourceEvidence = {
      evidenceId,
      subjectType,
      subjectId,
      claim: item.claim.trim(),
      evidenceType: item.evidenceType.trim(),
      ...(item.sourceUri?.trim() ? { sourceUri: item.sourceUri.trim() } : {}),
      ...(item.sourceTitle?.trim() ? { sourceTitle: item.sourceTitle.trim() } : {}),
      capturedAt: input.now,
      authority: item.authority,
      confidence: item.confidence,
      ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
    };
    evidenceByKey.set(item.key, evidence);
    await input.evidenceStore.put(evidenceId, evidence);
  }

  const evidenceIds = [...new Set(input.researchInput.findings.flatMap((finding) =>
    finding.evidenceKeys.map((key) => evidenceByKey.get(key)?.evidenceId).filter((value): value is string => Boolean(value)),
  ))];
  const findings = (kind: ResearchFindingKind) => input.researchInput.findings.filter((finding) => finding.kind === kind).map((finding) => finding.text.trim());
  const researchId = `research:${stableFingerprint(JSON.stringify({
    opportunityId: opportunity.opportunityId,
    evidenceIds,
    findings: input.researchInput.findings,
    unresolvedQuestions: input.researchInput.unresolvedQuestions ?? [],
  }))}`;
  const research: CompanyResearch = {
    researchId,
    companyId,
    jobId: job.id,
    researchedAt: input.now,
    ...(input.researchInput.expiresAt ? { expiresAt: input.researchInput.expiresAt } : {}),
    verifiedFacts: findings("verified_fact"),
    analysis: findings("analysis"),
    communitySignals: findings("community_signal"),
    opportunities: findings("opportunity"),
    risks: findings("risk"),
    evidenceIds,
    unresolvedQuestions: (input.researchInput.unresolvedQuestions ?? []).map((value) => value.trim()).filter(Boolean),
  };
  await input.researchStore.put(researchId, research);

  const updatedOpportunity: Opportunity = {
    ...opportunity,
    state: nextOpportunityState(opportunity.state),
    researchId,
  };
  await input.opportunityStore.put(updatedOpportunity.opportunityId, updatedOpportunity);

  return { research, evidence: [...evidenceByKey.values()], opportunity: updatedOpportunity };
}

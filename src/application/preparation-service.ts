import type { CandidateProfile } from "../core/domain/candidate-profile.js";
import type { Application } from "../core/domain/application.js";
import type {
  ApplicationPackage,
  ArtifactType,
  GroundedClaim,
  PreparedArtifact,
} from "../core/domain/application-package.js";
import type { CompanyResearch } from "../core/domain/company-research.js";
import type { JobPosting } from "../core/domain/job-posting.js";
import type { Opportunity } from "../core/domain/opportunity.js";
import { stableFingerprint } from "../discovery/fingerprint.js";
import type { EntityStore } from "../storage/store.js";
import { transitionApplication } from "./transition-service.js";

export interface ArtifactDraftInput {
  type: ArtifactType;
  content: string;
  claims: Array<{
    claimId?: string;
    text: string;
    evidenceIds: string[];
  }>;
}

export interface PrepareApplicationInput {
  artifacts: ArtifactDraftInput[];
}

export interface PrepareApplicationResult {
  application: Application;
  package: ApplicationPackage;
  opportunity: Opportunity;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function profileEvidenceIds(profile: CandidateProfile): string[] {
  return [...new Set([
    ...profile.skills.flatMap((skill) => skill.evidenceIds),
    ...(profile.experienceEvidence ?? []).flatMap((experience) => experience.evidenceIds),
  ].filter(Boolean))];
}

function validateArtifacts(artifacts: ArtifactDraftInput[]): void {
  if (!Array.isArray(artifacts) || artifacts.length === 0) throw new Error("prepare input requires at least one artifact");
  const allowedTypes: ArtifactType[] = ["resume", "self_intro", "cover_letter", "portfolio_brief"];
  const types = new Set<string>();
  for (const artifact of artifacts) {
    if (!allowedTypes.includes(artifact.type)) throw new Error(`unsupported artifact type: ${String(artifact.type)}`);
    if (types.has(artifact.type)) throw new Error(`duplicate artifact type: ${artifact.type}`);
    types.add(artifact.type);
    requiredText(artifact.content, `${artifact.type}.content`);
    if (!Array.isArray(artifact.claims)) throw new Error(`${artifact.type}.claims must be an array`);
    for (const claim of artifact.claims) {
      requiredText(claim.text, `${artifact.type}.claim.text`);
      if (!Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0) {
        throw new Error(`${artifact.type} factual claim requires at least one evidenceId`);
      }
      for (const evidenceId of claim.evidenceIds) requiredText(evidenceId, `${artifact.type}.claim.evidenceId`);
    }
  }
}

function buildArtifact(input: ArtifactDraftInput, index: number): PreparedArtifact {
  const content = input.content.trim();
  const contentHash = stableFingerprint(content);
  const claims: GroundedClaim[] = input.claims.map((claim, claimIndex) => ({
    claimId: claim.claimId?.trim() || `claim:${stableFingerprint(`${input.type}:${index}:${claimIndex}:${claim.text}`)}`,
    text: claim.text.trim(),
    evidenceIds: [...new Set(claim.evidenceIds.map((value) => value.trim()))],
  }));
  return {
    artifactId: `artifact:${stableFingerprint(`${input.type}:${contentHash}`)}`,
    type: input.type,
    version: contentHash,
    content,
    contentHash,
    claims,
  };
}

export async function prepareApplication(input: {
  opportunityId: string;
  userApproved: true;
  draft: PrepareApplicationInput;
  profile: CandidateProfile;
  opportunityStore: EntityStore<Opportunity>;
  jobStore: EntityStore<JobPosting>;
  researchStore: EntityStore<CompanyResearch>;
  applicationStore: EntityStore<Application>;
  packageStore: EntityStore<ApplicationPackage>;
  now: string;
}): Promise<PrepareApplicationResult> {
  if (input.userApproved !== true) throw new Error("application preparation requires explicit user approval");
  validateArtifacts(input.draft.artifacts);

  const opportunity = await input.opportunityStore.get(input.opportunityId);
  if (!opportunity) throw new Error(`opportunity not found: ${input.opportunityId}`);
  if (!(["REVIEWABLE", "APPLY_APPROVED"] as const).includes(opportunity.state as "REVIEWABLE" | "APPLY_APPROVED")) {
    throw new Error(`cannot prepare application from opportunity state ${opportunity.state}`);
  }
  if (opportunity.candidateProfileVersion !== input.profile.version) {
    throw new Error(`candidate profile version mismatch: opportunity=${opportunity.candidateProfileVersion}, profile=${input.profile.version}`);
  }
  if (!opportunity.researchId) throw new Error("application preparation requires completed research");

  const job = await input.jobStore.get(opportunity.jobId);
  if (!job) throw new Error(`job not found: ${opportunity.jobId}`);
  const research = await input.researchStore.get(opportunity.researchId);
  if (!research) throw new Error(`research not found: ${opportunity.researchId}`);

  const jobSnapshotEvidenceId = `job-snapshot:${job.id}`;
  const allowedEvidenceIds = [...new Set([
    ...profileEvidenceIds(input.profile),
    ...research.evidenceIds,
    jobSnapshotEvidenceId,
  ])].sort();
  const allowedEvidence = new Set(allowedEvidenceIds);
  const artifacts = input.draft.artifacts.map(buildArtifact);
  for (const artifact of artifacts) {
    for (const claim of artifact.claims) {
      const unknown = claim.evidenceIds.filter((id) => !allowedEvidence.has(id));
      if (unknown.length > 0) throw new Error(`claim ${claim.claimId} references evidence outside the frozen source set: ${unknown.join(", ")}`);
    }
  }

  const sourceBase = {
    candidateProfile: clone(input.profile),
    job: clone(job),
    research: clone(research),
    allowedEvidenceIds,
    jobSnapshotEvidenceId,
  };
  const snapshotHash = stableFingerprint(JSON.stringify(sourceBase));
  const applicationId = `application:${stableFingerprint(`${opportunity.opportunityId}:${input.profile.version}`)}`;
  const packageId = `package:${stableFingerprint(JSON.stringify({ applicationId, snapshotHash, artifacts }))}`;

  const existingApplication = await input.applicationStore.get(applicationId);
  if (existingApplication && !["PREPARING", "REVISION_REQUIRED"].includes(existingApplication.state)) {
    throw new Error(`cannot replace application package while application is ${existingApplication.state}`);
  }

  let application: Application;
  if (!existingApplication) {
    application = {
      applicationId,
      opportunityId: opportunity.opportunityId,
      jobId: job.id,
      candidateProfileVersion: input.profile.version,
      state: "PREPARING",
      reviewerStatus: "PENDING",
      groundingBlockers: [],
      events: [{
        eventId: `event:${stableFingerprint(`${applicationId}:prepare:${input.now}`)}`,
        to: "PREPARING",
        actor: "user",
        occurredAt: input.now,
        reason: "explicitly approved application preparation",
      }],
    };
  } else if (existingApplication.state === "REVISION_REQUIRED") {
    const revised = transitionApplication(existingApplication, { type: "REVISE", reason: "revised application package prepared" }, {
      eventId: `event:${stableFingerprint(`${applicationId}:revise:${packageId}`)}`,
      actor: "user",
      occurredAt: input.now,
      idempotencyKey: `revise:${packageId}`,
    }).application;
    application = {
      ...revised,
      reviewerStatus: "PENDING",
      groundingBlockers: [],
    };
  } else {
    application = {
      ...existingApplication,
      reviewerStatus: "PENDING",
      groundingBlockers: [],
    };
  }

  const applicationPackage: ApplicationPackage = {
    packageId,
    applicationId,
    opportunityId: opportunity.opportunityId,
    jobId: job.id,
    candidateProfileVersion: input.profile.version,
    researchId: research.researchId,
    preparedAt: input.now,
    artifacts,
    sourceSnapshot: {
      ...sourceBase,
      snapshotHash,
    },
  };

  const updatedOpportunity: Opportunity = {
    ...opportunity,
    state: "APPLY_APPROVED",
  };

  await input.applicationStore.put(applicationId, application);
  await input.packageStore.put(packageId, applicationPackage);
  await input.opportunityStore.put(updatedOpportunity.opportunityId, updatedOpportunity);

  return { application, package: applicationPackage, opportunity: updatedOpportunity };
}

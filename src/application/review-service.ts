import type { Application } from "../core/domain/application.js";
import type {
  ApplicationPackage,
  ApplicationReview,
  ReviewCategory,
  ReviewFinding,
  ReviewSeverity,
} from "../core/domain/application-package.js";
import { stableFingerprint } from "../discovery/fingerprint.js";
import type { EntityStore } from "../storage/store.js";
import { transitionApplication } from "./transition-service.js";

export interface ReviewInput {
  status: "PASS" | "FAIL";
  findings?: Array<{
    severity: ReviewSeverity;
    category: ReviewCategory;
    message: string;
    artifactId?: string;
  }>;
}

function validateReviewInput(input: ReviewInput): ReviewFinding[] {
  if (!input || typeof input !== "object") throw new Error("review input must be an object");
  if (!(["PASS", "FAIL"] as const).includes(input.status)) throw new Error("review status must be PASS or FAIL");
  const findings = input.findings ?? [];
  if (!Array.isArray(findings)) throw new Error("review findings must be an array");
  for (const finding of findings) {
    if (!(["BLOCKER", "WARNING"] as ReviewSeverity[]).includes(finding.severity)) throw new Error(`invalid review severity: ${String(finding.severity)}`);
    if (!(["grounding", "relevance", "clarity", "consistency", "other"] as ReviewCategory[]).includes(finding.category)) throw new Error(`invalid review category: ${String(finding.category)}`);
    if (typeof finding.message !== "string" || !finding.message.trim()) throw new Error("review finding message must be non-empty");
  }
  if (input.status === "PASS" && findings.some((finding) => finding.severity === "BLOCKER")) {
    throw new Error("review status PASS cannot include BLOCKER findings");
  }
  return findings.map((finding) => ({
    ...finding,
    message: finding.message.trim(),
    ...(finding.artifactId?.trim() ? { artifactId: finding.artifactId.trim() } : {}),
  }));
}

export function auditPackageGrounding(applicationPackage: ApplicationPackage): string[] {
  const blockers: string[] = [];
  const allowed = new Set(applicationPackage.sourceSnapshot.allowedEvidenceIds);
  const artifactIds = new Set<string>();
  for (const artifact of applicationPackage.artifacts) {
    if (artifactIds.has(artifact.artifactId)) blockers.push(`duplicate artifact id: ${artifact.artifactId}`);
    artifactIds.add(artifact.artifactId);
    if (!artifact.content.trim()) blockers.push(`artifact ${artifact.artifactId} has empty content`);
    if (stableFingerprint(artifact.content) !== artifact.contentHash) blockers.push(`artifact ${artifact.artifactId} content hash mismatch`);
    const claimIds = new Set<string>();
    for (const claim of artifact.claims) {
      if (claimIds.has(claim.claimId)) blockers.push(`artifact ${artifact.artifactId} has duplicate claim id ${claim.claimId}`);
      claimIds.add(claim.claimId);
      if (!claim.text.trim()) blockers.push(`claim ${claim.claimId} has empty text`);
      if (claim.evidenceIds.length === 0) blockers.push(`claim ${claim.claimId} has no evidence`);
      for (const evidenceId of claim.evidenceIds) {
        if (!allowed.has(evidenceId)) blockers.push(`claim ${claim.claimId} references non-frozen evidence ${evidenceId}`);
      }
    }
  }
  return [...new Set(blockers)];
}

export async function reviewApplication(input: {
  applicationId: string;
  packageId: string;
  reviewInput: ReviewInput;
  applicationStore: EntityStore<Application>;
  packageStore: EntityStore<ApplicationPackage>;
  reviewStore: EntityStore<ApplicationReview>;
  now: string;
}): Promise<{ application: Application; review: ApplicationReview }> {
  const findings = validateReviewInput(input.reviewInput);
  const application = await input.applicationStore.get(input.applicationId);
  if (!application) throw new Error(`application not found: ${input.applicationId}`);
  if (application.state !== "PREPARING") throw new Error(`application must be PREPARING before review; current=${application.state}`);
  const applicationPackage = await input.packageStore.get(input.packageId);
  if (!applicationPackage) throw new Error(`application package not found: ${input.packageId}`);
  if (applicationPackage.applicationId !== application.applicationId) throw new Error("application package does not belong to application");

  const start = transitionApplication(application, { type: "START_REVIEW" }, {
    eventId: `event:${stableFingerprint(`${application.applicationId}:review-start:${input.packageId}:${input.now}`)}`,
    actor: "reviewer",
    occurredAt: input.now,
    idempotencyKey: `review-start:${input.packageId}`,
  }).application;

  const groundingBlockers = auditPackageGrounding(applicationPackage);
  const reviewed: Application = {
    ...start,
    reviewerStatus: input.reviewInput.status,
    groundingBlockers,
  };

  const shouldRevise = input.reviewInput.status === "FAIL" || groundingBlockers.length > 0;
  const final = shouldRevise
    ? transitionApplication(reviewed, { type: "REQUEST_REVISION", reason: input.reviewInput.status === "FAIL" ? "reviewer requested revision" : "grounding audit blockers" }, {
        eventId: `event:${stableFingerprint(`${application.applicationId}:revision:${input.packageId}:${input.now}`)}`,
        actor: "reviewer",
        occurredAt: input.now,
        idempotencyKey: `review-result:${input.packageId}`,
      }).application
    : transitionApplication(reviewed, { type: "MARK_READY" }, {
        eventId: `event:${stableFingerprint(`${application.applicationId}:ready:${input.packageId}:${input.now}`)}`,
        actor: "reviewer",
        occurredAt: input.now,
        idempotencyKey: `review-result:${input.packageId}`,
      }).application;

  const reviewId = `review:${stableFingerprint(JSON.stringify({ applicationId: application.applicationId, packageId: input.packageId, status: input.reviewInput.status, findings, groundingBlockers }))}`;
  const review: ApplicationReview = {
    reviewId,
    applicationId: application.applicationId,
    packageId: input.packageId,
    reviewedAt: input.now,
    reviewerStatus: input.reviewInput.status,
    findings,
    groundingBlockers,
    resultState: final.state === "READY" ? "READY" : "REVISION_REQUIRED",
  };

  await input.applicationStore.put(final.applicationId, final);
  await input.reviewStore.put(review.reviewId, review);
  return { application: final, review };
}

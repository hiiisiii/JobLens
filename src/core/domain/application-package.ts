import type { ISODateTime } from "./common.js";
import type { CandidateProfile } from "./candidate-profile.js";
import type { CompanyResearch } from "./company-research.js";
import type { JobPosting } from "./job-posting.js";

export type ArtifactType = "resume" | "self_intro" | "cover_letter" | "portfolio_brief";

export interface GroundedClaim {
  claimId: string;
  text: string;
  evidenceIds: string[];
}

export interface PreparedArtifact {
  artifactId: string;
  type: ArtifactType;
  version: string;
  content: string;
  contentHash: string;
  claims: GroundedClaim[];
}

export interface ApplicationSourceSnapshot {
  candidateProfile: CandidateProfile;
  job: JobPosting;
  research: CompanyResearch;
  allowedEvidenceIds: string[];
  jobSnapshotEvidenceId: string;
  snapshotHash: string;
}

export interface ApplicationPackage {
  packageId: string;
  applicationId: string;
  opportunityId: string;
  jobId: string;
  candidateProfileVersion: string;
  researchId: string;
  preparedAt: ISODateTime;
  artifacts: PreparedArtifact[];
  sourceSnapshot: ApplicationSourceSnapshot;
}

export type ReviewSeverity = "BLOCKER" | "WARNING";
export type ReviewCategory = "grounding" | "relevance" | "clarity" | "consistency" | "other";

export interface ReviewFinding {
  severity: ReviewSeverity;
  category: ReviewCategory;
  message: string;
  artifactId?: string;
}

export interface ApplicationReview {
  reviewId: string;
  applicationId: string;
  packageId: string;
  reviewedAt: ISODateTime;
  reviewerStatus: "PASS" | "FAIL";
  findings: ReviewFinding[];
  groundingBlockers: string[];
  resultState: "READY" | "REVISION_REQUIRED";
}

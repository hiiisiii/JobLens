import type { ISODateTime } from "./common.js";

export type ApplicationState =
  | "PREPARING"
  | "REVIEWING"
  | "REVISION_REQUIRED"
  | "READY"
  | "APPLIED"
  | "INTERVIEWING"
  | "OFFER_STAGE"
  | "COMPLETED"
  | "WITHDRAWN";

export type ApplicationOutcome =
  | "REJECTED"
  | "NO_RESPONSE"
  | "ROLE_CLOSED"
  | "OFFER_ACCEPTED"
  | "OFFER_DECLINED"
  | "WITHDRAWN"
  | "OTHER";

export interface LifecycleEvent {
  eventId: string;
  from?: string;
  to: string;
  reason?: string;
  actor: "system" | "user" | "reviewer";
  occurredAt: ISODateTime;
  idempotencyKey?: string;
}

export interface SubmissionSnapshot {
  snapshotId: string;
  candidateProfileVersion: string;
  artifactVersions: Record<string, string>;
  artifactHashes: Record<string, string>;
  submittedAt: ISODateTime;
  channel: string;
}

export interface Application {
  applicationId: string;
  opportunityId: string;
  jobId: string;
  candidateProfileVersion: string;
  state: ApplicationState;
  reviewerStatus?: "PENDING" | "PASS" | "FAIL";
  groundingBlockers: string[];
  events: LifecycleEvent[];
  submissionSnapshot?: SubmissionSnapshot;
  outcome?: ApplicationOutcome;
}

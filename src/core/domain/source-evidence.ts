import type { Authority, Confidence, ISODateTime } from "./common.js";

export interface SourceEvidence {
  evidenceId: string;
  subjectType: "candidate" | "job" | "company" | "application";
  subjectId: string;
  claim: string;
  evidenceType: string;
  sourceUri?: string;
  sourceTitle?: string;
  capturedAt: ISODateTime;
  authority: Authority;
  confidence: Confidence;
  checksum?: string;
  notes?: string;
}

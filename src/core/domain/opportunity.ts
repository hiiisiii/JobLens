import type { Confidence, HardGateResult, ISODateTime } from "./common.js";

export type OpportunityState =
  | "DISCOVERED"
  | "EVALUATED"
  | "RESEARCHING"
  | "REVIEWABLE"
  | "HOLD"
  | "SKIPPED"
  | "EXCLUDED"
  | "APPLY_APPROVED";

export interface JobEvaluation {
  evaluationId: string;
  jobId: string;
  candidateProfileVersion: string;
  hardGate: HardGateResult;
  fitScore?: number;
  confidence: Confidence;
  strengths: string[];
  gaps: string[];
  evidenceIds: string[];
  createdAt: ISODateTime;
}

export interface Opportunity {
  opportunityId: string;
  jobId: string;
  candidateProfileVersion: string;
  state: OpportunityState;
  evaluationId?: string;
  researchId?: string;
  decisionReason?: string;
}

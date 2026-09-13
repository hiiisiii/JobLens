import type { ISODateTime } from "./common.js";

export interface CompanyResearch {
  researchId: string;
  companyId: string;
  jobId?: string;
  researchedAt: ISODateTime;
  expiresAt?: ISODateTime;
  verifiedFacts: string[];
  analysis: string[];
  communitySignals: string[];
  opportunities: string[];
  risks: string[];
  evidenceIds: string[];
  unresolvedQuestions: string[];
}

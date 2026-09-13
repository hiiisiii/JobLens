import type { ApplicationOutcome } from "../core/domain/application.js";

export type ApprovalClass =
  | "READ_ONLY"
  | "LOCAL_MUTATION"
  | "EXPLICIT_DECISION"
  | "EXTERNAL_ACTION";

export interface ToolRequestContext {
  requestId: string;
  workspaceId: string;
  client?: "chatgpt" | "claude" | "gemini" | "codex" | "cli" | "other";
  actor: "user" | "assistant" | "system";
  idempotencyKey?: string;
}

export interface ToolResponse<T> {
  ok: boolean;
  requestId: string;
  data?: T;
  warnings?: Array<{ code: string; message: string }>;
  error?: { code: string; message: string; retryable: boolean };
}

export interface DiscoverInput {
  query?: string;
  keywords?: string[];
  locations?: string[];
  targetRoles?: string[];
  postedAfter?: string;
  sources?: string[];
  maxResults?: number;
}

export interface RankInput {
  opportunityIds?: string[];
  allOpen?: boolean;
  candidateProfileVersion?: string;
}

export interface ResearchInput {
  opportunityIds: string[];
  depth?: "quick" | "standard" | "deep";
  refresh?: boolean;
}

export interface PrepareInput {
  opportunityId: string;
  userApproved: true;
  artifactTypes?: Array<"resume" | "self_intro" | "cover_letter" | "portfolio_brief">;
}

export interface RecordOutcomeInput {
  applicationId: string;
  event:
    | { type: "APPLIED"; submittedAt: string; channel: string; userConfirmed: true }
    | { type: "INTERVIEW"; occurredAt: string; round?: string; notes?: string }
    | { type: "OFFER_STAGE"; occurredAt: string }
    | { type: "COMPLETE"; outcome: ApplicationOutcome; occurredAt: string }
    | { type: "WITHDRAW"; occurredAt: string; reason?: string };
}

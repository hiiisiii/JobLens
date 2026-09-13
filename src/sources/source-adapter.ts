import type { SourceJobRef } from "../core/domain/job-posting.js";

export type SourceKind =
  | "official_api"
  | "public_api"
  | "portal_page"
  | "company_careers"
  | "web_search"
  | "manual_input";

export type SourceCapability =
  | "HEALTH"
  | "SEARCH"
  | "DETAIL"
  | "MANUAL_INGEST"
  | "NORMALIZE"
  | "INCREMENTAL";

export interface SourceContext {
  requestId: string;
  now: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface SourceMetadata {
  id: string;
  kind: SourceKind;
  displayName: string;
  capabilities: readonly SourceCapability[];
}

export interface SearchQuery {
  keywords: string[];
  locations?: string[];
  targetRoles?: string[];
  postedAfter?: string;
  pageSize?: number;
  cursor?: string;
}

export interface SearchHit {
  ref: SourceJobRef;
  title?: string;
  company?: string;
  location?: string;
  postedAt?: string;
  snippet?: string;
}

export interface SearchPage {
  items: SearchHit[];
  nextCursor?: string;
  fetchedAt: string;
}

export interface RawPosting {
  ref: SourceJobRef;
  fetchedAt: string;
  payload: unknown;
  rawText?: string;
  rawHash: string;
}

export interface JobPostingDraft {
  sourceRef: SourceJobRef;
  company: { name: string; normalizedName?: string };
  title: string;
  normalizedTitle?: string;
  locations: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  employmentTypes?: string[];
  experienceRequirement?: {
    minYears?: number;
    maxYears?: number;
    rawText?: string;
  };
  postedAt?: string;
  expiresAt?: string;
  contentCompleteness?: "full" | "partial" | "unknown";
  status: "open" | "closed" | "unknown";
  fullText: string;
  rawHash: string;
}

export type SourceErrorCode =
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "TEMPORARY_UNAVAILABLE"
  | "AUTH_REQUIRED"
  | "NOT_FOUND"
  | "CLOSED_OR_REMOVED"
  | "PARSE_CHANGED"
  | "INVALID_RESPONSE"
  | "UNSUPPORTED_QUERY"
  | "POLICY_BLOCKED"
  | "VALIDATION_FAILED"
  | "UNKNOWN";

export interface SourceError {
  code: SourceErrorCode;
  sourceId: string;
  operation: "health" | "search" | "fetch" | "ingest" | "normalize";
  retryable: boolean;
  retryAfterMs?: number;
  ref?: SourceJobRef;
  message: string;
  occurredAt: string;
}

export interface SourceWarning {
  code: string;
  message: string;
}

export type SourceResult<T> =
  | { ok: true; data: T; warnings: SourceWarning[] }
  | { ok: false; error: SourceError };

export interface SourceHealth {
  status: "healthy" | "degraded" | "unavailable";
  checkedAt: string;
  message?: string;
}

export interface JobSource {
  readonly metadata: SourceMetadata;
  healthCheck(ctx: SourceContext): Promise<SourceResult<SourceHealth>>;
}

export interface SearchableJobSource extends JobSource {
  search(query: SearchQuery, ctx: SourceContext): Promise<SourceResult<SearchPage>>;
}

export interface DetailJobSource extends JobSource {
  fetch(ref: SourceJobRef, ctx: SourceContext): Promise<SourceResult<RawPosting>>;
}

export interface ManualJobSource<TInput> extends JobSource {
  ingest(input: TInput, ctx: SourceContext): Promise<SourceResult<RawPosting>>;
}

export interface NormalizingJobSource extends JobSource {
  normalize(raw: RawPosting, ctx: SourceContext): Promise<SourceResult<JobPostingDraft>>;
}

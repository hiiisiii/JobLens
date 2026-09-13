import type { SourceJobRef } from "../core/domain/job-posting.js";

export type SourceKind =
  | "official_api"
  | "public_api"
  | "portal_page"
  | "company_careers"
  | "web_search"
  | "manual_input";

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
  supportsSearch: boolean;
  supportsDetailFetch: boolean;
  supportsIncrementalSync: boolean;
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
  | "UNKNOWN";

export interface SourceError {
  code: SourceErrorCode;
  sourceId: string;
  operation: "health" | "search" | "fetch" | "normalize";
  retryable: boolean;
  retryAfterMs?: number;
  ref?: SourceJobRef;
  message: string;
  occurredAt: string;
}

export type SourceResult<T> =
  | { ok: true; data: T; warnings: Array<{ code: string; message: string }> }
  | { ok: false; error: SourceError };

export interface SourceHealth {
  status: "healthy" | "degraded" | "unavailable";
  checkedAt: string;
  message?: string;
}

export interface SourceAdapter {
  readonly metadata: SourceMetadata;
  healthCheck(ctx: SourceContext): Promise<SourceResult<SourceHealth>>;
  search(query: SearchQuery, ctx: SourceContext): Promise<SourceResult<SearchPage>>;
  fetch(ref: SourceJobRef, ctx: SourceContext): Promise<SourceResult<RawPosting>>;
  normalize(raw: RawPosting, ctx: SourceContext): Promise<SourceResult<JobPostingDraft>>;
}

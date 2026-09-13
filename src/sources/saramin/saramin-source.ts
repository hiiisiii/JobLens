import { stableFingerprint } from "../../discovery/fingerprint.js";
import type {
  DetailJobSource,
  JobPostingDraft,
  NormalizingJobSource,
  RawPosting,
  SearchableJobSource,
  SearchPage,
  SearchQuery,
  SourceContext,
  SourceErrorCode,
  SourceHealth,
  SourceMetadata,
  SourceResult,
} from "../source-adapter.js";

const DEFAULT_BASE_URL = "https://oapi.saramin.co.kr/job-search";
const MAX_PAGE_SIZE = 110;

const KNOWN_LOCATION_CODES: Record<string, string> = {
  "서울": "101000",
  "서울전체": "101000",
  "seoul": "101000",
};

interface SaraminNamedValue {
  code?: string | number;
  name?: string;
}

interface SaraminExperience extends SaraminNamedValue {
  min?: number | string;
  max?: number | string;
}

interface SaraminJob {
  id?: string | number;
  url?: string;
  active?: number | string;
  company?: { detail?: { href?: string; name?: string } };
  position?: {
    title?: string;
    location?: SaraminNamedValue;
    "job-type"?: SaraminNamedValue;
    industry?: SaraminNamedValue;
    "job-mid-code"?: SaraminNamedValue;
    "job-code"?: SaraminNamedValue;
    "experience-level"?: SaraminExperience;
    "required-education-level"?: SaraminNamedValue;
  };
  keyword?: string;
  salary?: SaraminNamedValue;
  "posting-timestamp"?: string | number;
  "posting-date"?: string;
  "expiration-timestamp"?: string | number;
  "expiration-date"?: string;
  "close-type"?: SaraminNamedValue;
}

interface SaraminResponse {
  jobs?: {
    count?: number | string;
    start?: number | string;
    total?: number | string;
    job?: SaraminJob[];
  };
  code?: number | string;
  message?: string;
}

export interface SaraminSourceOptions {
  accessKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

function numberValue(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function unixToIso(value: string | number | undefined): string | undefined {
  const seconds = numberValue(value);
  if (seconds === undefined || seconds <= 0) return undefined;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function splitList(value: string | undefined): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function canonicalizeSaraminUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function apiErrorCode(code: string | number | undefined): SourceErrorCode {
  switch (String(code ?? "")) {
    case "1":
    case "2":
      return "AUTH_REQUIRED";
    case "3":
      return "VALIDATION_FAILED";
    case "4":
      return "RATE_LIMITED";
    case "99":
      return "TEMPORARY_UNAVAILABLE";
    default:
      return "INVALID_RESPONSE";
  }
}

function sourceError(
  ctx: SourceContext,
  operation: "health" | "search" | "fetch" | "normalize",
  code: SourceErrorCode,
  message: string,
  retryable: boolean,
  ref?: RawPosting["ref"],
): SourceResult<never> {
  return {
    ok: false,
    error: {
      code,
      sourceId: "saramin",
      operation,
      retryable,
      ...(ref ? { ref } : {}),
      message,
      occurredAt: ctx.now,
    },
  };
}

function locationCodes(locations: string[] | undefined): string[] {
  if (!locations) return [];
  return locations.flatMap((location) => {
    const normalized = location.trim().toLowerCase();
    if (/^\d{6}$/.test(normalized)) return [normalized];
    const mapped = KNOWN_LOCATION_CODES[normalized];
    return mapped ? [mapped] : [];
  });
}

function isSaraminJob(value: unknown): value is SaraminJob {
  if (!value || typeof value !== "object") return false;
  const job = value as SaraminJob;
  return Boolean(job.id && job.url && job.position?.title && job.company?.detail?.name);
}

function buildStructuredText(job: SaraminJob): string {
  const position = job.position;
  const parts = [
    `Title: ${position?.title ?? ""}`,
    `Company: ${job.company?.detail?.name ?? ""}`,
    `Location: ${position?.location?.name ?? ""}`,
    `Employment type: ${position?.["job-type"]?.name ?? ""}`,
    `Experience: ${position?.["experience-level"]?.name ?? ""}`,
    `Education: ${position?.["required-education-level"]?.name ?? ""}`,
    `Job category: ${position?.["job-code"]?.name ?? position?.["job-mid-code"]?.name ?? ""}`,
    `Keywords: ${job.keyword ?? ""}`,
    `Salary: ${job.salary?.name ?? ""}`,
  ];
  return parts.filter((part) => !part.endsWith(": ")).join("\n");
}

export class SaraminSource implements SearchableJobSource, DetailJobSource, NormalizingJobSource {
  readonly metadata: SourceMetadata = {
    id: "saramin",
    kind: "official_api",
    displayName: "Saramin Open API",
    capabilities: ["HEALTH", "SEARCH", "DETAIL", "NORMALIZE"],
  };

  private readonly accessKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SaraminSourceOptions = {}) {
    this.accessKey = options.accessKey?.trim() || undefined;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async healthCheck(ctx: SourceContext): Promise<SourceResult<SourceHealth>> {
    if (!this.accessKey) {
      return {
        ok: true,
        data: {
          status: "degraded",
          checkedAt: ctx.now,
          message: "SARAMIN_ACCESS_KEY is not configured",
        },
        warnings: [{ code: "AUTH_NOT_CONFIGURED", message: "Saramin source is disabled until an access key is configured" }],
      };
    }
    return {
      ok: true,
      data: { status: "healthy", checkedAt: ctx.now, message: "configured; network probe skipped to preserve API quota" },
      warnings: [],
    };
  }

  private async request(params: URLSearchParams, ctx: SourceContext, operation: "search" | "fetch"): Promise<SourceResult<SaraminResponse>> {
    if (!this.accessKey) return sourceError(ctx, operation, "AUTH_REQUIRED", "Saramin access key is not configured", false);

    params.set("access-key", this.accessKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ctx.timeoutMs);
    const abortFromParent = () => controller.abort();
    ctx.signal?.addEventListener("abort", abortFromParent, { once: true });

    try {
      const response = await this.fetchImpl(`${this.baseUrl}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return sourceError(ctx, operation, "AUTH_REQUIRED", `Saramin request rejected with HTTP ${response.status}`, false);
        }
        if (response.status === 429) {
          return sourceError(ctx, operation, "RATE_LIMITED", "Saramin API rate limit reached", true);
        }
        const retryable = response.status >= 500;
        return sourceError(
          ctx,
          operation,
          retryable ? "TEMPORARY_UNAVAILABLE" : "INVALID_RESPONSE",
          `Saramin request failed with HTTP ${response.status}`,
          retryable,
        );
      }

      const payload = await response.json() as SaraminResponse;
      if (payload.code !== undefined) {
        const code = apiErrorCode(payload.code);
        return sourceError(
          ctx,
          operation,
          code,
          payload.message || "Saramin API returned an error",
          code === "RATE_LIMITED" || code === "TEMPORARY_UNAVAILABLE",
        );
      }
      if (!payload.jobs || !Array.isArray(payload.jobs.job)) {
        return sourceError(ctx, operation, "INVALID_RESPONSE", "Saramin response did not contain jobs.job[]", false);
      }
      return { ok: true, data: payload, warnings: [] };
    } catch (error) {
      const aborted = controller.signal.aborted;
      return sourceError(
        ctx,
        operation,
        aborted ? "TIMEOUT" : "NETWORK_ERROR",
        aborted ? "Saramin request timed out" : `Saramin request failed: ${error instanceof Error ? error.message : "unknown network error"}`,
        true,
      );
    } finally {
      clearTimeout(timeout);
      ctx.signal?.removeEventListener("abort", abortFromParent);
    }
  }

  async search(query: SearchQuery, ctx: SourceContext): Promise<SourceResult<SearchPage>> {
    const params = new URLSearchParams();
    if (query.keywords.length) params.set("keywords", query.keywords.join(" "));
    params.set("fields", "posting-date expiration-date");
    params.set("sort", "pd");

    const codes = locationCodes(query.locations);
    if (codes.length) params.set("loc_cd", codes.join(","));

    if (query.postedAfter) {
      const timestamp = Math.floor(new Date(query.postedAfter).valueOf() / 1000);
      if (Number.isFinite(timestamp)) params.set("published_min", String(timestamp));
    }

    const count = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(query.pageSize ?? 20)));
    params.set("count", String(count));
    const start = Math.max(0, Number.parseInt(query.cursor ?? "0", 10) || 0);
    params.set("start", String(start));

    const response = await this.request(params, ctx, "search");
    if (!response.ok) return response;

    const jobs = response.data.jobs?.job ?? [];
    const items = jobs.filter(isSaraminJob).map((job) => {
      const postedAt = job["posting-date"] ?? unixToIso(job["posting-timestamp"]);
      const location = job.position?.location?.name;
      return {
        ref: {
          sourceId: this.metadata.id,
          externalId: String(job.id),
          url: job.url as string,
          canonicalUrl: canonicalizeSaraminUrl(job.url as string),
        },
        title: job.position?.title as string,
        company: job.company?.detail?.name as string,
        ...(location ? { location } : {}),
        ...(postedAt ? { postedAt } : {}),
        ...(job.keyword ? { snippet: job.keyword } : {}),
      };
    });

    const total = numberValue(response.data.jobs?.total) ?? items.length;
    const nextStart = start + 1;
    const hasNext = nextStart * count < total;
    const warnings = query.locations?.length && codes.length === 0
      ? [{ code: "UNMAPPED_LOCATION", message: "Saramin location filter was omitted because no supplied location mapped to a Saramin code" }]
      : [];

    return {
      ok: true,
      data: {
        items,
        ...(hasNext ? { nextCursor: String(nextStart) } : {}),
        fetchedAt: ctx.now,
      },
      warnings,
    };
  }

  async fetch(ref: RawPosting["ref"], ctx: SourceContext): Promise<SourceResult<RawPosting>> {
    if (ref.sourceId !== this.metadata.id) {
      return sourceError(ctx, "fetch", "VALIDATION_FAILED", "Source ref does not belong to Saramin", false, ref);
    }
    const externalId = ref.externalId;
    if (!externalId) return sourceError(ctx, "fetch", "VALIDATION_FAILED", "Saramin ref requires externalId", false, ref);

    const params = new URLSearchParams({ id: externalId, fields: "posting-date expiration-date" });
    const response = await this.request(params, ctx, "fetch");
    if (!response.ok) return response;
    const job = response.data.jobs?.job?.[0];
    if (!job || !isSaraminJob(job)) return sourceError(ctx, "fetch", "NOT_FOUND", "Saramin job was not found", false, ref);

    const rawText = buildStructuredText(job);
    return {
      ok: true,
      data: {
        ref: {
          sourceId: this.metadata.id,
          externalId: String(job.id),
          url: job.url as string,
          canonicalUrl: canonicalizeSaraminUrl(job.url as string),
        },
        fetchedAt: ctx.now,
        payload: job,
        rawText,
        rawHash: stableFingerprint(JSON.stringify(job)),
      },
      warnings: [],
    };
  }

  async normalize(raw: RawPosting, ctx: SourceContext): Promise<SourceResult<JobPostingDraft>> {
    if (!isSaraminJob(raw.payload)) {
      return sourceError(ctx, "normalize", "VALIDATION_FAILED", "Saramin raw payload is invalid", false, raw.ref);
    }
    const job = raw.payload;
    const position = job.position;
    const experience = position?.["experience-level"];
    const minYears = numberValue(experience?.min);
    const maxYears = numberValue(experience?.max);
    const postedAt = job["posting-date"] ?? unixToIso(job["posting-timestamp"]);
    const expiresAt = job["expiration-date"] ?? unixToIso(job["expiration-timestamp"]);
    const fullText = raw.rawText ?? buildStructuredText(job);

    return {
      ok: true,
      data: {
        sourceRef: raw.ref,
        company: { name: job.company?.detail?.name as string },
        title: position?.title as string,
        locations: splitList(position?.location?.name),
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: [],
        ...(position?.["job-type"]?.name ? { employmentTypes: splitList(position["job-type"].name) } : {}),
        ...(experience?.name || minYears !== undefined || maxYears !== undefined
          ? {
              experienceRequirement: {
                ...(minYears !== undefined ? { minYears } : {}),
                ...(maxYears !== undefined ? { maxYears } : {}),
                ...(experience?.name ? { rawText: experience.name } : {}),
              },
            }
          : {}),
        ...(postedAt ? { postedAt } : {}),
        ...(expiresAt ? { expiresAt } : {}),
        contentCompleteness: "partial",
        status: String(job.active) === "1" ? "open" : String(job.active) === "0" ? "closed" : "unknown",
        fullText,
        rawHash: raw.rawHash,
      },
      warnings: [{
        code: "PARTIAL_CONTENT",
        message: "Saramin Open API provides structured posting metadata, not the complete job description; verify the canonical posting before application preparation",
      }],
    };
  }
}

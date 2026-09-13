import { stableFingerprint } from "../../discovery/fingerprint.js";
import type {
  JobPostingDraft,
  ManualJobSource,
  NormalizingJobSource,
  RawPosting,
  SourceContext,
  SourceHealth,
  SourceMetadata,
  SourceResult,
} from "../source-adapter.js";

export interface ManualJobInput {
  url: string;
  externalId?: string;
  company: string;
  title: string;
  fullText: string;
  locations?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  responsibilities?: string[];
  status?: "open" | "closed" | "unknown";
}

function validationError(ctx: SourceContext, message: string): SourceResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_FAILED",
      sourceId: "manual",
      operation: "ingest",
      retryable: false,
      message,
      occurredAt: ctx.now,
    },
  };
}

function isManualJobInput(value: unknown): value is ManualJobInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<ManualJobInput>;
  return Boolean(
    typeof input.url === "string" && input.url.trim() &&
      typeof input.company === "string" && input.company.trim() &&
      typeof input.title === "string" && input.title.trim() &&
      typeof input.fullText === "string" && input.fullText.trim(),
  );
}

export class ManualSource implements ManualJobSource<ManualJobInput>, NormalizingJobSource {
  readonly metadata: SourceMetadata = {
    id: "manual",
    kind: "manual_input",
    displayName: "Manual input",
    capabilities: ["HEALTH", "MANUAL_INGEST", "NORMALIZE"],
  };

  async healthCheck(ctx: SourceContext): Promise<SourceResult<SourceHealth>> {
    return {
      ok: true,
      data: { status: "healthy", checkedAt: ctx.now },
      warnings: [],
    };
  }

  async ingest(input: ManualJobInput, ctx: SourceContext): Promise<SourceResult<RawPosting>> {
    if (!isManualJobInput(input)) return validationError(ctx, "url, company, title and fullText are required");

    const rawHash = stableFingerprint(input.fullText);
    return {
      ok: true,
      data: {
        ref: {
          sourceId: this.metadata.id,
          ...(input.externalId ? { externalId: input.externalId } : {}),
          url: input.url,
        },
        fetchedAt: ctx.now,
        payload: input,
        rawText: input.fullText,
        rawHash,
      },
      warnings: [],
    };
  }

  async normalize(raw: RawPosting, ctx: SourceContext): Promise<SourceResult<JobPostingDraft>> {
    if (!isManualJobInput(raw.payload)) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          sourceId: this.metadata.id,
          operation: "normalize",
          retryable: false,
          ref: raw.ref,
          message: "manual raw payload is invalid",
          occurredAt: ctx.now,
        },
      };
    }

    const input = raw.payload;
    return {
      ok: true,
      data: {
        sourceRef: raw.ref,
        company: { name: input.company },
        title: input.title,
        locations: input.locations ?? [],
        requiredSkills: input.requiredSkills ?? [],
        preferredSkills: input.preferredSkills ?? [],
        responsibilities: input.responsibilities ?? [],
        status: input.status ?? "unknown",
        fullText: input.fullText,
        rawHash: raw.rawHash,
      },
      warnings: [],
    };
  }
}

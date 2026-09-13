import type { DiscoveryHitRecord } from "../core/domain/discovery-hit.js";
import type { JobPosting, SourceJobRef } from "../core/domain/job-posting.js";
import type { EntityStore } from "../storage/store.js";
import type { JobPostingDraft } from "../sources/source-adapter.js";
import { stableFingerprint } from "./fingerprint.js";
import { materializeJobPosting } from "./orchestrator.js";
import { persistDiscoveredJobs, type PersistDiscoveryResult } from "./persistence.js";

export interface VerifiedPostingInput {
  sourceUrl: string;
  company: string;
  title: string;
  fullText: string;
  contentCompleteness: "full" | "partial";
  locations?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  responsibilities?: string[];
  employmentTypes?: string[];
  experienceRequirement?: {
    minYears?: number;
    maxYears?: number;
    rawText?: string;
  };
  postedAt?: string;
  expiresAt?: string;
  status?: "open" | "closed" | "unknown";
}

export interface MaterializeDiscoveryHitResult {
  hit: DiscoveryHitRecord;
  job: JobPosting;
  persistence: PersistDiscoveryResult;
  idempotent: boolean;
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must be a non-empty string`);
  return trimmed;
}

function canonicalizeUrl(raw: string): string {
  const url = new URL(requireText(raw, "sourceUrl"));
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("sourceUrl must use http or https");
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith("utm_") || normalized === "ref" || normalized === "source") {
      url.searchParams.delete(key);
    }
  }
  return url.toString().replace(/\/$/, "");
}

function sameRef(left: SourceJobRef, right: SourceJobRef): boolean {
  if (left.sourceId !== right.sourceId) return false;
  if (left.externalId && right.externalId) return left.externalId === right.externalId;
  return (left.canonicalUrl ?? left.url) === (right.canonicalUrl ?? right.url);
}

function verifiedSourceRef(hit: DiscoveryHitRecord, input: VerifiedPostingInput): SourceJobRef {
  const canonicalUrl = canonicalizeUrl(input.sourceUrl);
  return {
    sourceId: `verified-page:${hit.sourceId}`,
    url: input.sourceUrl.trim(),
    canonicalUrl,
  };
}

function toDraft(hit: DiscoveryHitRecord, input: VerifiedPostingInput): JobPostingDraft {
  const company = requireText(input.company, "company");
  const title = requireText(input.title, "title");
  const fullText = requireText(input.fullText, "fullText");
  return {
    sourceRef: verifiedSourceRef(hit, input),
    company: { name: company },
    title,
    locations: input.locations ?? [],
    requiredSkills: input.requiredSkills ?? [],
    preferredSkills: input.preferredSkills ?? [],
    responsibilities: input.responsibilities ?? [],
    ...(input.employmentTypes ? { employmentTypes: input.employmentTypes } : {}),
    ...(input.experienceRequirement ? { experienceRequirement: input.experienceRequirement } : {}),
    ...(input.postedAt ? { postedAt: input.postedAt } : {}),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    contentCompleteness: input.contentCompleteness,
    status: input.status ?? "unknown",
    fullText,
    rawHash: stableFingerprint(fullText),
  };
}

export async function materializeDiscoveryHit(input: {
  hitId: string;
  verifiedPosting: VerifiedPostingInput;
  discoveryHitStore: EntityStore<DiscoveryHitRecord>;
  jobStore: EntityStore<JobPosting>;
  now: string;
}): Promise<MaterializeDiscoveryHitResult> {
  const hitId = requireText(input.hitId, "hitId");
  const hit = await input.discoveryHitStore.get(hitId);
  if (!hit) throw new Error(`discovery hit not found: ${hitId}`);

  if (hit.status === "MATERIALIZED" && hit.materializedJobId) {
    const existingJob = await input.jobStore.get(hit.materializedJobId);
    if (!existingJob) throw new Error(`materialized job missing for discovery hit ${hitId}: ${hit.materializedJobId}`);
    return {
      hit,
      job: existingJob,
      persistence: { created: 0, updated: 0, possibleDuplicates: [], persistedJobIds: [existingJob.id] },
      idempotent: true,
    };
  }

  const draft = toDraft(hit, input.verifiedPosting);
  const materialized = materializeJobPosting(draft, input.now);
  const sourceRefs = [hit.sourceRef];
  for (const ref of materialized.sourceRefs) {
    if (!sourceRefs.some((existing) => sameRef(existing, ref))) sourceRefs.push(ref);
  }
  const incomingJob: JobPosting = { ...materialized, sourceRefs };

  const persistence = await persistDiscoveredJobs({
    store: input.jobStore,
    jobs: [incomingJob],
    now: input.now,
  });
  const persistedJobId = persistence.persistedJobIds[0];
  if (!persistedJobId) throw new Error(`failed to persist materialized job for discovery hit ${hitId}`);
  const job = await input.jobStore.get(persistedJobId);
  if (!job) throw new Error(`persisted job missing after materialization: ${persistedJobId}`);

  const verifiedUrl = canonicalizeUrl(input.verifiedPosting.sourceUrl);
  const updatedHit: DiscoveryHitRecord = {
    ...hit,
    status: "MATERIALIZED",
    materializedJobId: job.id,
    verification: {
      method: "client_fetched_page",
      sourceUrl: verifiedUrl,
      verifiedAt: input.now,
      contentHash: stableFingerprint(input.verifiedPosting.fullText),
    },
  };
  await input.discoveryHitStore.put(hit.hitId, updatedHit);

  return { hit: updatedHit, job, persistence, idempotent: false };
}

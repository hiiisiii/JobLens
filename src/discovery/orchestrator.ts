import type { JobPosting } from "../core/domain/job-posting.js";
import type {
  DetailJobSource,
  JobPostingDraft,
  JobSource,
  NormalizingJobSource,
  SearchableJobSource,
  SearchHit,
  SearchQuery,
  SourceContext,
  SourceError,
  SourceWarning,
} from "../sources/source-adapter.js";
import { assessDuplicate, type DuplicateAssessment } from "./dedupe.js";
import { normalizeTextKey, stableFingerprint } from "./fingerprint.js";

export interface DiscoverySourceFailure {
  sourceId: string;
  stage: "search" | "fetch" | "normalize";
  error: SourceError;
}

export interface PossibleDuplicate {
  leftJobId: string;
  rightJobId: string;
  assessment: DuplicateAssessment;
}

export interface DiscoveryResult {
  jobs: JobPosting[];
  discoveredHits: Array<SearchHit & { sourceId: string }>;
  sourceFailures: DiscoverySourceFailure[];
  warnings: Array<SourceWarning & { sourceId: string }>;
  possibleDuplicates: PossibleDuplicate[];
  searchedSources: string[];
}

type DiscoverySource = JobSource & Partial<SearchableJobSource & DetailJobSource & NormalizingJobSource>;

function hasCapability(source: JobSource, capability: string): boolean {
  return source.metadata.capabilities.includes(capability as never);
}

function isSearchable(source: DiscoverySource): source is DiscoverySource & SearchableJobSource {
  return hasCapability(source, "SEARCH") && typeof source.search === "function";
}

function canMaterialize(source: DiscoverySource): source is DiscoverySource & DetailJobSource & NormalizingJobSource {
  return hasCapability(source, "DETAIL") && hasCapability(source, "NORMALIZE") &&
    typeof source.fetch === "function" && typeof source.normalize === "function";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function draftId(draft: JobPostingDraft): string {
  const identity = draft.sourceRef.externalId ?? draft.sourceRef.canonicalUrl ?? draft.sourceRef.url;
  return `job:${stableFingerprint(`${draft.sourceRef.sourceId}:${identity}`)}`;
}

export function materializeJobPosting(draft: JobPostingDraft, now: string): JobPosting {
  return {
    id: draftId(draft),
    sourceRefs: [draft.sourceRef],
    companyName: draft.company.name,
    ...(draft.company.normalizedName ? { normalizedCompanyName: draft.company.normalizedName } : {}),
    title: draft.title,
    ...(draft.normalizedTitle ? { normalizedTitle: draft.normalizedTitle } : {}),
    locations: draft.locations,
    requiredSkills: draft.requiredSkills,
    preferredSkills: draft.preferredSkills,
    ...(draft.employmentTypes ? { employmentTypes: draft.employmentTypes } : {}),
    ...(draft.experienceRequirement ? { experienceRequirement: draft.experienceRequirement } : {}),
    ...(draft.postedAt ? { postedAt: draft.postedAt } : {}),
    ...(draft.expiresAt ? { expiresAt: draft.expiresAt } : {}),
    ...(draft.contentCompleteness ? { contentCompleteness: draft.contentCompleteness } : {}),
    status: draft.status,
    fullText: draft.fullText,
    fingerprint: draft.rawHash || stableFingerprint(draft.fullText),
    discoveredAt: now,
    updatedAt: now,
  };
}

function mergeJobs(left: JobPosting, right: JobPosting, now: string): JobPosting {
  const sourceRefs = [...left.sourceRefs];
  for (const ref of right.sourceRefs) {
    const exists = sourceRefs.some((current) =>
      current.sourceId === ref.sourceId &&
      (current.externalId && ref.externalId
        ? current.externalId === ref.externalId
        : current.url === ref.url),
    );
    if (!exists) sourceRefs.push(ref);
  }

  const preferRightText = right.fullText.length > left.fullText.length;
  const completeness = left.contentCompleteness === "full" || right.contentCompleteness === "full"
    ? "full"
    : left.contentCompleteness === "partial" || right.contentCompleteness === "partial"
      ? "partial"
      : left.contentCompleteness ?? right.contentCompleteness;

  return {
    ...left,
    sourceRefs,
    locations: unique([...left.locations, ...right.locations]),
    requiredSkills: unique([...left.requiredSkills, ...right.requiredSkills]),
    preferredSkills: unique([...left.preferredSkills, ...right.preferredSkills]),
    ...(left.employmentTypes || right.employmentTypes
      ? { employmentTypes: unique([...(left.employmentTypes ?? []), ...(right.employmentTypes ?? [])]) }
      : {}),
    ...(left.experienceRequirement ?? right.experienceRequirement
      ? { experienceRequirement: left.experienceRequirement ?? right.experienceRequirement }
      : {}),
    ...(left.postedAt ?? right.postedAt ? { postedAt: left.postedAt ?? right.postedAt } : {}),
    ...(left.expiresAt ?? right.expiresAt ? { expiresAt: left.expiresAt ?? right.expiresAt } : {}),
    ...(completeness ? { contentCompleteness: completeness } : {}),
    status: left.status === "open" || right.status === "open"
      ? "open"
      : left.status === "closed" && right.status === "closed"
        ? "closed"
        : "unknown",
    fullText: preferRightText ? right.fullText : left.fullText,
    updatedAt: now,
  };
}

function mergeOrAppend(
  jobs: JobPosting[],
  incoming: JobPosting,
  possibleDuplicates: PossibleDuplicate[],
  now: string,
): void {
  for (let index = 0; index < jobs.length; index += 1) {
    const current = jobs[index];
    if (!current) continue;
    const assessment = assessDuplicate(current, incoming);
    if (assessment.autoMerge) {
      jobs[index] = mergeJobs(current, incoming, now);
      return;
    }
    if (assessment.confidence === "POSSIBLE") {
      possibleDuplicates.push({
        leftJobId: current.id,
        rightJobId: incoming.id,
        assessment,
      });
    }
  }
  jobs.push(incoming);
}

export async function discoverJobs(input: {
  sources: DiscoverySource[];
  query: SearchQuery;
  context: SourceContext;
}): Promise<DiscoveryResult> {
  const jobs: JobPosting[] = [];
  const discoveredHits: Array<SearchHit & { sourceId: string }> = [];
  const sourceFailures: DiscoverySourceFailure[] = [];
  const warnings: Array<SourceWarning & { sourceId: string }> = [];
  const possibleDuplicates: PossibleDuplicate[] = [];
  const searchedSources: string[] = [];

  for (const source of input.sources) {
    if (!isSearchable(source)) continue;
    searchedSources.push(source.metadata.id);

    const searchResult = await source.search(input.query, input.context);
    if (!searchResult.ok) {
      sourceFailures.push({ sourceId: source.metadata.id, stage: "search", error: searchResult.error });
      continue;
    }
    for (const warning of searchResult.warnings) warnings.push({ ...warning, sourceId: source.metadata.id });
    for (const hit of searchResult.data.items) discoveredHits.push({ ...hit, sourceId: source.metadata.id });

    if (!canMaterialize(source)) continue;

    for (const hit of searchResult.data.items) {
      const fetched = await source.fetch(hit.ref, input.context);
      if (!fetched.ok) {
        sourceFailures.push({ sourceId: source.metadata.id, stage: "fetch", error: fetched.error });
        continue;
      }
      for (const warning of fetched.warnings) warnings.push({ ...warning, sourceId: source.metadata.id });

      const normalized = await source.normalize(fetched.data, input.context);
      if (!normalized.ok) {
        sourceFailures.push({ sourceId: source.metadata.id, stage: "normalize", error: normalized.error });
        continue;
      }
      for (const warning of normalized.warnings) warnings.push({ ...warning, sourceId: source.metadata.id });

      const job = materializeJobPosting(normalized.data, input.context.now);
      mergeOrAppend(jobs, job, possibleDuplicates, input.context.now);
    }
  }

  jobs.sort((a, b) => {
    const company = normalizeTextKey(a.companyName).localeCompare(normalizeTextKey(b.companyName));
    return company || normalizeTextKey(a.title).localeCompare(normalizeTextKey(b.title));
  });

  return { jobs, discoveredHits, sourceFailures, warnings, possibleDuplicates, searchedSources };
}

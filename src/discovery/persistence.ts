import type { JobPosting } from "../core/domain/job-posting.js";
import type { EntityStore } from "../storage/store.js";
import { assessDuplicate, type DuplicateAssessment } from "./dedupe.js";

export interface PersistedPossibleDuplicate {
  storedJobId: string;
  incomingJobId: string;
  assessment: DuplicateAssessment;
}

export interface PersistDiscoveryResult {
  created: number;
  updated: number;
  possibleDuplicates: PersistedPossibleDuplicate[];
  persistedJobIds: string[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function mergePersistedJob(left: JobPosting, right: JobPosting, now: string): JobPosting {
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

export async function persistDiscoveredJobs(input: {
  store: EntityStore<JobPosting>;
  jobs: JobPosting[];
  now: string;
}): Promise<PersistDiscoveryResult> {
  const stored = await input.store.list();
  let created = 0;
  let updated = 0;
  const possibleDuplicates: PersistedPossibleDuplicate[] = [];
  const persistedJobIds: string[] = [];

  for (const incoming of input.jobs) {
    let merged = false;

    for (let index = 0; index < stored.length; index += 1) {
      const existing = stored[index];
      if (!existing) continue;
      const assessment = assessDuplicate(existing, incoming);

      if (assessment.autoMerge) {
        const combined = mergePersistedJob(existing, incoming, input.now);
        await input.store.put(existing.id, combined);
        stored[index] = combined;
        persistedJobIds.push(existing.id);
        updated += 1;
        merged = true;
        break;
      }

      if (assessment.confidence === "POSSIBLE") {
        possibleDuplicates.push({
          storedJobId: existing.id,
          incomingJobId: incoming.id,
          assessment,
        });
      }
    }

    if (!merged) {
      await input.store.put(incoming.id, incoming);
      stored.push(incoming);
      persistedJobIds.push(incoming.id);
      created += 1;
    }
  }

  return { created, updated, possibleDuplicates, persistedJobIds };
}

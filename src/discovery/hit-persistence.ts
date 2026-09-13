import type { DiscoveryHitRecord } from "../core/domain/discovery-hit.js";
import type { JobPosting, SourceJobRef } from "../core/domain/job-posting.js";
import type { EntityStore } from "../storage/store.js";
import type { SearchHit, SearchQuery } from "../sources/source-adapter.js";
import { stableFingerprint } from "./fingerprint.js";

function refIdentity(ref: SourceJobRef): string {
  return ref.externalId ?? ref.canonicalUrl ?? ref.url;
}

function sameRef(left: SourceJobRef, right: SourceJobRef): boolean {
  if (left.sourceId !== right.sourceId) return false;
  if (left.externalId && right.externalId) return left.externalId === right.externalId;
  return (left.canonicalUrl ?? left.url) === (right.canonicalUrl ?? right.url);
}

function queryKey(query: SearchQuery): string {
  const normalized = {
    keywords: [...query.keywords].map((value) => value.trim()).filter(Boolean).sort(),
    locations: [...(query.locations ?? [])].map((value) => value.trim()).filter(Boolean).sort(),
    targetRoles: [...(query.targetRoles ?? [])].map((value) => value.trim()).filter(Boolean).sort(),
    postedAfter: query.postedAfter ?? null,
  };
  return `query:${stableFingerprint(JSON.stringify(normalized))}`;
}

function hitId(sourceId: string, hit: SearchHit): string {
  return `hit:${stableFingerprint(`${sourceId}:${refIdentity(hit.ref)}`)}`;
}

export interface PersistDiscoveryHitsResult {
  records: DiscoveryHitRecord[];
  created: number;
  updated: number;
}

export async function persistDiscoveryHits(input: {
  store: EntityStore<DiscoveryHitRecord>;
  hits: Array<SearchHit & { sourceId: string }>;
  jobs: JobPosting[];
  query: SearchQuery;
  now: string;
}): Promise<PersistDiscoveryHitsResult> {
  const records: DiscoveryHitRecord[] = [];
  let created = 0;
  let updated = 0;
  const key = queryKey(input.query);

  for (const hit of input.hits) {
    const id = hitId(hit.sourceId, hit);
    const existing = await input.store.get(id);
    const materialized = input.jobs.find((job) => job.sourceRefs.some((ref) => sameRef(ref, hit.ref)));
    const record: DiscoveryHitRecord = {
      ...(existing ?? {
        hitId: id,
        sourceId: hit.sourceId,
        sourceRef: hit.ref,
        queryKey: key,
        status: "DISCOVERED" as const,
        discoveredAt: input.now,
        lastSeenAt: input.now,
      }),
      sourceId: hit.sourceId,
      sourceRef: hit.ref,
      queryKey: key,
      ...(hit.title ? { title: hit.title } : {}),
      ...(hit.company ? { company: hit.company } : {}),
      ...(hit.location ? { location: hit.location } : {}),
      ...(hit.postedAt ? { postedAt: hit.postedAt } : {}),
      ...(hit.snippet ? { snippet: hit.snippet } : {}),
      status: materialized ? "MATERIALIZED" : existing?.status ?? "DISCOVERED",
      ...(materialized ? { materializedJobId: materialized.id } : existing?.materializedJobId ? { materializedJobId: existing.materializedJobId } : {}),
      lastSeenAt: input.now,
    };
    await input.store.put(id, record);
    records.push(record);
    if (existing) updated += 1;
    else created += 1;
  }

  return { records, created, updated };
}

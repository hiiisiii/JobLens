import type { SourceJobRef } from "./job-posting.js";

export type DiscoveryHitStatus = "DISCOVERED" | "MATERIALIZED";

export interface DiscoveryHitRecord {
  hitId: string;
  sourceId: string;
  sourceRef: SourceJobRef;
  queryKey: string;
  title?: string;
  company?: string;
  location?: string;
  postedAt?: string;
  snippet?: string;
  status: DiscoveryHitStatus;
  materializedJobId?: string;
  discoveredAt: string;
  lastSeenAt: string;
}

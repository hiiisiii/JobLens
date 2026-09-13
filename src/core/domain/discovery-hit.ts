import type { SourceJobRef } from "./job-posting.js";

export type DiscoveryHitStatus = "DISCOVERED" | "MATERIALIZED";

export interface DiscoveryHitVerification {
  method: "client_fetched_page";
  sourceUrl: string;
  verifiedAt: string;
  contentHash: string;
}

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
  verification?: DiscoveryHitVerification;
  discoveredAt: string;
  lastSeenAt: string;
}

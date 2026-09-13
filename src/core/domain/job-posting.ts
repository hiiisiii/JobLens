import type { ISODateTime } from "./common.js";

export interface SourceJobRef {
  sourceId: string;
  externalId?: string;
  url: string;
  canonicalUrl?: string;
}

export interface JobPosting {
  id: string;
  sourceRefs: SourceJobRef[];
  companyName: string;
  normalizedCompanyName?: string;
  title: string;
  normalizedTitle?: string;
  locations: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceRequirement?: {
    minYears?: number;
    maxYears?: number;
    rawText?: string;
  };
  status: "open" | "closed" | "unknown";
  fullText: string;
  fingerprint: string;
  discoveredAt: ISODateTime;
  updatedAt: ISODateTime;
}

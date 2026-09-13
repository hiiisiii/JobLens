import type { JobPosting, SourceJobRef } from "../core/domain/job-posting.js";
import { normalizeTextKey } from "./fingerprint.js";

export type DuplicateConfidence = "EXACT" | "LIKELY" | "POSSIBLE" | "DISTINCT";

export interface DuplicateAssessment {
  confidence: DuplicateConfidence;
  autoMerge: boolean;
  reasons: string[];
}

function refIdentity(ref: SourceJobRef): string | undefined {
  if (!ref.externalId) return undefined;
  return `${ref.sourceId}:${ref.externalId}`;
}

function canonicalUrl(ref: SourceJobRef): string {
  const raw = ref.canonicalUrl ?? ref.url;
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || key === "ref" || key === "source") {
        url.searchParams.delete(key);
      }
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.replace(/\/$/, "");
  }
}

function locationsOverlap(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  const rightKeys = new Set(right.map(normalizeTextKey));
  return left.some((location) => rightKeys.has(normalizeTextKey(location)));
}

export function assessDuplicate(left: JobPosting, right: JobPosting): DuplicateAssessment {
  const leftIds = new Set(left.sourceRefs.map(refIdentity).filter((value): value is string => Boolean(value)));
  if (right.sourceRefs.some((ref) => {
    const id = refIdentity(ref);
    return id ? leftIds.has(id) : false;
  })) {
    return { confidence: "EXACT", autoMerge: true, reasons: ["same source external id"] };
  }

  const leftUrls = new Set(left.sourceRefs.map(canonicalUrl));
  if (right.sourceRefs.some((ref) => leftUrls.has(canonicalUrl(ref)))) {
    return { confidence: "EXACT", autoMerge: true, reasons: ["same canonical url"] };
  }

  if (left.fingerprint && left.fingerprint === right.fingerprint) {
    return { confidence: "LIKELY", autoMerge: true, reasons: ["same content fingerprint"] };
  }

  const sameCompany = normalizeTextKey(left.companyName) === normalizeTextKey(right.companyName);
  const sameTitle = normalizeTextKey(left.title) === normalizeTextKey(right.title);
  if (sameCompany && sameTitle) {
    const reasons = ["same normalized company and title"];
    if (locationsOverlap(left.locations, right.locations)) reasons.push("overlapping location");
    return { confidence: "POSSIBLE", autoMerge: false, reasons };
  }

  return { confidence: "DISTINCT", autoMerge: false, reasons: [] };
}

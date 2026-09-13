import type { ISODateTime } from "./common.js";

export interface EvidenceBackedSkill {
  name: string;
  level?: string;
  evidenceIds: string[];
}

export interface CandidateProfile {
  profileId: string;
  version: string;
  updatedAt: ISODateTime;
  targetRoles: string[];
  targetLevels: string[];
  skills: EvidenceBackedSkill[];
  locations: string[];
  mustHaves: string[];
  dealBreakers: string[];
  documentRefs: string[];
}

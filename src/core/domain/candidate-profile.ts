import type { ISODateTime } from "./common.js";

export interface EvidenceBackedSkill {
  name: string;
  level?: string;
  evidenceIds: string[];
}

export interface ExperienceEvidence {
  experienceId: string;
  title: string;
  summary: string;
  capabilities: string[];
  technologies: string[];
  evidenceIds: string[];
}

export interface CandidateProfile {
  profileId: string;
  version: string;
  updatedAt: ISODateTime;
  targetRoles: string[];
  targetLevels: string[];
  skills: EvidenceBackedSkill[];
  experienceEvidence?: ExperienceEvidence[];
  locations: string[];
  mustHaves: string[];
  dealBreakers: string[];
  documentRefs: string[];
}

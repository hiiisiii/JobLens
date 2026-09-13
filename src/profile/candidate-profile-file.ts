import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { CandidateProfile, EvidenceBackedSkill } from "../core/domain/candidate-profile.js";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSkill(value: unknown): value is EvidenceBackedSkill {
  if (!value || typeof value !== "object") return false;
  const skill = value as Partial<EvidenceBackedSkill>;
  return typeof skill.name === "string" && skill.name.trim().length > 0 && isStringArray(skill.evidenceIds);
}

export function validateCandidateProfile(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["profile must be an object"];
  const profile = value as Partial<CandidateProfile>;
  const errors: string[] = [];

  if (typeof profile.profileId !== "string" || !profile.profileId.trim()) errors.push("profileId must be a non-empty string");
  if (typeof profile.version !== "string" || !profile.version.trim()) errors.push("version must be a non-empty string");
  if (typeof profile.updatedAt !== "string" || Number.isNaN(Date.parse(profile.updatedAt))) errors.push("updatedAt must be an ISO-compatible date string");
  if (!isStringArray(profile.targetRoles)) errors.push("targetRoles must be a string array");
  if (!isStringArray(profile.targetLevels)) errors.push("targetLevels must be a string array");
  if (!Array.isArray(profile.skills) || !profile.skills.every(isSkill)) errors.push("skills must contain { name, evidenceIds[] } objects");
  if (!isStringArray(profile.locations)) errors.push("locations must be a string array");
  if (!isStringArray(profile.mustHaves)) errors.push("mustHaves must be a string array");
  if (!isStringArray(profile.dealBreakers)) errors.push("dealBreakers must be a string array");
  if (!isStringArray(profile.documentRefs)) errors.push("documentRefs must be a string array");

  return errors;
}

export function parseCandidateProfile(value: unknown): CandidateProfile {
  const errors = validateCandidateProfile(value);
  if (errors.length > 0) throw new Error(`invalid candidate profile: ${errors.join("; ")}`);
  return value as CandidateProfile;
}

export async function readCandidateProfileFile(path: string): Promise<CandidateProfile> {
  const raw = await readFile(path, "utf8");
  return parseCandidateProfile(JSON.parse(raw) as unknown);
}

export async function writeCandidateProfileFile(path: string, profile: CandidateProfile, options?: { replace?: boolean }): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(profile, null, 2)}\n`, {
    encoding: "utf8",
    flag: options?.replace ? "w" : "wx",
  });
}

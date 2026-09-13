import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Application } from "../core/domain/application.js";
import type { CompanyResearch } from "../core/domain/company-research.js";
import type { JobPosting } from "../core/domain/job-posting.js";
import type { JobEvaluation, Opportunity } from "../core/domain/opportunity.js";
import type { SourceEvidence } from "../core/domain/source-evidence.js";
import { JsonDirectoryStore } from "../storage/json-directory-store.js";

export interface WorkspaceStores {
  jobs: JsonDirectoryStore<JobPosting>;
  evaluations: JsonDirectoryStore<JobEvaluation>;
  opportunities: JsonDirectoryStore<Opportunity>;
  research: JsonDirectoryStore<CompanyResearch>;
  evidence: JsonDirectoryStore<SourceEvidence>;
  applications: JsonDirectoryStore<Application>;
}

const PRIVATE_DIRECTORIES = [
  "profile",
  "documents",
  "jobs",
  "evaluations",
  "opportunities",
  "research",
  "evidence",
  "applications",
  "tracker",
  "cache",
  "logs",
  "tmp",
] as const;

export async function initializeWorkspace(rootDir: string): Promise<WorkspaceStores> {
  if (!rootDir.trim()) throw new Error("workspace root must not be empty");
  await Promise.all(PRIVATE_DIRECTORIES.map((directory) => mkdir(join(rootDir, directory), { recursive: true })));

  return {
    jobs: new JsonDirectoryStore<JobPosting>(join(rootDir, "jobs")),
    evaluations: new JsonDirectoryStore<JobEvaluation>(join(rootDir, "evaluations")),
    opportunities: new JsonDirectoryStore<Opportunity>(join(rootDir, "opportunities")),
    research: new JsonDirectoryStore<CompanyResearch>(join(rootDir, "research")),
    evidence: new JsonDirectoryStore<SourceEvidence>(join(rootDir, "evidence")),
    applications: new JsonDirectoryStore<Application>(join(rootDir, "applications")),
  };
}

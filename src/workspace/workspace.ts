import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Application } from "../core/domain/application.js";
import type { JobPosting } from "../core/domain/job-posting.js";
import type { Opportunity } from "../core/domain/opportunity.js";
import { JsonDirectoryStore } from "../storage/json-directory-store.js";

export interface WorkspaceStores {
  jobs: JsonDirectoryStore<JobPosting>;
  opportunities: JsonDirectoryStore<Opportunity>;
  applications: JsonDirectoryStore<Application>;
}

const PRIVATE_DIRECTORIES = [
  "profile",
  "documents",
  "jobs",
  "opportunities",
  "research",
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
    opportunities: new JsonDirectoryStore<Opportunity>(join(rootDir, "opportunities")),
    applications: new JsonDirectoryStore<Application>(join(rootDir, "applications")),
  };
}

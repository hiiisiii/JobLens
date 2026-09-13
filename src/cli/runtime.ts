import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CandidateProfile } from "../core/domain/candidate-profile.js";
import { initializeWorkspace } from "../workspace/workspace.js";
import { rankJobs } from "../ranking/job-ranker.js";
import { ManualSource, type ManualJobInput } from "../sources/manual/manual-source.js";
import type { SourceContext } from "../sources/source-adapter.js";
import { materializeJobPosting } from "../discovery/orchestrator.js";

export interface CliEnvironment {
  JOBLENS_WORKSPACE?: string;
}

function workspaceRoot(env: CliEnvironment): string {
  return resolve(env.JOBLENS_WORKSPACE ?? ".joblens-workspace");
}

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function loadProfile(root: string): Promise<CandidateProfile> {
  return loadJson<CandidateProfile>(join(root, "profile", "candidate-profile.json"));
}

export async function setupCommand(env: CliEnvironment): Promise<string> {
  const root = workspaceRoot(env);
  await initializeWorkspace(root);
  const profilePath = join(root, "profile", "candidate-profile.json");
  try {
    await readFile(profilePath, "utf8");
    return `workspace ready: ${root}\nprofile preserved: ${profilePath}`;
  } catch {
    const now = new Date().toISOString();
    const sample: CandidateProfile = {
      profileId: "candidate",
      version: "v1",
      updatedAt: now,
      targetRoles: [],
      targetLevels: [],
      skills: [],
      locations: [],
      mustHaves: [],
      dealBreakers: [],
      documentRefs: [],
    };
    await writeFile(profilePath, `${JSON.stringify(sample, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return `workspace initialized: ${root}\nedit profile: ${profilePath}`;
  }
}

export async function discoverManualCommand(args: string[], env: CliEnvironment): Promise<string> {
  const inputPath = args[0];
  if (!inputPath) throw new Error("discover requires a manual posting JSON file path in alpha.3");
  const root = workspaceRoot(env);
  const stores = await initializeWorkspace(root);
  const input = await loadJson<ManualJobInput>(resolve(inputPath));
  const source = new ManualSource();
  const now = new Date().toISOString();
  const context: SourceContext = {
    requestId: `cli-${Date.now()}`,
    now,
    timeoutMs: 15_000,
  };
  const ingested = await source.ingest(input, context);
  if (!ingested.ok) throw new Error(ingested.error.message);
  const normalized = await source.normalize(ingested.data, context);
  if (!normalized.ok) throw new Error(normalized.error.message);
  const job = materializeJobPosting(normalized.data, now);
  await stores.jobs.put(job.id, job);
  return `discovered and persisted 1 job\n${job.id}  ${job.companyName} — ${job.title}`;
}

export async function rankCommand(env: CliEnvironment): Promise<string> {
  const root = workspaceRoot(env);
  const stores = await initializeWorkspace(root);
  const profile = await loadProfile(root);
  const jobs = await stores.jobs.list();
  const ranked = rankJobs(jobs, profile);
  if (ranked.length === 0) return "no persisted jobs to rank";
  return ranked.map(({ job, assessment }, index) => {
    const score = assessment.fitScore === undefined ? "—" : String(assessment.fitScore);
    return `${index + 1}. [${assessment.hardGate}] ${score}/100 (${assessment.confidence}) ${job.companyName} — ${job.title}`;
  }).join("\n");
}

export async function executeCommand(command: string, args: string[], env: CliEnvironment = process.env): Promise<string> {
  if (command === "setup") return setupCommand(env);
  if (command === "discover") return discoverManualCommand(args, env);
  if (command === "rank") return rankCommand(env);
  throw new Error(`${command} is defined but not executable yet`);
}

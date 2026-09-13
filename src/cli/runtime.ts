import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CandidateProfile } from "../core/domain/candidate-profile.js";
import type { ApplicationPackage } from "../core/domain/application-package.js";
import { resolveRuntimeConfig, type RuntimeEnvironment } from "../config/runtime-config.js";
import { initializeWorkspace } from "../workspace/workspace.js";
import { rankAndPersistJobs } from "../ranking/ranking-service.js";
import { persistResearch, type ResearchImportInput } from "../research/research-service.js";
import { prepareApplication, type PrepareApplicationInput } from "../application/preparation-service.js";
import { reviewApplication, type ReviewInput } from "../application/review-service.js";
import { ManualSource, type ManualJobInput } from "../sources/manual/manual-source.js";
import { SaraminSource } from "../sources/saramin/saramin-source.js";
import type { SourceContext } from "../sources/source-adapter.js";
import { materializeDiscoveryHit, type VerifiedPostingInput } from "../discovery/materialization-service.js";
import { materializeJobPosting } from "../discovery/orchestrator.js";
import { runDiscovery } from "../discovery/discovery-service.js";
import { readCandidateProfileFile, writeCandidateProfileFile } from "../profile/candidate-profile-file.js";
import { parseDiscoverRequest } from "./discovery-options.js";
import { outcomeCommand } from "./outcome-command.js";

export interface CliEnvironment extends RuntimeEnvironment {}

function workspaceRoot(env: CliEnvironment): string {
  return resolve(env.JOBLENS_WORKSPACE ?? ".joblens-workspace");
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function loadProfile(root: string): Promise<CandidateProfile> {
  return readCandidateProfileFile(join(root, "profile", "candidate-profile.json"));
}

export async function setupCommand(args: string[], env: CliEnvironment): Promise<string> {
  const root = workspaceRoot(env);
  await initializeWorkspace(root);
  const profilePath = join(root, "profile", "candidate-profile.json");
  const importPath = optionValue(args, "--profile");
  const replace = args.includes("--replace");

  if (args.includes("--profile") && !importPath) throw new Error("--profile requires a JSON file path");

  if (importPath) {
    const profile = await readCandidateProfileFile(resolve(importPath));
    try {
      await writeCandidateProfileFile(profilePath, profile, { replace });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`candidate profile already exists at ${profilePath}; use --replace to overwrite it`);
      }
      throw error;
    }
    return `workspace ready: ${root}\nprofile imported: ${profilePath}\nprofile version: ${profile.version}`;
  }

  try {
    await readCandidateProfileFile(profilePath);
    return `workspace ready: ${root}\nprofile preserved: ${profilePath}`;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
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
    await writeCandidateProfileFile(profilePath, sample);
    return `workspace initialized: ${root}\nedit profile: ${profilePath}`;
  }
}

async function discoverManual(path: string, env: CliEnvironment): Promise<string> {
  const root = workspaceRoot(env);
  const stores = await initializeWorkspace(root);
  const input = await loadJson<ManualJobInput>(resolve(path));
  const source = new ManualSource();
  const now = new Date().toISOString();
  const config = resolveRuntimeConfig({ workspaceDir: root }, env);
  const context: SourceContext = {
    requestId: `cli-${Date.now()}`,
    now,
    timeoutMs: config.sourceTimeoutMs,
  };
  const ingested = await source.ingest(input, context);
  if (!ingested.ok) throw new Error(ingested.error.message);
  const normalized = await source.normalize(ingested.data, context);
  if (!normalized.ok) throw new Error(normalized.error.message);
  const job = materializeJobPosting(normalized.data, now);
  await stores.jobs.put(job.id, job);
  return `discovered and persisted 1 job\n${job.id}  ${job.companyName} — ${job.title}`;
}

async function discoverSaramin(args: string[], env: CliEnvironment): Promise<string> {
  const request = parseDiscoverRequest(args);
  if (request.kind !== "saramin") throw new Error("internal discover routing error");

  const root = workspaceRoot(env);
  const stores = await initializeWorkspace(root);
  const config = resolveRuntimeConfig({ workspaceDir: root }, env);
  if (!config.sources.saramin.accessKey) {
    throw new Error("Saramin discovery requires SARAMIN_ACCESS_KEY in the environment");
  }

  const now = new Date().toISOString();
  const context: SourceContext = {
    requestId: `cli-${Date.now()}`,
    now,
    timeoutMs: config.sourceTimeoutMs,
  };
  const source = new SaraminSource({ accessKey: config.sources.saramin.accessKey });
  const result = await runDiscovery({
    sources: [source],
    query: request.query,
    context,
    jobStore: stores.jobs,
    discoveryHitStore: stores.discoveryHits,
  });

  if (result.discovery.jobs.length === 0 && result.discovery.sourceFailures.length > 0) {
    const failure = result.discovery.sourceFailures[0];
    throw new Error(`Saramin discovery failed: ${failure?.error.code ?? "UNKNOWN"}: ${failure?.error.message ?? "unknown error"}`);
  }

  const lines = [
    `Saramin discovery complete: ${result.discovery.jobs.length} materialized job(s)`,
    `persisted: ${result.persistence.created} created, ${result.persistence.updated} updated`,
    `discovery hits: ${result.hits.created} created, ${result.hits.updated} updated`,
  ];
  if (result.discovery.warnings.length > 0) lines.push(`warnings: ${result.discovery.warnings.length}`);
  if (result.persistence.possibleDuplicates.length > 0) lines.push(`possible duplicates: ${result.persistence.possibleDuplicates.length}`);
  return lines.join("\n");
}

export async function discoverCommand(args: string[], env: CliEnvironment): Promise<string> {
  const request = parseDiscoverRequest(args);
  if (request.kind === "manual") return discoverManual(request.path, env);
  return discoverSaramin(args, env);
}

export async function materializeCommand(args: string[], env: CliEnvironment): Promise<string> {
  const hitId = args[0];
  if (!hitId || hitId.startsWith("--")) throw new Error("materialize requires a discovery hit id as the first argument");
  const inputPath = optionValue(args, "--input");
  if (!inputPath || inputPath.startsWith("--")) throw new Error("materialize requires --input <verified-posting.json>");

  const root = workspaceRoot(env);
  const stores = await initializeWorkspace(root);
  const verifiedPosting = await loadJson<VerifiedPostingInput>(resolve(inputPath));
  const result = await materializeDiscoveryHit({
    hitId,
    verifiedPosting,
    discoveryHitStore: stores.discoveryHits,
    jobStore: stores.jobs,
    now: new Date().toISOString(),
  });

  return [
    `discovery hit: ${result.hit.hitId} -> ${result.hit.status}`,
    `job: ${result.job.id}  ${result.job.companyName} — ${result.job.title}`,
    `persistence: ${result.persistence.created} created, ${result.persistence.updated} updated`,
    `idempotent: ${result.idempotent}`,
  ].join("\n");
}

export async function rankCommand(env: CliEnvironment): Promise<string> {
  const root = workspaceRoot(env);
  const stores = await initializeWorkspace(root);
  const profile = await loadProfile(root);
  const jobs = await stores.jobs.list();
  const result = await rankAndPersistJobs({
    jobs,
    profile,
    evaluationStore: stores.evaluations,
    opportunityStore: stores.opportunities,
    now: new Date().toISOString(),
  });
  if (result.ranked.length === 0) return "no persisted jobs to rank";
  const lines = result.ranked.map(({ job, assessment }, index) => {
    const score = assessment.fitScore === undefined ? "—" : String(assessment.fitScore);
    const opportunityId = result.opportunities[index]?.opportunityId ?? "unknown-opportunity";
    return `${index + 1}. [${assessment.hardGate}] ${score}/100 (${assessment.confidence}) ${job.companyName} — ${job.title} [${opportunityId}]`;
  });
  lines.push(`opportunities: ${result.createdOpportunities} created, ${result.updatedOpportunities} updated`);
  lines.push(`evaluations persisted: ${result.evaluations.length}`);
  return lines.join("\n");
}

export async function researchCommand(args: string[], env: CliEnvironment): Promise<string> {
  const opportunityId = args[0];
  if (!opportunityId || opportunityId.startsWith("--")) throw new Error("research requires an opportunity id as the first argument");
  const inputPath = optionValue(args, "--input");
  if (!inputPath || inputPath.startsWith("--")) throw new Error("research requires --input <research.json>");

  const root = workspaceRoot(env);
  const stores = await initializeWorkspace(root);
  const researchInput = await loadJson<ResearchImportInput>(resolve(inputPath));
  const result = await persistResearch({
    opportunityId,
    researchInput,
    opportunityStore: stores.opportunities,
    jobStore: stores.jobs,
    researchStore: stores.research,
    evidenceStore: stores.evidence,
    now: new Date().toISOString(),
  });

  return [
    `research persisted: ${result.research.researchId}`,
    `opportunity: ${result.opportunity.opportunityId} -> ${result.opportunity.state}`,
    `evidence persisted: ${result.evidence.length}`,
    `verified facts: ${result.research.verifiedFacts.length}, risks: ${result.research.risks.length}, unresolved: ${result.research.unresolvedQuestions.length}`,
  ].join("\n");
}

export async function prepareCommand(args: string[], env: CliEnvironment): Promise<string> {
  const opportunityId = args[0];
  if (!opportunityId || opportunityId.startsWith("--")) throw new Error("prepare requires an opportunity id as the first argument");
  if (!args.includes("--approve")) throw new Error("prepare requires explicit --approve confirmation");
  const inputPath = optionValue(args, "--input");
  if (!inputPath || inputPath.startsWith("--")) throw new Error("prepare requires --input <application-draft.json>");

  const root = workspaceRoot(env);
  const stores = await initializeWorkspace(root);
  const profile = await loadProfile(root);
  const draft = await loadJson<PrepareApplicationInput>(resolve(inputPath));
  const result = await prepareApplication({
    opportunityId,
    userApproved: true,
    draft,
    profile,
    opportunityStore: stores.opportunities,
    jobStore: stores.jobs,
    researchStore: stores.research,
    applicationStore: stores.applications,
    packageStore: stores.packages,
    now: new Date().toISOString(),
  });
  return [
    `application prepared: ${result.application.applicationId}`,
    `package: ${result.package.packageId}`,
    `opportunity: ${result.opportunity.opportunityId} -> ${result.opportunity.state}`,
    `artifacts: ${result.package.artifacts.length}`,
    `frozen evidence ids: ${result.package.sourceSnapshot.allowedEvidenceIds.length}`,
  ].join("\n");
}

async function latestPackageForApplication(packages: ApplicationPackage[], applicationId: string): Promise<ApplicationPackage | undefined> {
  return packages
    .filter((item) => item.applicationId === applicationId)
    .sort((left, right) => right.preparedAt.localeCompare(left.preparedAt))[0];
}

export async function reviewCommand(args: string[], env: CliEnvironment): Promise<string> {
  const applicationId = args[0];
  if (!applicationId || applicationId.startsWith("--")) throw new Error("review requires an application id as the first argument");
  const inputPath = optionValue(args, "--input");
  if (!inputPath || inputPath.startsWith("--")) throw new Error("review requires --input <review.json>");

  const root = workspaceRoot(env);
  const stores = await initializeWorkspace(root);
  const reviewInput = await loadJson<ReviewInput>(resolve(inputPath));
  const requestedPackageId = optionValue(args, "--package");
  const applicationPackage = requestedPackageId
    ? await stores.packages.get(requestedPackageId)
    : await latestPackageForApplication(await stores.packages.list(), applicationId);
  if (!applicationPackage) throw new Error(`no application package found for ${applicationId}`);

  const result = await reviewApplication({
    applicationId,
    packageId: applicationPackage.packageId,
    reviewInput,
    applicationStore: stores.applications,
    packageStore: stores.packages,
    reviewStore: stores.reviews,
    now: new Date().toISOString(),
  });
  return [
    `review persisted: ${result.review.reviewId}`,
    `application: ${result.application.applicationId} -> ${result.application.state}`,
    `reviewer: ${result.review.reviewerStatus}`,
    `grounding blockers: ${result.review.groundingBlockers.length}`,
    `review findings: ${result.review.findings.length}`,
  ].join("\n");
}

export async function executeCommand(command: string, args: string[], env: CliEnvironment = process.env): Promise<string> {
  if (command === "setup") return setupCommand(args, env);
  if (command === "discover") return discoverCommand(args, env);
  if (command === "materialize") return materializeCommand(args, env);
  if (command === "rank") return rankCommand(env);
  if (command === "research") return researchCommand(args, env);
  if (command === "prepare") return prepareCommand(args, env);
  if (command === "review") return reviewCommand(args, env);
  if (command === "outcome") return outcomeCommand(args, env);
  throw new Error(`unknown executable command: ${command}`);
}

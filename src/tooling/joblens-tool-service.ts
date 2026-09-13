import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CandidateProfile } from "../core/domain/candidate-profile.js";
import type { ApplicationState } from "../core/domain/application.js";
import type { DiscoveryHitStatus } from "../core/domain/discovery-hit.js";
import type { OpportunityState } from "../core/domain/opportunity.js";
import type { RuntimeEnvironment } from "../config/runtime-config.js";
import { resolveRuntimeConfig } from "../config/runtime-config.js";
import { materializeJobPosting } from "../discovery/orchestrator.js";
import { runDiscovery } from "../discovery/discovery-service.js";
import { stableFingerprint } from "../discovery/fingerprint.js";
import { writeCandidateProfileFile, readCandidateProfileFile } from "../profile/candidate-profile-file.js";
import { rankAndPersistJobs } from "../ranking/ranking-service.js";
import { persistResearch, type ResearchImportInput } from "../research/research-service.js";
import { prepareApplication, type PrepareApplicationInput } from "../application/preparation-service.js";
import { reviewApplication, type ReviewInput } from "../application/review-service.js";
import { recordOutcome, type OutcomeEventInput } from "../application/outcome-service.js";
import { ProvidedSearchProvider } from "../search/provided-search-provider.js";
import type { WebSearchResultItem } from "../search/search-provider.js";
import { ManualSource, type ManualJobInput } from "../sources/manual/manual-source.js";
import { SaraminSource } from "../sources/saramin/saramin-source.js";
import type { SearchQuery, SourceContext } from "../sources/source-adapter.js";
import { WebSearchSource } from "../sources/web-search/web-search-source.js";
import { initializeWorkspace } from "../workspace/workspace.js";
import type { ApprovalClass, ToolRequestContext, ToolResponse } from "./tool-contract.js";

export type JobLensToolName =
  | "joblens_profile_get"
  | "joblens_discovery_hits_list"
  | "joblens_jobs_list"
  | "joblens_opportunities_list"
  | "joblens_opportunity_get"
  | "joblens_applications_list"
  | "joblens_application_get"
  | "joblens_setup"
  | "joblens_discover"
  | "joblens_rank"
  | "joblens_research"
  | "joblens_prepare"
  | "joblens_review"
  | "joblens_record_outcome";

export type JobLensToolCall =
  | { tool: "joblens_profile_get"; input?: Record<string, never> }
  | { tool: "joblens_discovery_hits_list"; input?: { sourceId?: string; status?: DiscoveryHitStatus; limit?: number } }
  | { tool: "joblens_jobs_list"; input?: { limit?: number } }
  | { tool: "joblens_opportunities_list"; input?: { states?: OpportunityState[]; limit?: number } }
  | { tool: "joblens_opportunity_get"; input: { opportunityId: string } }
  | { tool: "joblens_applications_list"; input?: { states?: ApplicationState[]; limit?: number } }
  | { tool: "joblens_application_get"; input: { applicationId: string } }
  | { tool: "joblens_setup"; input: { profile: CandidateProfile; replace?: boolean } }
  | {
      tool: "joblens_discover";
      input:
        | { source: "manual"; posting: ManualJobInput }
        | { source: "saramin"; query: SearchQuery }
        | { source: "web_search"; providerId: string; query: SearchQuery; results: WebSearchResultItem[] };
    }
  | { tool: "joblens_rank"; input?: { opportunityIds?: string[] } }
  | { tool: "joblens_research"; input: { opportunityId: string; researchInput: ResearchImportInput } }
  | { tool: "joblens_prepare"; input: { opportunityId: string; userApproved: true; draft: PrepareApplicationInput } }
  | { tool: "joblens_review"; input: { applicationId: string; packageId?: string; reviewInput: ReviewInput } }
  | { tool: "joblens_record_outcome"; input: { applicationId: string; event: OutcomeEventInput } };

export interface ToolTrace {
  traceId: string;
  requestId: string;
  workspaceId: string;
  tool: JobLensToolName;
  approvalClass: ApprovalClass;
  actor: ToolRequestContext["actor"];
  client?: ToolRequestContext["client"];
  occurredAt: string;
  ok: boolean;
  entityRefs: string[];
  errorCode?: string;
}

const APPROVAL: Record<JobLensToolName, ApprovalClass> = {
  joblens_profile_get: "READ_ONLY",
  joblens_discovery_hits_list: "READ_ONLY",
  joblens_jobs_list: "READ_ONLY",
  joblens_opportunities_list: "READ_ONLY",
  joblens_opportunity_get: "READ_ONLY",
  joblens_applications_list: "READ_ONLY",
  joblens_application_get: "READ_ONLY",
  joblens_setup: "LOCAL_MUTATION",
  joblens_discover: "LOCAL_MUTATION",
  joblens_rank: "LOCAL_MUTATION",
  joblens_research: "LOCAL_MUTATION",
  joblens_prepare: "EXPLICIT_DECISION",
  joblens_review: "LOCAL_MUTATION",
  joblens_record_outcome: "EXPLICIT_DECISION",
};

function requireId(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function limit<T>(items: T[], value: number | undefined): T[] {
  if (value === undefined) return items;
  if (!Number.isInteger(value) || value < 1 || value > 500) throw new Error("limit must be an integer between 1 and 500");
  return items.slice(0, value);
}

export class JobLensToolService {
  constructor(
    private readonly workspaceDir: string,
    private readonly env: RuntimeEnvironment = process.env,
  ) {
    if (!workspaceDir.trim()) throw new Error("workspaceDir must not be empty");
  }

  async invoke(call: JobLensToolCall, context: ToolRequestContext): Promise<ToolResponse<unknown>> {
    const now = new Date().toISOString();
    const entityRefs: string[] = [];
    try {
      if (!context.requestId.trim()) throw new Error("requestId must not be empty");
      if (!context.workspaceId.trim()) throw new Error("workspaceId must not be empty");
      const data = await this.execute(call, context, now, entityRefs);
      await this.writeTrace({
        traceId: `trace:${stableFingerprint(`${context.requestId}:${call.tool}:${now}:ok`)}`,
        requestId: context.requestId,
        workspaceId: context.workspaceId,
        tool: call.tool,
        approvalClass: APPROVAL[call.tool],
        actor: context.actor,
        ...(context.client ? { client: context.client } : {}),
        occurredAt: now,
        ok: true,
        entityRefs,
      });
      return { ok: true, requestId: context.requestId, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown tool execution error";
      await this.writeTrace({
        traceId: `trace:${stableFingerprint(`${context.requestId}:${call.tool}:${now}:error`)}`,
        requestId: context.requestId,
        workspaceId: context.workspaceId,
        tool: call.tool,
        approvalClass: APPROVAL[call.tool],
        actor: context.actor,
        ...(context.client ? { client: context.client } : {}),
        occurredAt: now,
        ok: false,
        entityRefs,
        errorCode: "TOOL_EXECUTION_FAILED",
      });
      return {
        ok: false,
        requestId: context.requestId,
        error: { code: "TOOL_EXECUTION_FAILED", message, retryable: false },
      };
    }
  }

  private async execute(call: JobLensToolCall, context: ToolRequestContext, now: string, entityRefs: string[]): Promise<unknown> {
    const stores = await initializeWorkspace(this.workspaceDir);
    switch (call.tool) {
      case "joblens_profile_get":
        return readCandidateProfileFile(join(this.workspaceDir, "profile", "candidate-profile.json"));
      case "joblens_discovery_hits_list": {
        let hits = await stores.discoveryHits.list();
        if (call.input?.sourceId?.trim()) hits = hits.filter((item) => item.sourceId === call.input?.sourceId?.trim());
        if (call.input?.status) hits = hits.filter((item) => item.status === call.input?.status);
        hits.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
        return limit(hits, call.input?.limit);
      }
      case "joblens_jobs_list": {
        const jobs = await stores.jobs.list();
        return limit(jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), call.input?.limit);
      }
      case "joblens_opportunities_list": {
        let opportunities = await stores.opportunities.list();
        if (call.input?.states?.length) opportunities = opportunities.filter((item) => call.input?.states?.includes(item.state));
        return limit(opportunities, call.input?.limit);
      }
      case "joblens_opportunity_get": {
        const id = requireId(call.input.opportunityId, "opportunityId");
        const opportunity = await stores.opportunities.get(id);
        if (!opportunity) throw new Error(`opportunity not found: ${id}`);
        entityRefs.push(id);
        return opportunity;
      }
      case "joblens_applications_list": {
        let applications = await stores.applications.list();
        if (call.input?.states?.length) applications = applications.filter((item) => call.input?.states?.includes(item.state));
        return limit(applications, call.input?.limit);
      }
      case "joblens_application_get": {
        const id = requireId(call.input.applicationId, "applicationId");
        const application = await stores.applications.get(id);
        if (!application) throw new Error(`application not found: ${id}`);
        entityRefs.push(id);
        return application;
      }
      case "joblens_setup": {
        const path = join(this.workspaceDir, "profile", "candidate-profile.json");
        await writeCandidateProfileFile(path, call.input.profile, { replace: call.input.replace === true });
        entityRefs.push(`profile:${call.input.profile.profileId}:${call.input.profile.version}`);
        return { profileId: call.input.profile.profileId, version: call.input.profile.version };
      }
      case "joblens_discover": {
        const config = resolveRuntimeConfig({ workspaceDir: this.workspaceDir }, this.env);
        const sourceContext: SourceContext = {
          requestId: context.requestId,
          now,
          timeoutMs: config.sourceTimeoutMs,
        };
        if (call.input.source === "manual") {
          const source = new ManualSource();
          const ingested = await source.ingest(call.input.posting, sourceContext);
          if (!ingested.ok) throw new Error(ingested.error.message);
          const normalized = await source.normalize(ingested.data, sourceContext);
          if (!normalized.ok) throw new Error(normalized.error.message);
          const job = materializeJobPosting(normalized.data, now);
          await stores.jobs.put(job.id, job);
          entityRefs.push(job.id);
          return { jobs: [job], created: 1, updated: 0 };
        }
        if (call.input.source === "web_search") {
          const provider = new ProvidedSearchProvider({ providerId: call.input.providerId, items: call.input.results });
          const result = await runDiscovery({
            sources: [new WebSearchSource(provider)],
            query: call.input.query,
            context: sourceContext,
            jobStore: stores.jobs,
            discoveryHitStore: stores.discoveryHits,
          });
          entityRefs.push(...result.hits.records.map((hit) => hit.hitId));
          return result;
        }
        if (!config.sources.saramin.accessKey) throw new Error("Saramin discovery requires SARAMIN_ACCESS_KEY in the environment");
        const result = await runDiscovery({
          sources: [new SaraminSource({ accessKey: config.sources.saramin.accessKey })],
          query: call.input.query,
          context: sourceContext,
          jobStore: stores.jobs,
          discoveryHitStore: stores.discoveryHits,
        });
        entityRefs.push(...result.discovery.jobs.map((job) => job.id), ...result.hits.records.map((hit) => hit.hitId));
        return result;
      }
      case "joblens_rank": {
        const profile = await readCandidateProfileFile(join(this.workspaceDir, "profile", "candidate-profile.json"));
        let jobs = await stores.jobs.list();
        if (call.input?.opportunityIds?.length) {
          const selected = await Promise.all(call.input.opportunityIds.map((id) => stores.opportunities.get(id)));
          const jobIds = new Set(selected.filter((item) => item !== undefined).map((item) => item.jobId));
          jobs = jobs.filter((job) => jobIds.has(job.id));
        }
        const result = await rankAndPersistJobs({ jobs, profile, evaluationStore: stores.evaluations, opportunityStore: stores.opportunities, now });
        entityRefs.push(...result.opportunities.map((item) => item.opportunityId));
        return result;
      }
      case "joblens_research": {
        const opportunityId = requireId(call.input.opportunityId, "opportunityId");
        const result = await persistResearch({
          opportunityId,
          researchInput: call.input.researchInput,
          opportunityStore: stores.opportunities,
          jobStore: stores.jobs,
          researchStore: stores.research,
          evidenceStore: stores.evidence,
          now,
        });
        entityRefs.push(result.opportunity.opportunityId, result.research.researchId, ...result.evidence.map((item) => item.evidenceId));
        return result;
      }
      case "joblens_prepare": {
        if (call.input.userApproved !== true) throw new Error("joblens_prepare requires explicit userApproved: true");
        const profile = await readCandidateProfileFile(join(this.workspaceDir, "profile", "candidate-profile.json"));
        const result = await prepareApplication({
          opportunityId: requireId(call.input.opportunityId, "opportunityId"),
          userApproved: true,
          draft: call.input.draft,
          profile,
          opportunityStore: stores.opportunities,
          jobStore: stores.jobs,
          researchStore: stores.research,
          applicationStore: stores.applications,
          packageStore: stores.packages,
          now,
        });
        entityRefs.push(result.opportunity.opportunityId, result.application.applicationId, result.package.packageId);
        return result;
      }
      case "joblens_review": {
        const applicationId = requireId(call.input.applicationId, "applicationId");
        let packageId = call.input.packageId?.trim();
        if (!packageId) {
          const packages = (await stores.packages.list())
            .filter((item) => item.applicationId === applicationId)
            .sort((a, b) => b.preparedAt.localeCompare(a.preparedAt));
          packageId = packages[0]?.packageId;
        }
        if (!packageId) throw new Error(`no application package found for ${applicationId}`);
        const result = await reviewApplication({
          applicationId,
          packageId,
          reviewInput: call.input.reviewInput,
          applicationStore: stores.applications,
          packageStore: stores.packages,
          reviewStore: stores.reviews,
          now,
        });
        entityRefs.push(applicationId, packageId, result.review.reviewId);
        return result;
      }
      case "joblens_record_outcome": {
        const application = await recordOutcome({
          applicationId: requireId(call.input.applicationId, "applicationId"),
          event: call.input.event,
          applicationStore: stores.applications,
          packageStore: stores.packages,
          now,
        });
        entityRefs.push(application.applicationId);
        if (application.submissionSnapshot) entityRefs.push(application.submissionSnapshot.snapshotId);
        return application;
      }
    }
  }

  private async writeTrace(trace: ToolTrace): Promise<void> {
    const dir = join(this.workspaceDir, "logs", "tool-calls");
    await mkdir(dir, { recursive: true });
    const safeName = trace.traceId.replace(/[^a-zA-Z0-9._-]/g, "_");
    await writeFile(join(dir, `${safeName}.json`), `${JSON.stringify(trace, null, 2)}\n`, "utf8");
  }
}

import type { JobPosting } from "../core/domain/job-posting.js";
import type { EntityStore } from "../storage/store.js";
import type {
  DetailJobSource,
  JobSource,
  NormalizingJobSource,
  SearchableJobSource,
  SearchQuery,
  SourceContext,
} from "../sources/source-adapter.js";
import { discoverJobs, type DiscoveryResult } from "./orchestrator.js";
import { persistDiscoveredJobs, type PersistDiscoveryResult } from "./persistence.js";

export type DiscoverySource = JobSource & Partial<SearchableJobSource & DetailJobSource & NormalizingJobSource>;

export interface DiscoveryRunResult {
  discovery: DiscoveryResult;
  persistence: PersistDiscoveryResult;
}

export async function runDiscovery(input: {
  sources: DiscoverySource[];
  query: SearchQuery;
  context: SourceContext;
  jobStore: EntityStore<JobPosting>;
}): Promise<DiscoveryRunResult> {
  const discovery = await discoverJobs({
    sources: input.sources,
    query: input.query,
    context: input.context,
  });
  const persistence = await persistDiscoveredJobs({
    store: input.jobStore,
    jobs: discovery.jobs,
    now: input.context.now,
  });
  return { discovery, persistence };
}

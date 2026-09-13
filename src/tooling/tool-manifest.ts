import type { ApprovalClass } from "./tool-contract.js";
import type { JobLensToolName } from "./joblens-tool-service.js";

export interface JobLensToolDefinition {
  name: JobLensToolName;
  description: string;
  approvalClass: ApprovalClass;
  inputSchema: Record<string, unknown>;
}

const objectSchema = (properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  properties,
  ...(required.length ? { required } : {}),
});

export const JOBLENS_TOOL_DEFINITIONS: readonly JobLensToolDefinition[] = [
  { name: "joblens_profile_get", description: "Read the authoritative candidate profile from the private JobLens workspace.", approvalClass: "READ_ONLY", inputSchema: objectSchema({}) },
  { name: "joblens_jobs_list", description: "List persisted canonical job postings.", approvalClass: "READ_ONLY", inputSchema: objectSchema({ limit: { type: "integer", minimum: 1, maximum: 500 } }) },
  { name: "joblens_opportunities_list", description: "List candidate-job opportunities and their durable workflow states.", approvalClass: "READ_ONLY", inputSchema: objectSchema({ states: { type: "array", items: { type: "string" } }, limit: { type: "integer", minimum: 1, maximum: 500 } }) },
  { name: "joblens_opportunity_get", description: "Read one opportunity by stable id; do not substitute a stale chat ordinal.", approvalClass: "READ_ONLY", inputSchema: objectSchema({ opportunityId: { type: "string", minLength: 1 } }, ["opportunityId"]) },
  { name: "joblens_applications_list", description: "List persisted applications and lifecycle states.", approvalClass: "READ_ONLY", inputSchema: objectSchema({ states: { type: "array", items: { type: "string" } }, limit: { type: "integer", minimum: 1, maximum: 500 } }) },
  { name: "joblens_application_get", description: "Read one application by stable id.", approvalClass: "READ_ONLY", inputSchema: objectSchema({ applicationId: { type: "string", minLength: 1 } }, ["applicationId"]) },
  { name: "joblens_setup", description: "Persist or replace an evidence-backed candidate profile in the private workspace.", approvalClass: "LOCAL_MUTATION", inputSchema: objectSchema({ profile: { type: "object" }, replace: { type: "boolean" } }, ["profile"]) },
  { name: "joblens_discover", description: "Discover jobs from a manual posting or configured structured source and persist canonical job records.", approvalClass: "LOCAL_MUTATION", inputSchema: objectSchema({ source: { enum: ["manual", "saramin"] }, posting: { type: "object" }, query: { type: "object" } }, ["source"]) },
  { name: "joblens_rank", description: "Evaluate persisted jobs and persist JobEvaluation and Opportunity state.", approvalClass: "LOCAL_MUTATION", inputSchema: objectSchema({ opportunityIds: { type: "array", items: { type: "string" } } }) },
  { name: "joblens_research", description: "Persist evidence-grounded company/job research for one stable opportunity id.", approvalClass: "LOCAL_MUTATION", inputSchema: objectSchema({ opportunityId: { type: "string", minLength: 1 }, researchInput: { type: "object" } }, ["opportunityId", "researchInput"]) },
  { name: "joblens_prepare", description: "Prepare an evidence-linked application package. Explicit userApproved=true is mandatory and cannot be inferred from fit score.", approvalClass: "EXPLICIT_DECISION", inputSchema: objectSchema({ opportunityId: { type: "string", minLength: 1 }, userApproved: { const: true }, draft: { type: "object" } }, ["opportunityId", "userApproved", "draft"]) },
  { name: "joblens_review", description: "Run the reviewer result and grounding audit for an application package.", approvalClass: "LOCAL_MUTATION", inputSchema: objectSchema({ applicationId: { type: "string", minLength: 1 }, packageId: { type: "string" }, reviewInput: { type: "object" } }, ["applicationId", "reviewInput"]) },
  { name: "joblens_record_outcome", description: "Record submission/interview/offer/completion/withdrawal after the real-world event. APPLIED still requires explicit user confirmation.", approvalClass: "EXPLICIT_DECISION", inputSchema: objectSchema({ applicationId: { type: "string", minLength: 1 }, event: { type: "object" } }, ["applicationId", "event"]) },
] as const;

export function getJobLensToolDefinition(name: JobLensToolName): JobLensToolDefinition {
  const definition = JOBLENS_TOOL_DEFINITIONS.find((item) => item.name === name);
  if (!definition) throw new Error(`unknown JobLens tool: ${name}`);
  return definition;
}

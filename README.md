# JobLens

JobLens is an open-source, evidence-grounded AI workflow for discovering, evaluating, researching, and preparing job applications across multiple sources.

It is designed around a simple interaction model: users can talk to an AI client in natural language while the client calls the same canonical JobLens services used by the CLI or MCP transport. Candidate data and application history live in a private workspace, not in the public framework repository.

## v0.1 workflow

`setup -> discover -> verify/materialize when needed -> rank -> research -> prepare -> review -> READY -> user submission -> outcome`

## Why JobLens

- **Multi-source discovery**: job-board APIs, web search, company career pages, and manual posting input can plug into the same source boundary.
- **Transparent fit assessment**: Hard Gate, Fit Score, and Confidence are separate signals. A fit score is not a hiring probability.
- **Evidence first**: important candidate, job, and company claims remain traceable to frozen evidence.
- **Human approval**: high scores never trigger an application automatically. Preparation and submitted-state changes require explicit user decisions.
- **Agent agnostic**: ChatGPT, Claude, Codex, Gemini, CLI clients, or future agents can call the same core contracts.
- **Privacy boundary**: real resumes, credentials, application records, and private preferences belong in a separate workspace.

## Current implementation

JobLens is currently `v0.1.0-alpha.14`.

Implemented foundations include:

- canonical domain models for CandidateProfile, JobPosting, DiscoveryHitRecord, Opportunity, Application, CompanyResearch, SourceEvidence, ApplicationPackage, and ApplicationReview;
- source capability contracts, manual ingestion, Saramin Open API discovery, web-search discovery, and duplicate assessment;
- durable search/discovery hits with stable ids, status, source provenance, and query identity;
- client-assisted web search ingestion so an AI host can persist its own search results without hard-wiring JobLens to one search vendor;
- explicit discovery-hit verification/materialization that requires fetched posting content before a search hit can become a canonical JobPosting;
- verification metadata on materialized web hits, including verified source URL, time, and content hash;
- Hard Gate + weighted Fit Score + independent Confidence, including early-career seniority/experience gates;
- persistent JobEvaluation and Opportunity entities with stable identities across reranking;
- evidence-grounded research with verified facts, analysis, community signals, risks, opportunities, and unresolved questions;
- explicit approval before application preparation, frozen source snapshots, evidence-linked artifact claims, reviewer + grounding audit, and revision lifecycle;
- explicit user-confirmed READY -> APPLIED recording with immutable SubmissionSnapshot metadata;
- event-based interview, offer, completion, and withdrawal lifecycle tracking with idempotent outcome handling;
- private workspace storage for discovery hits, jobs, evaluations, opportunities, research, evidence, applications, packages, and reviews;
- executable `setup`, `discover`, `materialize`, `rank`, `research`, `prepare`, `review`, and `outcome` CLI commands;
- CLI integration coverage for verified-hit materialization -> ranking and outcome dispatch;
- transport-neutral `JobLensToolService` exposing canonical read/workflow tools to conversational clients;
- public `JOBLENS_TOOL_DEFINITIONS` manifest with tool descriptions, approval classes, and JSON-schema-shaped inputs;
- actual local MCP stdio server built on the official MCP TypeScript SDK v2;
- `joblens-mcp` executable that maps MCP tool calls into the same `JobLensToolService` used by other clients;
- metadata-only tool-call audit traces under the private workspace, without raw prompts/documents/secrets;
- MCP stdio integration coverage in addition to ordinary typecheck/unit tests.

## CLI quick start

```bash
npm install
npm run build

export JOBLENS_WORKSPACE="$HOME/.joblens/my-search"

node dist/cli/bin.js setup --profile /private/path/candidate-profile.json
node dist/cli/bin.js discover /private/path/posting.json
node dist/cli/bin.js materialize hit:example --input /private/path/verified-posting.json
node dist/cli/bin.js rank
node dist/cli/bin.js research opp:example --input /private/path/research.json
node dist/cli/bin.js prepare opp:example --input /private/path/application-draft.json --approve
node dist/cli/bin.js review application:example --input /private/path/review.json
node dist/cli/bin.js outcome application:example --input /private/path/outcome.json
```

`materialize` is mainly useful for discovery hits created by a conversational/web-search client. It requires a stable `hitId` plus a JSON file containing the fetched posting URL and actual posting content. Search snippets alone are not sufficient.

Saramin structured discovery is executable when `SARAMIN_ACCESS_KEY` is supplied through the environment. Its search hits are also persisted in the discovery-hit store. Never commit the real key.

## MCP quick start

JobLens includes a local stdio MCP adapter:

```bash
npm install
npm run build

export JOBLENS_WORKSPACE="$HOME/.joblens/my-search"
export JOBLENS_WORKSPACE_ID="my-search"
node dist/mcp/bin.js
```

Installed/package-linked use can invoke the `joblens-mcp` bin. Local MCP hosts spawn this process and communicate over stdio; users do not need to operate the JobLens CLI for each workflow step.

The MCP layer is deliberately thin: request ids are generated server-side, calls are forwarded into `JobLensToolService`, and the same approval/grounding/lifecycle rules apply regardless of client. The adapter uses the official `@modelcontextprotocol/server` v2 package.

**Important:** local stdio MCP does not expose a private workstation to a cloud ChatGPT session. A future remote ChatGPT/App deployment still needs a remote transport plus authentication, TLS, and workspace authorization.

## Conversational clients

`JobLensToolService` is the canonical transport-neutral boundary for AI clients. It exposes stable tools such as `joblens_profile_get`, `joblens_discovery_hits_list`, `joblens_discovery_hit_get`, `joblens_materialize_hit`, `joblens_opportunities_list`, `joblens_research`, `joblens_prepare`, `joblens_review`, and `joblens_record_outcome` while re-reading the private workspace on every invocation.

Chat memory is not authoritative state. Durable ids such as `hitId`, `opportunityId`, and `applicationId` must be re-used or re-read before mutations; a stale conversational ordinal like “#3” must not silently identify a different job.

Tool actions are classified as `READ_ONLY`, `LOCAL_MUTATION`, `EXPLICIT_DECISION`, or reserved `EXTERNAL_ACTION`. `joblens_materialize_hit` is a local state mutation, while `joblens_prepare` requires explicit approval and APPLIED still requires explicit user confirmation. Tool-call traces record metadata and resulting entity ids but intentionally exclude raw candidate/job content and credentials.

See `docs/conversational-tools.md` for the canonical tool list, local MCP setup, and remote-deployment boundary.

## Private workspace

A user workspace is deliberately separate from the public repository. `initializeWorkspace()` creates private runtime directories and persistent stores under the configured workspace root. The current alpha uses one JSON file per persisted entity with atomic replacement writes; the storage contract remains swappable so a later SQLite adapter can be introduced without changing domain workflows.

Do not put a real workspace inside a public clone.

## Ranking semantics

JobLens separates **Hard Gate** (PASS/FLAG/FAIL), **Fit Score** (weighted 0–100 comparison), and **Confidence** (strength of available evidence). A fit score is not a hiring probability. Early-career profiles fail explicitly senior roles or roles requiring five or more years before ordinary scoring; three-to-four-year requirements are flagged for review.

Only canonical `JobPosting` records are rankable. A raw web-search `DiscoveryHitRecord` stays outside ranking until its actual posting content has been fetched and materialized.

## Evidence-grounded research

Raw evidence and findings are separate. Each finding must reference evidence keys. Non-user evidence requires a source URI, community signals require community-authority evidence, and unresolved questions remain explicit instead of being guessed. See `workspace-template/research-input.example.json`.

## Application preparation and grounding

`prepare` requires explicit approval; fit score alone can never create an application. Preparation freezes the exact CandidateProfile version, JobPosting, and CompanyResearch used for the draft. Each declared factual claim must reference the frozen evidence set.

`review` combines an independent reviewer verdict with an automatic grounding audit. READY requires reviewer `PASS` and zero grounding blockers. The core audit validates the declared factual-claim inventory and hashes; it does not pretend to infer every factual sentence from arbitrary prose, so an AI/human reviewer must surface undeclared unsupported claims as BLOCKER findings.

## Submission and outcome lifecycle

JobLens does **not** submit applications in v0.1. The user submits through the external portal, then records the event. `APPLIED` requires explicit `userConfirmed: true` and can only transition from READY. JobLens freezes the candidate profile version and submitted artifact versions/hashes into a SubmissionSnapshot. Interview rounds remain lifecycle events rather than hard-coded interview states.

The CLI `outcome` command is wired to the same `recordOutcome` service used by conversational tools; it does not perform the external submission itself.

## Web search providers

JobLens does not hard-code one AI vendor's web search. A conversational host can use its own web-search capability and pass `{ providerId, query, results }` to `joblens_discover` with `source: "web_search"`.

Those results are persisted under the private workspace as stable `DiscoveryHitRecord` entities and can be recovered later with `joblens_discovery_hits_list` or read individually with `joblens_discovery_hit_get`. Search snippets are deliberately **not** promoted to canonical `JobPosting` records and cannot enter ranking by themselves.

After the client opens/fetches the actual posting page, it can call `joblens_materialize_hit` or the CLI `materialize` wrapper with the stable `hitId` plus the verified posting content. JobLens stores a verification record with the canonicalized source URL, verification timestamp, and content hash, persists/merges the canonical JobPosting through the normal duplicate pipeline, and marks the hit `MATERIALIZED`. Repeating the same materialization is idempotent.

The lower-level `SearchProvider` and `WebSearchSource` contracts remain provider-agnostic, so a direct search API adapter can be added later without changing the domain workflow.

## Development

```bash
npm install
npm run typecheck
npm test
```

## Privacy

Do not commit a real user workspace to this public repository. The `workspace-template/` directory contains examples only.

## License and upstream inspiration

JobLens is released under the MIT License. The project was inspired in part by concepts from Mads Lorentzen's `ai-job-search` project; see `THIRD_PARTY_NOTICES.md` for attribution. JobLens uses its own architecture, source contracts, ranking model, privacy boundary, and agent-agnostic workflow.

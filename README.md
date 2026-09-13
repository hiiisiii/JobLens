# JobLens

JobLens is an open-source, evidence-grounded AI workflow for discovering, evaluating, researching, and preparing job applications across multiple sources.

It is designed around a simple interaction model: users can talk to an AI client in natural language while the client calls the same canonical JobLens services used by the CLI. Candidate data and application history live in a private workspace, not in the public framework repository.

## v0.1 workflow

`setup -> discover -> rank -> research -> prepare -> review -> READY -> user submission -> outcome`

## Why JobLens

- **Multi-source discovery**: job-board APIs, web search, company career pages, and manual posting input can plug into the same source boundary.
- **Transparent fit assessment**: Hard Gate, Fit Score, and Confidence are separate signals. A fit score is not a hiring probability.
- **Evidence first**: important candidate, job, and company claims remain traceable to frozen evidence.
- **Human approval**: high scores never trigger an application automatically. Preparation and submitted-state changes require explicit user decisions.
- **Agent agnostic**: ChatGPT, Claude, Codex, Gemini, CLI clients, or future agents can call the same core contracts.
- **Privacy boundary**: real resumes, credentials, application records, and private preferences belong in a separate workspace.

## Current implementation

JobLens is currently `v0.1.0-alpha.10`.

Implemented foundations include:

- canonical domain models for CandidateProfile, JobPosting, Opportunity, Application, CompanyResearch, SourceEvidence, ApplicationPackage, and ApplicationReview;
- source capability contracts, manual ingestion, Saramin Open API discovery, and duplicate assessment;
- Hard Gate + weighted Fit Score + independent Confidence, including early-career seniority/experience gates;
- persistent JobEvaluation and Opportunity entities with stable identities across reranking;
- evidence-grounded research with verified facts, analysis, community signals, risks, opportunities, and unresolved questions;
- explicit approval before application preparation, frozen source snapshots, evidence-linked artifact claims, reviewer + grounding audit, and revision lifecycle;
- explicit user-confirmed READY -> APPLIED recording with immutable SubmissionSnapshot metadata;
- event-based interview, offer, completion, and withdrawal lifecycle tracking with idempotent outcome handling;
- private workspace storage for jobs, evaluations, opportunities, research, evidence, applications, packages, and reviews;
- executable `setup`, `discover`, `rank`, `research`, `prepare`, `review`, and `outcome` CLI commands;
- transport-neutral `JobLensToolService` exposing canonical read/workflow tools to conversational clients;
- public `JOBLENS_TOOL_DEFINITIONS` manifest with tool descriptions, approval classes, and JSON-schema-shaped inputs;
- metadata-only tool-call audit traces under the private workspace, without raw prompts/documents/secrets;
- CI typecheck and unit tests.

## CLI quick start

```bash
npm install
npm run build

export JOBLENS_WORKSPACE="$HOME/.joblens/my-search"

node dist/cli/bin.js setup --profile /private/path/candidate-profile.json
node dist/cli/bin.js discover /private/path/posting.json
node dist/cli/bin.js rank
node dist/cli/bin.js research opp:example --input /private/path/research.json
node dist/cli/bin.js prepare opp:example --input /private/path/application-draft.json --approve
node dist/cli/bin.js review application:example --input /private/path/review.json
node dist/cli/bin.js outcome application:example --input /private/path/outcome.json
```

Saramin structured discovery is also executable when `SARAMIN_ACCESS_KEY` is supplied through the environment. Never commit the real key.

## Conversational clients

`JobLensToolService` is the canonical transport-neutral boundary for AI clients. It exposes stable tools such as `joblens_profile_get`, `joblens_opportunities_list`, `joblens_research`, `joblens_prepare`, `joblens_review`, and `joblens_record_outcome` while re-reading the private workspace on every invocation.

This means chat memory is not authoritative state. Durable ids such as `opportunityId` and `applicationId` must be re-used or re-read before mutations; a stale conversational ordinal like “#3” must not silently identify a different job.

Tool actions are classified as `READ_ONLY`, `LOCAL_MUTATION`, `EXPLICIT_DECISION`, or reserved `EXTERNAL_ACTION`. `joblens_prepare` requires explicit approval, and APPLIED still requires explicit user confirmation. Tool-call traces record metadata and resulting entity ids but intentionally exclude raw candidate/job content and credentials.

See `docs/conversational-tools.md` for the canonical tool list and integration boundary. Alpha.10 is **MCP-ready but does not yet include an MCP transport server**; MCP/HTTP/SDK adapters should remain thin and call this service rather than duplicate business rules.

## Private workspace

A user workspace is deliberately separate from the public repository. `initializeWorkspace()` creates private runtime directories and persistent stores under the configured workspace root. The current alpha uses one JSON file per persisted entity with atomic replacement writes; the storage contract remains swappable so a later SQLite adapter can be introduced without changing domain workflows.

Do not put a real workspace inside a public clone.

## Ranking semantics

JobLens separates **Hard Gate** (PASS/FLAG/FAIL), **Fit Score** (weighted 0–100 comparison), and **Confidence** (strength of available evidence). A fit score is not a hiring probability. Early-career profiles fail explicitly senior roles or roles requiring five or more years before ordinary scoring; three-to-four-year requirements are flagged for review.

## Evidence-grounded research

Raw evidence and findings are separate. Each finding must reference evidence keys. Non-user evidence requires a source URI, community signals require community-authority evidence, and unresolved questions remain explicit instead of being guessed. See `workspace-template/research-input.example.json`.

## Application preparation and grounding

`prepare` requires explicit approval; fit score alone can never create an application. Preparation freezes the exact CandidateProfile version, JobPosting, and CompanyResearch used for the draft. Each declared factual claim must reference the frozen evidence set.

`review` combines an independent reviewer verdict with an automatic grounding audit. READY requires reviewer `PASS` and zero grounding blockers. The core audit validates the declared factual-claim inventory and hashes; it does not pretend to infer every factual sentence from arbitrary prose, so an AI/human reviewer must surface undeclared unsupported claims as BLOCKER findings.

## Submission and outcome lifecycle

JobLens does **not** submit applications in v0.1. The user submits through the external portal, then records the event. `APPLIED` requires explicit `userConfirmed: true` and can only transition from READY. JobLens freezes the candidate profile version and submitted artifact versions/hashes into a SubmissionSnapshot. Interview rounds remain lifecycle events rather than hard-coded interview states.

## Web search providers

JobLens does not hard-code one AI vendor's web search. A client can implement the `SearchProvider` contract and expose results through `WebSearchSource`. Search-only results remain discovery hits until another source verifies/materializes the posting. An executable generic web-search provider path remains planned for v0.1.

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

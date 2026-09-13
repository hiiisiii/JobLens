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

JobLens is currently `v0.1.0-alpha.9`.

Implemented foundations include:

- canonical domain models for CandidateProfile, JobPosting, Opportunity, Application, CompanyResearch, SourceEvidence, ApplicationPackage, and ApplicationReview;
- source capability contracts, manual ingestion, Saramin Open API discovery, and duplicate assessment;
- Hard Gate + weighted Fit Score + independent Confidence, including early-career seniority/experience gates;
- persistent JobEvaluation and Opportunity entities with stable identities across reranking;
- evidence-grounded research with verified facts, analysis, community signals, risks, opportunities, and unresolved questions;
- explicit `--approve` boundary before application preparation;
- frozen CandidateProfile + JobPosting + CompanyResearch snapshots per application package;
- evidence-linked artifact claim inventories for resume, self-intro, cover letter, and portfolio brief drafts;
- separate reviewer result and automated grounding audit before READY;
- content-hash and frozen-evidence checks that force `REVISION_REQUIRED` when grounding blockers exist;
- revision lifecycle support back to PREPARING without erasing history;
- explicit user-confirmed READY -> APPLIED recording with immutable SubmissionSnapshot metadata;
- event-based interview, offer, completion, and withdrawal lifecycle tracking;
- idempotent outcome event handling so retries do not duplicate lifecycle history;
- private workspace storage for jobs, evaluations, opportunities, research, evidence, applications, packages, and reviews;
- executable `setup`, `discover`, `rank`, `research`, `prepare`, `review`, and `outcome` CLI commands;
- agent-agnostic tool contracts for conversational clients;
- CI typecheck and unit tests.

## CLI quick start

```bash
npm install
npm run build

export JOBLENS_WORKSPACE="$HOME/.joblens/my-search"

# 1. private candidate profile
node dist/cli/bin.js setup --profile /private/path/candidate-profile.json

# 2. discovery
node dist/cli/bin.js discover /private/path/posting.json

# or Saramin structured discovery
export SARAMIN_ACCESS_KEY="..."
node dist/cli/bin.js discover \
  --source saramin \
  --keyword "Node.js" \
  --keyword "백엔드,TypeScript" \
  --location "서울" \
  --posted-after "2026-09-01" \
  --limit 25

# 3. rank and persist Opportunity ids
node dist/cli/bin.js rank

# 4. research selected opportunity
node dist/cli/bin.js research \
  opp:example \
  --input /private/path/research.json

# 5. explicit human approval + evidence-linked draft package
node dist/cli/bin.js prepare \
  opp:example \
  --input /private/path/application-draft.json \
  --approve

# 6. independent review + grounding audit
node dist/cli/bin.js review \
  application:example \
  --input /private/path/review.json

# 7. after the user actually submits outside JobLens, record APPLIED/outcomes
node dist/cli/bin.js outcome \
  application:example \
  --input /private/path/outcome.json
```

The package also exposes a `joblens` bin entrypoint for installed/package-linked use.

## Private workspace

A user workspace is deliberately separate from the public repository. `initializeWorkspace()` creates private runtime directories and persistent stores under the configured workspace root. The current alpha uses one JSON file per persisted entity with atomic replacement writes; the storage contract remains swappable so a later SQLite adapter can be introduced without changing domain workflows.

Do not put a real workspace inside a public clone.

## Ranking semantics

JobLens deliberately separates three concepts:

- **Hard Gate**: PASS / FLAG / FAIL eligibility or risk checks.
- **Fit Score**: weighted 0–100 comparison only when a role has not failed the hard gate.
- **Confidence**: how strongly the available evidence supports the assessment.

For an early-career profile, a role that explicitly requires five or more years is failed before fit scoring. A three-to-four-year minimum is flagged for review. Explicit senior-level titles are prevented from surfacing as ordinary high-scoring junior matches.

## Evidence-grounded research

`research` accepts a JSON research package and attaches it to a previously ranked Opportunity. See `workspace-template/research-input.example.json`.

Raw evidence and findings are separate. Each finding must reference evidence keys. Non-user evidence requires a source URI, and community signals require community-authority evidence. Unresolved questions remain explicit instead of being guessed.

## Application preparation and grounding

`prepare` requires explicit `--approve`; fit score alone can never create an application. See `workspace-template/application-draft.example.json`.

Preparation freezes the exact CandidateProfile version, JobPosting, and CompanyResearch used for the draft. Each declared factual claim in an artifact must reference evidence from that frozen source set. Candidate evidence comes from the private profile, company evidence comes from research, and a stable job-snapshot evidence id represents the frozen posting.

`review` is a separate step. See `workspace-template/review.example.json`. It combines an independent reviewer verdict with an automatic grounding audit. READY requires reviewer `PASS` and zero grounding blockers. Changed artifact content, claims that point outside the frozen evidence set, or other grounding failures force `REVISION_REQUIRED`.

The core grounding audit validates the declared factual-claim inventory; it does not claim to infer every factual sentence from arbitrary prose by itself. A conversational/AI reviewer should surface undeclared or unsupported claims as BLOCKER findings before marking a package PASS.

## Submission and outcome lifecycle

JobLens does **not** submit applications in v0.1. The user submits through the external portal, then records the result with `outcome`. See `workspace-template/outcome.example.json`.

`APPLIED` requires explicit `userConfirmed: true` and can only transition from READY. At that point JobLens creates a SubmissionSnapshot containing the candidate profile version plus artifact versions/hashes from the selected application package. Later interview rounds are stored as lifecycle events rather than hard-coded interview states. Offer, completion, rejection/no-response, and withdrawal remain explicit application outcomes.

Repeated delivery of the same outcome event is idempotent and does not duplicate lifecycle history.

## Saramin discovery

The Saramin source uses the official job-search endpoint and expects an access key through the environment:

```bash
export SARAMIN_ACCESS_KEY="..."
```

The CLI accepts repeated or comma-separated `--keyword` and `--location` values, an ISO-compatible `--posted-after` value, and `--limit` from 1 to 110. Structured portal metadata is marked partial and should be verified against a canonical posting before application preparation.

Never commit the real key.

## Web search providers

JobLens does not hard-code one AI vendor's web search. A client can implement the `SearchProvider` contract and expose results through `WebSearchSource`. Search-only results remain discovery hits until another source verifies/materializes the posting.

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

# JobLens

JobLens is an open-source, evidence-grounded AI workflow for discovering, evaluating, researching, and preparing job applications across multiple sources.

It is designed around a simple interaction model: users can talk to an AI client in natural language while the client calls the same canonical JobLens services used by the CLI. Candidate data and application history live in a private workspace, not in the public framework repository.

## v0.1 workflow

`setup -> discover -> rank -> research -> prepare -> review -> READY -> user submission -> outcome`

## Why JobLens

- **Multi-source discovery**: job-board APIs, web search, company career pages, and manual posting input can plug into the same source boundary.
- **Transparent fit assessment**: Hard Gate, Fit Score, and Confidence are separate signals. A fit score is not a hiring probability.
- **Evidence first**: important candidate and company claims are intended to stay traceable to provenance.
- **Human approval**: high scores never trigger an application automatically. Application preparation and submitted-state changes require explicit user decisions.
- **Agent agnostic**: ChatGPT, Claude, Codex, Gemini, CLI clients, or future agents can call the same core contracts.
- **Privacy boundary**: real resumes, credentials, application records, and private preferences belong in a separate workspace.

## Current implementation

JobLens is currently `v0.1.0-alpha.6`.

Implemented foundations include:

- canonical domain models for CandidateProfile, JobPosting, Opportunity, Application, research, and evidence;
- application state transitions with reviewer/grounding guards and idempotent lifecycle events;
- source capability contracts and isolated source errors;
- manual job ingestion;
- canonical-URL/content based duplicate assessment;
- configurable ranking with Hard Gate + weighted Fit Score + independent Confidence;
- early-career hard gates for clearly senior roles and high minimum-experience requirements;
- persistent JobEvaluation and Opportunity entities produced by ranking;
- idempotent re-ranking with stable opportunity identity per candidate-profile version;
- preservation of explicit user decision states such as HOLD, SKIPPED, and APPLY_APPROVED during re-ranking;
- discovery orchestration where one failed source does not fail the whole run;
- persistent discovery state through a local JSON-directory storage adapter;
- private workspace initialization for jobs, evaluations, opportunities, applications, research, logs, cache, and documents;
- canonical job identity preservation when later sources rediscover the same posting;
- validated private CandidateProfile import with overwrite protection;
- executable `setup`, manual/structured `discover`, and `rank` CLI commands;
- executable Saramin Open API discovery with keyword, location, freshness, and result-limit options;
- an agent-agnostic `SearchProvider` boundary for web discovery;
- runtime configuration and storage ports that keep framework logic independent from persistence;
- CI typecheck and unit tests.

## CLI quick start

```bash
npm install
npm run build

# choose a private workspace outside the public repository
export JOBLENS_WORKSPACE="$HOME/.joblens/my-search"

# initialize an empty profile
node dist/cli/bin.js setup

# or import an evidence-backed private CandidateProfile
node dist/cli/bin.js setup --profile /private/path/candidate-profile.json

# explicit replacement is required if a profile already exists
node dist/cli/bin.js setup --profile /private/path/candidate-profile-v2.json --replace

# manual discovery remains supported
node dist/cli/bin.js discover /private/path/posting.json

# Saramin structured discovery
export SARAMIN_ACCESS_KEY="..."
node dist/cli/bin.js discover \
  --source saramin \
  --keyword "Node.js" \
  --keyword "백엔드,TypeScript" \
  --location "서울" \
  --posted-after "2026-09-01" \
  --limit 25

# rank all persisted postings and persist JobEvaluation + Opportunity entities
node dist/cli/bin.js rank
```

The package also exposes a `joblens` bin entrypoint for installed/package-linked use.

## Private workspace

A user workspace is deliberately separate from the public repository. `initializeWorkspace()` creates the private runtime directories and persistent stores under the configured workspace root. The current alpha uses one JSON file per persisted entity with atomic replacement writes; the storage contract remains swappable so a later SQLite adapter can be introduced without changing the domain workflow.

Ranking now writes immutable/content-addressed JobEvaluation records and stable Opportunity records. Re-running rank updates machine-generated evaluation state but does not silently overwrite explicit user decisions such as HOLD, SKIPPED, RESEARCHING, REVIEWABLE, or APPLY_APPROVED.

Do not put a real workspace inside a public clone. Real resumes, application history, private preferences, candidate profiles, and credentials should stay outside the repository.

## Ranking semantics

JobLens deliberately separates three concepts:

- **Hard Gate**: PASS / FLAG / FAIL eligibility or risk checks.
- **Fit Score**: weighted 0–100 comparison only when a role has not failed the hard gate.
- **Confidence**: how strongly the available evidence supports the assessment.

For an early-career profile, a role that explicitly requires five or more years is failed before fit scoring. A three-to-four-year minimum is flagged for review. Explicit senior-level titles are also prevented from surfacing as ordinary high-scoring junior matches.

Each ranking pass persists a JobEvaluation and connects it to an Opportunity. A failed hard gate moves a machine-managed opportunity to `EXCLUDED`; otherwise it becomes `EVALUATED`. Explicit user-decision states are preserved on later ranking passes.

## Saramin discovery

The Saramin source uses the official job-search endpoint and expects an access key through the environment:

```bash
export SARAMIN_ACCESS_KEY="..."
```

The CLI accepts repeated or comma-separated `--keyword` and `--location` values, an ISO-compatible `--posted-after` value, and `--limit` from 1 to 110. Results pass through the same normalization, duplicate assessment, canonical identity, and private persistence path used by the rest of JobLens.

Never commit the real key. `.env.example` only documents the variable name.

Saramin API results are intentionally marked as `contentCompleteness: "partial"`. The API provides structured posting metadata, but JobLens does not treat that metadata as the complete job description. A canonical posting or another primary source should be verified before application preparation.

## Web search providers

JobLens does not hard-code one AI vendor's web search. A client can implement the `SearchProvider` contract and expose results through `WebSearchSource`. Search-only results remain visible as discovery hits until another source verifies/materializes the posting.

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

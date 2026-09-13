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

JobLens is currently `v0.1.0-alpha`.

Implemented foundations include:

- canonical domain models for CandidateProfile, JobPosting, Opportunity, Application, research, and evidence;
- application state transitions with reviewer/grounding guards and idempotent lifecycle events;
- source capability contracts and isolated source errors;
- manual job ingestion;
- canonical-URL/content based duplicate assessment;
- configurable ranking with Hard Gate + weighted Fit Score + independent Confidence;
- discovery orchestration where one failed source does not fail the whole run;
- an agent-agnostic `SearchProvider` boundary for web discovery;
- a Saramin Open API adapter for structured Korean job discovery;
- runtime configuration and a storage port with an in-memory adapter;
- CI typecheck and unit tests.

## Saramin adapter

The Saramin adapter uses the official job-search endpoint and expects an access key through the environment:

```bash
export SARAMIN_ACCESS_KEY="..."
```

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

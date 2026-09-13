# JobLens

**Open-source AI workflow for job discovery, fit assessment, company research, and evidence-grounded application preparation.**

JobLens is designed as a reusable job-search engine that can sit behind a CLI or a conversational AI client. It keeps job discovery, ranking, research, application preparation, and outcome tracking in one auditable workflow without treating AI-generated claims as facts.

> Status: `v0.1.0-alpha.0` — Phase 1 core implementation.

## Workflow

```text
setup
  -> discover
  -> normalize / dedupe
  -> rank (Hard Gate + Fit Score + Confidence)
  -> research
  -> explicit user decision
  -> prepare
  -> review + grounding
  -> READY
  -> user submits externally
  -> outcome / interview tracking
```

`READY` means the application package passed the configured review and grounding checks. JobLens v0.1 does **not** automatically submit applications.

## Why JobLens

- **Multi-source by design** — official APIs, web/search providers, career pages, and manual input can be implemented through source capabilities.
- **Evidence-grounded** — candidate, job, and company claims can carry provenance instead of relying on conversational memory.
- **Transparent ranking** — Hard Gate, Fit Score, and Confidence are separate concepts. A fit score is not a hiring probability.
- **Opportunity before Application** — discovering or ranking a job does not create an application. Application preparation begins only after an explicit decision.
- **Human approval boundaries** — state transitions such as application preparation and submitted status require explicit user intent.
- **Agent-agnostic core** — ChatGPT, Claude, Gemini, Codex, CLI, or other clients should reuse the same domain rules rather than duplicate them.
- **Privacy by architecture** — real resumes, credentials, application history, and private research belong in a separate workspace, not this public repository.

## Current implementation

The Phase 1 core currently includes:

- TypeScript strict-mode domain models for `CandidateProfile`, `JobPosting`, `SourceEvidence`, `CompanyResearch`, `Opportunity`, and `Application`;
- capability-based source contracts;
- a manual job source for explicit posting ingestion;
- deterministic text fingerprinting and staged duplicate assessment;
- application lifecycle guards, including reviewer/grounding checks for `READY`;
- idempotent lifecycle events;
- canonical tool request types for conversational clients;
- workspace templates and thin agent adapter contracts;
- unit tests and GitHub Actions CI.

## Local development

Requirements: Node.js 20+.

```bash
npm install
npm run typecheck
npm test
```

## Repository boundaries

```text
joblens/                   # public framework
  src/
  agents/
  docs/
  tests/
  workspace-template/

joblens-workspace/         # separate private workspace
  profile/
  documents/
  jobs/
  opportunities/
  research/
  applications/
  tracker/
  .env
```

The private workspace directory is ignored by this repository and should never be committed to a public fork or clone.

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the current architecture boundary. The public core is intentionally independent of any single job board or AI provider.

## Roadmap to v0.1

Next implementation slices are storage/config, discovery orchestration, a first structured job source, ranking policy, research evidence capture, application artifact preparation, grounding review, and one real end-to-end dogfooding run.

## License

MIT. See [`LICENSE`](LICENSE).

JobLens was inspired in part by workflow concepts from `MadsLorentzen/ai-job-search`. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for attribution.

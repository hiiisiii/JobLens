# Architecture

JobLens separates conversational clients from the job-search workflow engine.

```text
Clients (CLI / MCP / agent adapters)
  -> Application services
  -> Domain rules
  -> Storage and source adapters
```

Core principles:

- canonical domain models are independent of individual job boards;
- `Opportunity` covers discovery, ranking, and research before an application exists;
- `Application` begins only after an explicit decision to prepare an application;
- Hard Gate, Fit Score, and Confidence are separate concepts;
- important claims carry evidence/provenance;
- reviewer and grounding checks guard the `READY` state;
- external submission is intentionally outside the v0.1 automated workflow;
- private candidate data lives in a separate workspace, not this public repository.

Architecture decision records will be added as implementation choices stabilize.

# JobLens Architecture

JobLens separates user-facing clients from a durable job-search workflow engine. CLI, local MCP, and future adapters are transports over the same services rather than separate implementations.

```text
CLI / local MCP / future agent adapter
                |
                v
       JobLensToolService
                |
     application services
                |
       domain invariants
                |
   +------------+-------------+
   |                          |
private workspace        source adapters
(JSON stores)       (manual/Saramin/web)
```

## Domain layers

- `CandidateProfile` is the authoritative, evidence-backed candidate description.
- `DiscoveryHitRecord` is a durable discovery result that may still be unverified.
- `JobPosting` is the canonical verified/rankable job representation.
- `JobEvaluation` records Hard Gate, Fit Score, Confidence, and dimension evidence.
- `Opportunity` tracks a candidate-job workflow before an application exists.
- `CompanyResearch` and `SourceEvidence` keep research claims traceable.
- `ApplicationPackage` freezes the selected candidate/job/research evidence used to draft artifacts.
- `Application` owns preparation, review, READY, submission-recording, interview, offer, completion, and withdrawal lifecycle state.

## Invariants

1. Search snippets do not become canonical jobs without verification/materialization.
2. Hard Gate, Fit Score, and Confidence remain separate concepts.
3. Candidate experience is not inferred from a skill inventory when structured evidence exists.
4. Important research/application claims carry evidence/provenance.
5. Preparation requires an explicit user decision.
6. Reviewer PASS plus zero grounding blockers is required for READY.
7. READY is not submission; external submission remains a user action in v0.1.
8. Recording APPLIED requires explicit user confirmation.
9. Durable ids and workspace state are authoritative; conversational memory is not.
10. Private candidate data and credentials live outside the public framework repository.

## Storage

The v0.1 implementation uses one JSON document per persisted entity with atomic replacement writes behind an `EntityStore<T>` contract. The storage interface is intentionally swappable; moving to SQLite or another local store should not require changing workflow/domain contracts.

## Source boundary

Job-board integrations normalize into source-neutral drafts. Client-assisted web search persists `DiscoveryHitRecord` state first; canonical materialization requires fetched page content. This prevents search snippets from silently acquiring the authority of a real job description.

## Transport boundary

`JobLensToolService` is the canonical conversational/programmatic interface. The MCP adapter is deliberately thin and validates tool inputs from the canonical tool manifest before forwarding calls. Approval and lifecycle rules remain in the core services, not in the transport.

Local MCP uses stdio. Remote/cloud MCP transport, authentication, TLS, and workspace authorization are outside the v0.1 architecture boundary.

## Approval classes

Tool actions are classified as `READ_ONLY`, `LOCAL_MUTATION`, `EXPLICIT_DECISION`, or reserved `EXTERNAL_ACTION`. The classification describes required human control; it does not replace domain validation.

For the operational sequence, state transitions, and user-facing workflow, see `docs/workflow.md`.

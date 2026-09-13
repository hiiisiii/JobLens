# Conversational tool boundary

JobLens core is intentionally not a chatbot. Conversational clients are interchangeable callers of the same durable workflow services.

## Interaction model

```text
User
  -> ChatGPT / Claude / Gemini / Codex / other client
  -> transport adapter (MCP, HTTP, SDK, CLI bridge)
  -> JobLensToolService
  -> JobLens domain/application services
  -> private workspace + configured external sources
```

`JobLensToolService` is the canonical transport-neutral boundary introduced in alpha.10. It re-reads the private workspace on every call, so chat memory is never treated as authoritative state.

## Canonical tools

Read-only:

- `joblens_profile_get`
- `joblens_jobs_list`
- `joblens_opportunities_list`
- `joblens_opportunity_get`
- `joblens_applications_list`
- `joblens_application_get`

Workflow:

- `joblens_setup`
- `joblens_discover`
- `joblens_rank`
- `joblens_research`
- `joblens_prepare`
- `joblens_review`
- `joblens_record_outcome`

`JOBLENS_TOOL_DEFINITIONS` publishes names, descriptions, approval classes, and transport-neutral JSON-schema-shaped input definitions. MCP/HTTP/SDK adapters should translate this manifest rather than duplicating business rules.

## Approval classes

- `READ_ONLY`: no durable mutation.
- `LOCAL_MUTATION`: changes private JobLens state but does not represent an external user decision.
- `EXPLICIT_DECISION`: requires an explicit user decision. `joblens_prepare` cannot infer approval from score, and APPLIED still requires explicit confirmation through `joblens_record_outcome`.
- `EXTERNAL_ACTION`: reserved for future integrations. v0.1 does not submit applications.

## Stable references

Conversation ordinals such as “the third one” are presentation conveniences, not durable identifiers. Clients should keep or re-read stable `jobId`, `opportunityId`, `applicationId`, and `packageId` values before mutating state. If an ordinal-to-id mapping is stale or ambiguous, the client should ask for clarification rather than guessing.

## Audit trace

Every tool invocation writes a metadata-only trace under `logs/tool-calls/` in the private workspace. Traces include request/workspace/client/actor/tool/result/entity ids but intentionally exclude raw inputs, candidate documents, job text, credentials, and environment variables.

## Transport status

Alpha.10 provides the canonical tool service and manifest. It is **MCP-ready but not yet an MCP server**. A subsequent transport adapter can expose the same definitions over MCP without moving workflow logic into prompts or transport code.

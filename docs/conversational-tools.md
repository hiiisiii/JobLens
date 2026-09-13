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

`JobLensToolService` is the canonical transport-neutral boundary. It re-reads the private workspace on every call, so chat memory is never treated as authoritative state.

## Canonical tools

Read-only:

- `joblens_profile_get`
- `joblens_discovery_hits_list`
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

`JOBLENS_TOOL_DEFINITIONS` publishes names, descriptions, approval classes, and transport-neutral JSON-schema-shaped input definitions. Transport adapters should expose these tools without duplicating business rules.

## Client-assisted web discovery

A conversational client that already has web-search capability can call `joblens_discover` with `source: "web_search"`, a `providerId`, the executed JobLens query, and the returned search-result items.

JobLens stores each result as a durable `DiscoveryHitRecord` with a stable `hitId`, source provenance, query identity, first/last seen timestamps, and `DISCOVERED` or `MATERIALIZED` status. The records can be recovered later with `joblens_discovery_hits_list`, so a chat session is not required to remember which URLs were found.

Search snippets are not trusted as complete job descriptions. A web-search-only hit stays outside `JobPosting`, ranking, and application preparation until another explicit/authoritative source materializes and verifies the posting. This keeps broad search recall separate from evidence used for candidate-job decisions.

## Approval classes

- `READ_ONLY`: no durable mutation.
- `LOCAL_MUTATION`: changes private JobLens state but does not represent an external user decision.
- `EXPLICIT_DECISION`: requires an explicit user decision. `joblens_prepare` cannot infer approval from score, and APPLIED still requires explicit confirmation through `joblens_record_outcome`.
- `EXTERNAL_ACTION`: reserved for future integrations. v0.1 does not submit applications.

## Stable references

Conversation ordinals such as “the third one” are presentation conveniences, not durable identifiers. Clients should keep or re-read stable `hitId`, `jobId`, `opportunityId`, `applicationId`, and `packageId` values before mutating state. If an ordinal-to-id mapping is stale or ambiguous, the client should ask for clarification rather than guessing.

## Audit trace

Every tool invocation writes a metadata-only trace under `logs/tool-calls/` in the private workspace. Traces include request/workspace/client/actor/tool/result/entity ids but intentionally exclude raw inputs, candidate documents, job text, credentials, and environment variables.

## Local MCP stdio adapter

Alpha.11 adds an actual MCP server using the official MCP TypeScript SDK v2. The `joblens-mcp` executable exposes the canonical JobLens tools over stdio and keeps all workflow rules inside `JobLensToolService`.

```bash
npm install
npm run build

export JOBLENS_WORKSPACE="$HOME/.joblens/my-search"
export JOBLENS_WORKSPACE_ID="my-search"
node dist/mcp/bin.js
```

For an installed or linked package, a local MCP host can invoke the `joblens-mcp` bin directly. The adapter generates request ids server-side and never places the private workspace path inside the public tool payload.

The stdio adapter is for local MCP hosts. It does **not** make a local workspace reachable from a cloud-hosted ChatGPT session by itself. Remote ChatGPT/App integration requires a separately deployed remote transport with authentication, TLS, workspace authorization, and the same `JobLensToolService` behind it.

## MCP adapter scope

The first stdio adapter intentionally uses a permissive object schema at the transport boundary and delegates canonical validation to existing JobLens services. `JOBLENS_TOOL_DEFINITIONS` remains the portable product-level manifest; stricter per-tool MCP schemas can be generated from that manifest later without changing core behavior.

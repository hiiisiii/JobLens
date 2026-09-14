# JobLens v0.1.0 Release Notes

JobLens v0.1.0 is the first stable release of the local-first JobLens workflow engine.

The stable v0.1 scope is:

`setup -> discover -> verify/materialize -> rank -> research -> prepare -> review -> READY -> user submission -> outcome`

## Highlights

- Multi-source job discovery with manual input, Saramin Open API foundations, and client-assisted web-search ingestion.
- Verified discovery materialization so search snippets cannot enter ranking as canonical jobs without fetched posting content.
- Transparent ranking that separates Hard Gate, Fit Score, and Confidence.
- Korea-first deterministic role/location normalization, directional skill matching, and structured experience-evidence scoring.
- Evidence-grounded company research and application preparation with frozen source snapshots.
- Explicit approval boundaries: application preparation requires user approval, and `READY -> APPLIED` recording requires explicit user confirmation.
- Durable private workspace state for discovery hits, jobs, evaluations, opportunities, research, evidence, applications, packages, reviews, and outcomes.
- Executable CLI and local stdio MCP interfaces backed by the same transport-neutral `JobLensToolService`.
- Strict per-tool MCP input validation derived from the canonical tool manifest.
- Metadata-only tool-call audit traces that avoid persisting raw prompts, documents, or credentials.

## Release quality gate

The v0.1 release candidate completed the release gate with:

- Node.js 20 and 22 typecheck and full automated test suite passing;
- 96/96 automated tests passing;
- full workflow acceptance passing from verified discovery through READY and explicit user-confirmed APPLIED recording;
- `npm audit --audit-level=high` reporting 0 vulnerabilities on the Node 22 release job;
- `npm pack --dry-run` passing;
- clean installation from the generated npm-format tarball passing;
- installed `joblens --help` and `joblens setup` smoke paths passing;
- installed `joblens-mcp` stdio handshake, tool listing, and profile read passing;
- no unresolved blocker from the v0.1 privacy/security release audit.

## Distribution

v0.1.0 is distributed through GitHub Releases with an installable npm-format `.tgz` attached. Public npm-registry publication is intentionally deferred to post-v0.1 work.

After downloading the release tarball:

```bash
mkdir joblens-local && cd joblens-local
npm init -y
npm install /path/to/joblens-0.1.0.tgz

export JOBLENS_WORKSPACE="$HOME/.joblens/my-search"

./node_modules/.bin/joblens --help
./node_modules/.bin/joblens setup \
  --profile ./node_modules/joblens/workspace-template/profile/candidate.example.json
```

The bundled CandidateProfile is synthetic. Real candidate data, resumes, credentials, application history, and preferences must remain in a private workspace outside the public repository.

## Important boundaries

- JobLens does not submit applications externally in v0.1.
- A fit score is not a hiring probability.
- Real Saramin access-key dogfooding is not required for the v0.1 release because the release scope already covers the adapter contract and secret-handling boundary.
- Remote/cloud MCP transport, authentication, TLS, workspace authorization, additional Korean source adapters, outcome-driven recalibration, and npm-registry publication remain post-v0.1 work.

## Upgrade note

v0.1.0 promotes the `0.1.0-rc.1` contract to stable without adding new product features. Changes after RC are limited to release preparation and stable-version metadata unless a release-blocking correctness, privacy, durability, approval-boundary, or package-usability defect is discovered.

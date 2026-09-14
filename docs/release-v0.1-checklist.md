# JobLens v0.1 Release Checklist

This checklist defines the remaining work between the current alpha line and the first stable `v0.1.0` release.

The v0.1 product scope is frozen around the local-first workflow:

`setup -> discover -> verify/materialize -> rank -> research -> prepare -> review -> READY -> user submission -> outcome`

A release blocker is a defect that breaks this workflow, violates the approval/privacy boundary, corrupts durable state, exposes secrets/private candidate data, or makes the published package unusable. Other enhancements should move to the post-v0.1 backlog.

## 1. Core acceptance

- [x] Durable workspace storage exists for workflow entities.
- [x] Verified discovery hits can be materialized into canonical jobs.
- [x] Ranking separates Hard Gate, Fit Score, and Confidence.
- [x] Structured candidate experience evidence participates in relevant-experience scoring.
- [x] Research requires evidence-backed findings.
- [x] Application preparation requires explicit approval and freezes source evidence.
- [x] Review combines reviewer result with grounding checks.
- [x] `READY -> APPLIED` recording requires explicit user confirmation.
- [x] Full workflow acceptance test covers materialize -> rank -> research -> prepare -> review -> READY -> APPLIED recording.
- [x] Application grounding accepts both skill evidence and structured experience evidence.

Reference: `docs/acceptance-v0.1.md`.

## 2. Release hardening

- [x] CLI has a first-run `--help` / `-h` / `help` path rather than failing on empty input.
- [x] Unknown CLI commands point users to help.
- [x] npm package metadata includes repository, homepage, and issue tracker.
- [x] npm package uses an explicit `files` allowlist.
- [x] `prepack` rebuilds `dist` from source.
- [x] CI performs `npm pack --dry-run` packaging validation.
- [x] CI covers the declared Node.js 20+ baseline with Node 20 and 22.
- [x] CI runs `npm audit --audit-level=high`; current hardening run passed with no blocking dependency finding.
- [ ] Audit CLI validation/error messages across every command for consistent failure behavior.
- [ ] Re-check lifecycle/idempotency failure cases for materialize, rank, research, prepare, review, and outcome.
- [ ] Replace or formally accept the permissive MCP catch-all input schema for v0.1.

## 3. Privacy and security release audit

- [x] Public source tree contains no private CandidateProfile or real resume/workspace files by design.
- [x] Tool audit traces are metadata-only rather than raw prompt/document copies.
- [x] JSON-directory storage rejects path-traversal entity ids.
- [ ] Re-run repository scan for credentials, personal contact data, private workspace paths, and accidental fixtures.
- [ ] Verify API keys are not emitted in normal errors, command output, or audit traces.
- [x] Inspect package allowlist output: tests, source tree, `.env`, logs, caches, and workspace state are not in the dry-run package contents.
- [ ] Add/document the supported vulnerability-reporting process.

## 4. Documentation and first-run UX

- [x] README documents v0.1 workflow and local MCP boundary.
- [x] Ranking v0.4 semantics are documented.
- [x] v0.1 acceptance boundary is documented.
- [x] CLI help lists every v0.1 command and required environment variables.
- [x] A maintained `CHANGELOG.md` exists; finalize the `v0.1.0` section at stable release.
- [ ] Consolidate architecture/workflow documentation so a new user can understand the system without reading historical ranking docs in order.
- [ ] Add security/privacy release documentation.
- [ ] Verify all workspace-template examples still match current schemas and commands.
- [ ] Verify README quick start on a clean workspace from only published/release files.

## 5. Packaging and install verification

- [x] Package has explicit publish contents.
- [x] Package dry-run is part of CI.
- [x] Actual `npm pack --dry-run` output has been inspected; the package is limited to compiled `dist`, public docs/templates, package metadata, license/notices, README, and changelog.
- [ ] Install the generated tarball into a clean temporary project.
- [ ] Verify installed `joblens --help`.
- [ ] Verify installed `joblens` setup flow with a fresh private workspace.
- [ ] Verify installed `joblens-mcp` starts and completes an MCP stdio handshake.
- [ ] Decide whether v0.1.0 ships to npm, GitHub Releases only, or both.

## 6. Release Candidate gate

Create `0.1.0-rc.1` only after sections 2-5 have no unresolved release blockers.

For each RC:

- [ ] Version is `0.1.0-rc.N` in package and MCP advertised version.
- [ ] Typecheck passes on supported CI matrix.
- [ ] Full automated test suite passes on supported CI matrix.
- [ ] Package dry-run passes.
- [ ] Clean-install CLI smoke test passes.
- [ ] MCP smoke/integration test passes.
- [ ] Full workflow acceptance test passes.
- [ ] Privacy/security audit has no unresolved blocker.
- [ ] Only blocker fixes are accepted after RC starts; feature additions move to v0.2.

Separate real-world dogfooding may continue during RC. A dogfood finding blocks release only when it demonstrates a v0.1 correctness, privacy, durability, approval, or package-usability defect.

## 7. Stable v0.1.0 release

- [ ] Set package/MCP version to `0.1.0`.
- [ ] Finalize `CHANGELOG.md` and release notes.
- [ ] Run the RC release gate one final time on the release commit.
- [ ] Merge release commit to `main` with green CI.
- [ ] Create git tag `v0.1.0`.
- [ ] Create GitHub Release from `v0.1.0`.
- [ ] Publish to npm if npm distribution was selected.
- [ ] Verify installation from the released distribution, not the repository checkout.
- [ ] Verify `main` and release tag point to the intended release contents.

## Explicitly not required for v0.1.0

The following are post-v0.1 integration/product work unless testing exposes a core defect:

- live Saramin call with a real private access key;
- additional Korean source adapters;
- remote/cloud MCP transport, authentication, TLS, or workspace authorization;
- automatic external application submission;
- ranking-policy improvements beyond release-blocking correctness fixes;
- outcome-driven ranking recalibration;
- long-running real-user job-search dogfooding results.

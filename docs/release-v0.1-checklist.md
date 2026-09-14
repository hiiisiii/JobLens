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
- [x] CLI validation/error behavior is regression-tested for discover, materialize, research, prepare, review, and outcome required inputs; setup/rank remain valid argument-light commands.
- [x] Lifecycle/idempotency failure cases were re-checked across materialization, ranking, research, preparation/review, transition guards, and outcome recording through the existing regression suite plus full-workflow acceptance.
- [x] MCP no longer uses one permissive catch-all schema: each tool input is validated from the canonical manifest, with strict top-level keys, required fields, enum/const checks, and numeric/string constraints.

## 3. Privacy and security release audit

- [x] Public source tree contains no private CandidateProfile or real resume/workspace files by design.
- [x] Tool audit traces are metadata-only rather than raw prompt/document copies.
- [x] JSON-directory storage rejects path-traversal entity ids.
- [x] Repository code search was re-run against known personal identifiers, contact/link patterns, and private runtime path patterns; no tracked-code matches were found. This is a release audit, not a claim about Git history metadata.
- [x] API-key handling was re-checked: environment templates contain placeholders only, Saramin adapter coverage verifies the access key is not emitted in normalized output, and tool traces do not persist raw payloads.
- [x] Inspect package allowlist output: tests, source tree, `.env`, logs, caches, and workspace state are not in the dry-run package contents.
- [x] Vulnerability-reporting process is documented in `SECURITY.md`.

## 4. Documentation and first-run UX

- [x] README documents v0.1 workflow and local MCP boundary.
- [x] Ranking v0.4 semantics are documented.
- [x] v0.1 acceptance boundary is documented.
- [x] CLI help lists every v0.1 command and required environment variables.
- [x] A maintained `CHANGELOG.md` exists; the `v0.1.0` stable section is finalized on the release branch.
- [x] `docs/architecture.md` and `docs/workflow.md` provide a consolidated current-v0.1 architecture/workflow path without requiring historical ranking docs to be read in order.
- [x] Security/privacy release boundaries are documented in `SECURITY.md` and `docs/privacy-security.md`.
- [x] Public workspace-template JSON examples are regression-checked against current profile/materialization contracts and current research/application/review/outcome shapes.
- [x] First-run release path is verified from the generated package contents in a clean temporary project; source-checkout development instructions remain separate from packaged installation.

## 5. Packaging and install verification

- [x] Package has explicit publish contents.
- [x] Package dry-run is part of CI.
- [x] Actual `npm pack --dry-run` output has been inspected; the package is limited to compiled `dist`, public docs/templates, package metadata, license/notices, README, changelog, and security policy.
- [x] Generated tarball installs into a clean temporary npm project in CI.
- [x] Installed `joblens --help` executes successfully.
- [x] Installed `joblens setup` imports the bundled synthetic CandidateProfile into a fresh private workspace and the persisted profile is read back.
- [x] Installed `joblens-mcp` completes an MCP stdio handshake, lists canonical tools, and reads the profile persisted by installed CLI setup.
- [x] v0.1.0 distribution is GitHub Releases plus an attached installable npm-format `.tgz`; public npm-registry publication is deferred post-v0.1. See `docs/release-distribution.md`.

## 6. Release Candidate gate

`0.1.0-rc.1` passed the automated release-candidate gate on the release branch. Only release blockers should change the v0.1 line after this point.

For RC1:

- [x] Version is `0.1.0-rc.1` in package and MCP advertised version.
- [x] Typecheck passes on supported CI matrix.
- [x] Full automated test suite passes on supported CI matrix.
- [x] Package dry-run passes.
- [x] Clean-install CLI smoke test passes.
- [x] MCP smoke/integration test passes.
- [x] Full workflow acceptance test passes.
- [x] Privacy/security audit has no unresolved blocker.
- [x] Only blocker fixes are accepted after RC starts; feature additions move to v0.2.

Separate real-world dogfooding may continue during RC. A dogfood finding blocks release only when it demonstrates a v0.1 correctness, privacy, durability, approval, or package-usability defect.

## 7. Stable v0.1.0 release

- [x] Set package/MCP version to `0.1.0` on the stable release branch.
- [x] Finalize `CHANGELOG.md` and `docs/release-notes-v0.1.0.md`.
- [ ] Run the RC release gate one final time on the stable release commit.
- [ ] Merge release commit to `main` with green CI.
- [ ] Create git tag `v0.1.0`.
- [ ] Create GitHub Release from `v0.1.0`.
- [ ] Attach the release-gated npm-format `.tgz` to the GitHub Release.
- [ ] Verify installation from the released distribution, not the repository checkout.
- [ ] Verify `main` and release tag point to the intended release contents.

Stable release preparation intentionally stops before merge/tag/publication until the final release gate is green and the release is explicitly executed.

## Explicitly not required for v0.1.0

The following are post-v0.1 integration/product work unless testing exposes a core defect:

- live Saramin call with a real private access key;
- additional Korean source adapters;
- remote/cloud MCP transport, authentication, TLS, or workspace authorization;
- automatic external application submission;
- public npm-registry publication;
- ranking-policy improvements beyond release-blocking correctness fixes;
- outcome-driven ranking recalibration;
- long-running real-user job-search dogfooding results.

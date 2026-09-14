# Changelog

All notable changes to JobLens are documented here.

The project follows semantic versioning for stable releases. Pre-release alpha and RC versions may still change internal contracts while preserving the documented privacy and explicit-approval boundaries.

## [Unreleased]

## [0.1.0] - 2026-09-14

### Stable release

- Promoted the release-candidate contract to the first stable JobLens release without adding new product features after RC1.
- Finalized the stable package and MCP advertised version as `0.1.0`.
- Finalized public release notes and GitHub Release distribution instructions.
- Retained the v0.1 local-first workflow, privacy boundary, explicit user-approval requirements, and no-auto-submit policy validated by RC1.

### Verification

- Node.js 20 and 22 typecheck and full automated suites passed on the RC release gate.
- 96/96 automated tests passed, including the full verified-discovery -> READY -> explicit user-confirmed APPLIED acceptance path.
- Node 22 dependency audit reported 0 vulnerabilities.
- `npm pack --dry-run`, generated-tarball clean install, installed CLI setup, and installed MCP stdio smoke verification passed.
- The pre-release privacy/security audit had no unresolved release blocker.

See `docs/release-notes-v0.1.0.md` for user-facing release notes and `docs/release-v0.1-checklist.md` for the release gate.

## [0.1.0-rc.1] - 2026-09-14

### Release candidate

- Promoted the v0.1 line from alpha hardening to the first release candidate.
- Replaced permissive MCP catch-all inputs with strict manifest-derived per-tool validation.
- Added release regression coverage for CLI validation and lifecycle/idempotency failure paths.
- Added metadata-only tool audit checks, path-traversal storage protection coverage, and release privacy/security documentation.
- Added public workspace-template contract checks for profile, materialization, research, application, review, and outcome examples.
- Added generated-tarball clean-install verification covering installed `joblens --help`, installed `joblens setup`, persisted profile readback, and installed `joblens-mcp` stdio handshake.
- Consolidated current v0.1 workflow and architecture documentation and separated source-checkout instructions from packaged-release installation.
- Selected GitHub Releases plus an attached npm-format `.tgz` as the v0.1 distribution path; public npm-registry publication remains post-v0.1 work.

## [0.1.0-alpha.18] - 2026-09-14

### Added

- Full durable v0.1 workflow acceptance coverage from verified discovery through ranking, research, preparation, review/grounding, READY, and explicit user-confirmed APPLIED recording.
- Documentation of the v0.1 code-level acceptance boundary.

### Fixed

- Application preparation now includes `experienceEvidence[].evidenceIds` in the frozen candidate evidence set, so experience used by ranking can also ground application claims.

### Verification

- 81 automated tests passed at the alpha.18 acceptance point.
- TypeScript typecheck and post-merge main CI passed.

## Earlier alpha milestones

- `alpha.17`: Ranking policy v0.4 live Korea-first JD calibration and conservative technology-only experience scoring.
- `alpha.16`: Structured `experienceEvidence` and evidence-backed relevant-experience scoring.
- `alpha.15`: Korea-first role/location normalization and directional skill matching calibration.
- `alpha.14`: Executable CLI materialization flow and completed CLI dispatch path.
- `alpha.13`: Verified DiscoveryHit -> JobPosting materialization bridge.
- `alpha.12`: Durable client-assisted web-search discovery hits.
- `alpha.11`: Local stdio MCP adapter using the official MCP TypeScript SDK.
- `alpha.10`: Transport-neutral conversational `JobLensToolService`.
- `alpha.9`: Explicit submission snapshots and outcome lifecycle.
- `alpha.8`: Application preparation, reviewer, and grounding workflow.
- `alpha.7`: Evidence-grounded research.
- `alpha.6`: Persistent ranking evaluations and opportunities.
- earlier alphas: core domain, storage, discovery, Saramin/manual source foundations, ranking, and private workspace setup.

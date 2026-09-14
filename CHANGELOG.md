# Changelog

All notable changes to JobLens are documented here.

The project follows semantic versioning for stable releases. Pre-release alpha and RC versions may still change internal contracts while preserving the documented privacy and explicit-approval boundaries.

## [Unreleased]

### Release hardening

- Added first-run CLI help for empty input, `--help`, `-h`, and `help`.
- Added npm package repository/homepage/issue metadata and an explicit publish allowlist.
- Added `prepack` build and `npm pack --dry-run` validation.
- Expanded CI to Node.js 20 and 22, matching the declared `node >=20` engine baseline.
- Added the v0.1 release checklist and release-blocker definition.

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

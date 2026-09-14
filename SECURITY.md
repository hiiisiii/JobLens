# Security Policy

JobLens is a local-first job-search workflow that may process private candidate profiles, application drafts, research notes, and API credentials. Do not include real candidate data, credentials, or private workspace state in public issues, pull requests, or example fixtures.

## Supported versions

Security fixes are currently targeted at the latest published `0.1.x` line and the active `main` branch.

## Reporting a vulnerability

Please report suspected vulnerabilities through GitHub's private security-reporting channel when it is available for this repository. If private reporting is not available, open a minimal public issue that contains no exploit details, credentials, personal data, workspace contents, or secret values, and request a private follow-up channel.

A useful report should include:

- affected JobLens version or commit;
- affected command, MCP tool, or storage path;
- expected vs. observed security boundary;
- minimal reproduction steps that use synthetic data only;
- impact assessment.

Do not publish live API keys, resumes, contact information, application records, or another person's data as part of a report.

## Security boundaries in v0.1

- JobLens does not auto-submit job applications.
- `prepare` requires explicit approval, and recording `APPLIED` requires explicit user confirmation.
- Private workspace state is intended to live outside the public repository.
- Runtime secrets are supplied by environment/configuration and are not written into normal tool traces.
- Tool audit traces are metadata-only.
- JSON-directory storage rejects path-traversal entity identifiers.
- The local MCP transport does not imply remote/cloud access to the workspace.

These boundaries are release requirements. A regression that bypasses approval, leaks credentials/private candidate data, corrupts durable state, or exposes unintended filesystem data should be treated as a release blocker.

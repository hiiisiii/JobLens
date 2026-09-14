# Privacy and Security — v0.1

JobLens is designed as a local-first workflow engine. The public repository contains code, public examples, and documentation; a user's real candidate profile, resumes, research, application packages, outcomes, credentials, and durable workspace state belong in a private workspace.

## Data separation

Public repository:

- source code and compiled package contents;
- synthetic/example candidate and job data;
- public documentation and release metadata.

Private workspace:

- real CandidateProfile data;
- resumes and other source documents referenced by the user;
- discovery hits, canonical jobs, evaluations, opportunities, research evidence;
- application packages, reviews, tracker/outcome state;
- logs or temporary state created during private use.

The package publish allowlist excludes source tests, `.env`, logs, and workspace state. A clean package dry-run is part of CI.

## Credentials

Runtime credentials such as `SARAMIN_ACCESS_KEY` are supplied through environment/configuration. The checked-in `.env.example` contains names/placeholders only. Credentials must never be copied into profiles, examples, application artifacts, public issues, or audit traces.

Saramin adapter regression coverage verifies that the access key is not surfaced in normalized search output. Tool traces store request metadata and entity references, not raw tool payloads.

## Approval boundaries

JobLens v0.1 deliberately separates local workflow mutation from real-world external action.

- application preparation requires explicit approval;
- reviewer/grounding checks must pass before `READY`;
- JobLens does not auto-submit an application;
- recording `APPLIED` requires explicit user confirmation that the external submission occurred.

An assistant or client must not infer these confirmations from ranking score, opportunity state, or prior conversation context.

## MCP boundary

The v0.1 MCP server is local stdio. It does not provide remote/cloud transport, authentication, TLS termination, or remote workspace authorization.

MCP inputs are validated using per-tool schemas derived from the canonical tool manifest. Undeclared top-level fields are rejected for strict tool schemas, required identifiers remain mandatory, numeric bounds are enforced, and explicit-decision values such as `userApproved: true` cannot be inferred.

Remote MCP is post-v0.1 work and requires a separate threat model.

## Filesystem boundary

The JSON-directory store validates entity identifiers to prevent path traversal. Workspace state should be kept outside the public clone when it contains real personal data. The standard workspace paths are ignored by Git, but ignore rules are defense in depth rather than a substitute for using a private workspace.

## Release audit

Before v0.1.0, the release gate requires:

- typecheck and automated tests on supported Node versions;
- dependency audit at the configured severity threshold;
- package allowlist and `npm pack --dry-run` inspection;
- CLI and MCP failure/validation regression coverage;
- repository/fixture review for secrets and personal data;
- clean-install smoke testing of the generated tarball.

See `docs/release-v0.1-checklist.md` for the tracked release gate and `SECURITY.md` for vulnerability reporting.

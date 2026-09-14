# JobLens v0.1 Workflow

This document is the single operational overview for the v0.1 local-first workflow. Historical ranking documents explain policy changes, but users do not need to read them in order to operate JobLens.

## 1. Boundary

JobLens is a workflow engine, not an auto-apply bot. Candidate data and durable job-search state live in a private workspace. The public repository contains only framework code and synthetic examples.

The v0.1 path is:

`setup -> discover -> verify/materialize -> rank -> research -> prepare -> review -> READY -> user submission -> outcome`

External application submission is intentionally outside JobLens. A high ranking score never authorizes preparation or submission.

## 2. Setup

`setup` imports the authoritative CandidateProfile into the configured private workspace. The profile can contain evidence-backed skills plus optional structured `experienceEvidence` records. Real resumes, portfolio files, credentials, and application history should remain outside a public clone.

## 3. Discovery and verification

Discovery can come from manual posting input, Saramin when a private access key is configured, or a client-assisted web search through `JobLensToolService`/MCP.

Web-search results are durable `DiscoveryHitRecord` objects, not canonical jobs. Search snippets cannot be ranked. The client must fetch the actual posting page and call `materialize`/`joblens_materialize_hit` with verified content before the record becomes a canonical `JobPosting`.

Repeated materialization is idempotent and duplicate handling preserves canonical job identity where possible.

## 4. Ranking

Only canonical `JobPosting` records enter ranking. Ranking produces a durable evaluation and an `Opportunity`.

Three signals remain separate:

- **Hard Gate**: PASS / FLAG / FAIL for explicit eligibility and seniority constraints.
- **Fit Score**: weighted 0-100 suitability score for viable/flagged postings.
- **Confidence**: strength of evidence supporting the assessment.

Ranking policy v0.4 is the current v0.1 policy. See `docs/ranking-v0.4.md` for scoring details.

## 5. Research

Research converts external evidence into `SourceEvidence` plus evidence-linked findings. Verified facts, analysis, opportunities, risks, and community signals are separate finding classes. Unsupported claims are rejected rather than silently inferred.

An opportunity must have been ranked before research. Explicit user states such as HOLD are preserved rather than overwritten by background processing.

## 6. Preparation

Application preparation begins only after an explicit user decision. CLI preparation requires `--approve`; conversational tooling requires `userApproved: true`.

Preparation freezes the CandidateProfile version, selected JobPosting, available research, and allowed evidence ids into an `ApplicationPackage`. Draft claims must reference the frozen evidence set. A fit score alone never creates an application.

## 7. Review and READY

Review combines a reviewer result with the automatic grounding audit. READY requires:

- reviewer status `PASS`; and
- zero grounding blockers.

If either condition fails, the application remains in or returns to a revision path. READY means the package is prepared for the user to submit; it does not mean JobLens submitted anything.

## 8. Submission and outcomes

The user submits through the real external portal. After the real event, JobLens can record `APPLIED` only with explicit `userConfirmed: true`. The submitted package metadata is frozen into a SubmissionSnapshot.

Interview, offer-stage, completion, and withdrawal events continue through the application lifecycle. Repeating the same event is idempotent when it resolves to the same event key.

## 9. Interfaces

The same workflow rules are shared across interfaces:

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
private workspace + source adapters
```

The local MCP transport is stdio only in v0.1. It does not make a private workstation remotely accessible. Remote/cloud transport, authentication, TLS, and workspace authorization are post-v0.1 concerns.

## 10. Stable identities

Durable ids are authoritative. Clients should re-read `hitId`, `opportunityId`, `applicationId`, and package ids instead of relying on a stale conversational ordinal such as "job #3".

## 11. Release acceptance

`docs/acceptance-v0.1.md` defines the automated end-to-end acceptance boundary. `docs/release-v0.1-checklist.md` defines the release gate. Real-world job-search dogfooding can continue independently; only correctness, privacy, durability, approval-boundary, or package-usability defects block v0.1 release.

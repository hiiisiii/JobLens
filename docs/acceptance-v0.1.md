# JobLens v0.1 full-workflow acceptance

Captured: 2026-09-14

## Acceptance goal

The v0.1 acceptance test verifies that one evidence-grounded opportunity can cross the durable JobLens lifecycle without bypassing the normal domain services:

`DiscoveryHit -> verified JobPosting -> JobEvaluation / Opportunity -> CompanyResearch -> ApplicationPackage -> review / grounding -> READY -> explicit user-confirmed APPLIED record`

This is a deterministic CI acceptance test. It does **not** submit a real application and it does **not** perform network access during CI.

## Live-derived job shape

The acceptance fixture was derived from a current public Seoul Node.js backend listing captured on 2026-09-14:

- JobKorea posting: https://www.jobkorea.co.kr/Recruit/GI_Read/49858205
- captured shape: early-career Node.js backend role, relational database experience, REST/API responsibilities, architecture/cloud-operation scope, and adjacent technologies such as AWS/NestJS/Docker/GraphQL

The test stores a short paraphrased fixture rather than copying the full posting. The external page remains volatile and may later close or change; CI intentionally tests the captured contract rather than depending on the live page.

## Candidate fixture and privacy

The test candidate is synthetic. It is designed to exercise the same public CandidateProfile contracts used by a real private workspace, including structured `experienceEvidence`, but contains no real resume, contact information, credentials, or private application history.

## Grounding defect found by the acceptance pass

Ranking v0.3/v0.4 can attach `experienceEvidence[].evidenceIds` to `relevantExperience`. Application preparation originally allowed only `skills[].evidenceIds` plus research/job evidence into its frozen grounding set. This created an inconsistent boundary: structured project evidence could justify ranking but could not justify a factual application claim.

Alpha.18 fixes that boundary by freezing both skill evidence and structured experience evidence into the application package's allowed candidate evidence set.

## Acceptance assertions

The test verifies that:

- a durable discovery hit must be explicitly materialized before ranking;
- ranking uses policy v0.4 and preserves structured experience evidence ids;
- research persists evidence and makes the opportunity reviewable;
- application preparation accepts only evidence inside the frozen candidate/job/research source set;
- structured experience evidence can ground an application claim;
- reviewer PASS is insufficient by itself if grounding blockers exist;
- a clean review transitions the application to READY;
- APPLIED is only a record of a user-confirmed external submission event;
- the submission snapshot freezes candidate-profile and artifact versions/hashes;
- discovery, evaluation, opportunity, research, application, package, and review records all survive in durable workspace stores.

## Boundary

Passing this acceptance test means the **v0.1 code-level workflow is complete and deterministic end-to-end**.

It does not mean:

- a cloud ChatGPT session can access a user's local private workspace;
- a Saramin live API request has succeeded without a real access key;
- JobLens automatically submits applications;
- the synthetic fixture represents an actual user application.

Those are deployment/integration or user-action concerns outside the v0.1 core acceptance criterion.

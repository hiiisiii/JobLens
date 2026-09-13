# Ranking policy v0.4

Ranking policy v0.4 is a calibration release based on live Korea-first backend job patterns observed on 2026-09-14. It does not encode employer-specific preferences. The goal is to make the deterministic `relevantExperience` dimension less optimistic when a posting contains responsibilities that are not represented in grounded candidate evidence.

## Live calibration set

The implementation was checked against public posting patterns from the following pages. These links are volatile external evidence and may close or change after the calibration date.

- Bagelcode `[Platform] 서버 개발자 (신입)` — https://www.culturejob.co.kr/job/bagelcode-platform-seobeo-gaebalja-sinnip-5dmbouqf
- Bagelcode `[CVS] 서버 개발자 (신입)` — https://www.culturejob.co.kr/job/bagelcode-cvs-seobeo-gaebalja-sinnip-03ftHn1D
- Integration `[AX] [인턴] 백엔드 개발자` — https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=54390964
- StoneEye `백엔드 개발자 (신입/경력)` — https://careerly.co.kr/job/7853
- Goodoc `백엔드 엔지니어 (Node.js, 5년 이상)` — discovered through a current public job index; the deterministic gate expectation is driven by the explicit 5+ year requirement, not by source reputation.

The repository does not copy full posting text into fixtures. Tests use short synthetic phrases that reproduce capability patterns seen in those postings.

## What changed

### 1. Broader but still explicit capability signals

v0.4 recognizes additional responsibility categories that appeared repeatedly in live backend postings:

- `data-modeling`
- `performance-optimization`
- `incident-response`
- `system-architecture`
- `llm-integration`
- `database-migration`

The existing API capability also recognizes common Korea-first forms such as `API 서버` and `백엔드 API`.

These categories are deterministic string signals, not semantic inference. A signal only contributes positively when the candidate profile contains a grounded experience capability with the same canonical id.

### 2. Technology-only experience is no longer treated as complete experience evidence

In v0.3, a verified posting with no recognized capability wording could produce a `relevantExperience` score of 100 when all required technologies were present in experience records. That was too optimistic: matching a technology stack does not establish that the candidate performed the responsibilities in the posting.

When structured experience exists but no capability signal can be detected, v0.4 shrinks technology-only coverage toward a neutral score of 50:

`relevantExperience = 0.5 * technologyCoverage + 0.5 * 50`

A perfect technology match therefore produces 75 rather than 100 until responsibility-level evidence is available. Confidence is capped at `MEDIUM` for this technology-only case.

### 3. Unsupported senior responsibilities can lower fit without becoming fake hard gates

A new-grad posting can still contain responsibilities such as production incident response, performance optimization, infrastructure architecture, or LLM/RAG integration. These are not automatic disqualifiers. Instead, they lower the grounded `relevantExperience` score unless candidate evidence demonstrates them.

This preserves the distinction between:

- **Hard Gate** — explicit conditions such as a 5+ year minimum or a senior title;
- **Fit Score** — how well current evidence matches the role;
- **Confidence** — how strong the available evidence is.

## Expected calibration behavior

- explicit 5+ year roles remain `FAIL` for an early-career target;
- 3–4 year minimums remain `FLAG`;
- a 2-year-or-equivalent project requirement remains rankable rather than being automatically excluded;
- Korea-first new-grad backend/server titles continue to align with English backend targets;
- live JDs that ask for incident response, architecture, performance work, migrations, or LLM integration no longer receive full relevant-experience credit from stack overlap alone.

## Boundary

v0.4 does not infer years of professional backend experience from bootcamp or personal projects. It also does not claim that deterministic capability extraction understands arbitrary prose. Verified posting materialization and careful requirement extraction remain upstream requirements, and fit scores remain comparative evidence signals rather than hiring probabilities.

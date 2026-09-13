# Ranking policy v0.2

JobLens ranking is a triage system, not a hiring-probability model. It keeps three signals separate:

- **Hard Gate**: whether the role is clearly viable, needs review, or should be excluded.
- **Fit Score**: a weighted comparison score for viable roles.
- **Confidence**: how strong the available posting evidence is.

## Why v0.2 exists

The first live Korea-first dogfood pass exposed deterministic matching errors that were easy to reproduce without adding an LLM to the ranking core:

1. Korean titles such as `서버 개발자 (신입)` did not align with English backend target-role strings.
2. `서울` did not align with a candidate preference stored as `Seoul`.
3. Symmetric substring skill matching could let generic evidence such as `SQL` satisfy a more specific requirement such as `MySQL`.
4. An empty preferred-skill list implicitly produced a perfect preferred-skill score and therefore an undeserved adjacency bonus.
5. The `roleAndLevel` dimension did not use explicit entry/junior/new-grad level evidence.

v0.2 fixes these errors while keeping the model deterministic and auditable.

## Role and level matching

The matcher uses a small conservative vocabulary for common backend/server role families in Korean and English. It recognizes backend/server terms and developer/engineer terms, while explicitly penalizing frontend-only titles for a backend target.

For early-career profiles, explicit signals such as `Entry`, `Junior`, `Intern`, `New grad`, `신입`, `주니어`, `인턴`, and `경력무관` contribute level evidence. When only a structured minimum-years requirement is available, lower minimums receive stronger level alignment than three-to-four-year requirements.

This does not replace Hard Gates. A role requiring five or more years still fails for an early-career target, and a three-to-four-year minimum remains flagged for review.

## Location matching

A small alias map handles common bilingual forms such as `Seoul`, `서울`, and `서울특별시`. Matching stays deterministic; JobLens does not infer arbitrary geographic equivalence.

## Directional skill matching

Skill matching is intentionally asymmetric.

A candidate's specific evidenced skill may satisfy a broader requirement when the relationship is unambiguous. For example:

- `PostgreSQL` may satisfy a generic `SQL` requirement.
- `GitHub Actions` may satisfy a generic `CI/CD` requirement.
- an AWS-specific skill may satisfy a generic `AWS` or `cloud` requirement where the mapping is explicitly defined.

The reverse is not assumed. Generic `SQL` evidence does **not** satisfy a specific `MySQL` requirement. This avoids overstating candidate evidence.

A limited alias table also normalizes common spelling variants such as `NodeJS`/`Node.js`, `Postgres`/`PostgreSQL`, and `K8s`/`Kubernetes`.

## Preferred skills and adjacency

If a posting provides no preferred-skill data, v0.2 does not award a perfect preferred-skill score. The adjacency-and-learning dimension falls back to required-skill coverage instead of receiving a free bonus from missing data.

## Current limitation: relevant experience

The `relevantExperience` dimension is still a deterministic proxy based on required-skill evidence. It does not yet compare structured candidate experience episodes against structured job responsibilities or minimum-experience claims.

That limitation is deliberate and visible. Future structured experience matching should add evidence-backed experience records rather than hide an LLM inference inside the deterministic score.

## Evidence boundary

Ranking quality depends on normalized job data. Search snippets are not rankable evidence. A web-search hit must first be verified/materialized into a canonical `JobPosting`, and the quality of extracted required/preferred skills and experience requirements remains an upstream responsibility.

Unsupported aliases or ambiguous relationships should remain unmatched instead of being guessed. Semantic AI evaluation can later be layered on top as a separate, evidence-linked signal rather than silently changing deterministic v0.2 behavior.

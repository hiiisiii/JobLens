# Ranking policy v0.3

JobLens ranking keeps three signals separate:

- **Hard Gate** decides whether a posting is viable, review-required, or excluded.
- **Fit Score** compares the canonical posting with the candidate profile.
- **Confidence** describes how strong the available evidence is; it is not a hiring probability.

## Structured experience evidence

`CandidateProfile` can now include optional `experienceEvidence` records. Each record is a grounded project or work episode with:

- a stable `experienceId`;
- a human-readable title and summary;
- explicit capability tags;
- technologies actually used in that episode;
- one or more evidence ids that point back to portfolio, PR, resume, or other private source material.

The validator rejects experience records that omit evidence ids. The public framework does not infer or fabricate candidate experience.

## Relevant experience score

Policy v0.3 stops treating the `relevantExperience` dimension as a simple duplicate of required-skill coverage when structured experience is available.

The deterministic matcher extracts a conservative set of capability signals from the verified job title/full text, including API design, authorization, transactions, data integrity, state management, validation, testing, API documentation, CI/CD, cloud operations, monitoring, file processing, and integration debugging.

It then compares those signals with the candidate's grounded experience records and separately compares required technologies with technologies actually used in those records.

When both types of evidence are available, the dimension combines:

- 60% capability coverage;
- 40% experienced-technology coverage.

The dimension also carries the evidence ids of the contributing experience records. Two or more contributing experience records yield HIGH dimension confidence, one yields MEDIUM, and no contributing record yields LOW.

## Backward compatibility

Profiles without `experienceEvidence` remain valid. They use the previous required-skill proxy for the numerical relevant-experience score, but that dimension is explicitly LOW confidence and the rationale marks it as a legacy fallback. This preserves existing profiles without pretending that a skill inventory proves hands-on experience.

## Conservative matching

Capability detection is intentionally deterministic and narrow. It does not use an LLM inside the ranking core and it does not attempt a complete semantic interpretation of arbitrary job descriptions. Unsupported wording remains unmatched rather than guessed.

The Korea-first role/location normalization and directional skill matching introduced in v0.2 remain unchanged. Specific evidence can satisfy an appropriate generic requirement (for example PostgreSQL -> SQL), while generic evidence must not satisfy a more specific requirement (SQL !-> MySQL).

## Known limitations

- Capability extraction still depends on wording in the verified posting text.
- `experienceEvidence` quality depends on the candidate workspace being curated from real source material.
- Duration, scale, ownership depth, and recency are not yet modeled as separate experience factors.
- The score does not estimate hiring probability and does not replace human review.

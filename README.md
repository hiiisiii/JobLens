# JobLens

JobLens is an open-source, evidence-grounded job-search workflow engine.

It separates the public framework from each user's private workspace and supports multiple clients such as CLI and conversational AI tool adapters.

## v0.1 workflow

`setup -> discover -> rank -> research -> prepare -> review -> READY -> user submission -> outcome`

Key principles:

- multi-source discovery instead of dependence on one job board;
- Hard Gate + Fit Score + Confidence instead of a single opaque score;
- evidence/provenance for important claims;
- explicit human approval before application preparation and submission state changes;
- conversational clients call the same canonical application services as the CLI;
- private user data never belongs in the public repository.

This repository is currently in Phase 1 core implementation.

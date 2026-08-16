# PromptDiff Documentation

PromptDiff V0.1 is a local-first CLI for deterministic comparison and regression testing of captured AI outputs.

## User and Contributor Documentation

- [`strategy/V0.1_SCOPE.md`](strategy/V0.1_SCOPE.md) — V0.1 scope and explicit non-goals.
- [`strategy/PRODUCT_PRINCIPLES.md`](strategy/PRODUCT_PRINCIPLES.md) — durable product principles.
- [`architecture/V0.1_ARCHITECTURE.md`](architecture/V0.1_ARCHITECTURE.md) — package boundaries and data flow.
- [`architecture/REPOSITORY_BLUEPRINT.md`](architecture/REPOSITORY_BLUEPRINT.md) — public repository layout and dependency direction.
- [`architecture/SECURITY_AND_PRIVACY.md`](architecture/SECURITY_AND_PRIVACY.md) — local-first privacy and security boundaries.
- [`architecture/decisions/`](architecture/decisions/) — accepted architecture decisions.
- [`schema/`](schema/) — frozen V0.1 behavioral/data contracts.
- [`development/DEVELOPMENT_STANDARDS.md`](development/DEVELOPMENT_STANDARDS.md) — engineering standards.
- [`development/TESTING_STRATEGY.md`](development/TESTING_STRATEGY.md) — test layers and required edge coverage.
- [`development/QUALITY_AND_SECURITY.md`](development/QUALITY_AND_SECURITY.md) — durable quality/security verification guidance.
- [`release/V0.1_RELEASE_NOTES.md`](release/V0.1_RELEASE_NOTES.md) — factual V0.1 release notes.

## Core Contract

> PromptDiff compares Baseline and Candidate outputs locally, runs deterministic checks, classifies differences and regressions, and emits versioned Evidence without requiring an AI provider, API key, cloud account, or database.

Machine verdict and human approval remain separate. A content Difference alone is not a Regression.

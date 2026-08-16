# ADR-0009 — Versioned Evidence Contract

**Status:** Accepted

## Context
Evidence may later be consumed by scripts, CI, PR tooling, QA processes, or NPD PLUS products; silent schema changes would break trust/integration.

## Decision
V0.1 Evidence uses independent format version `1`. The evidence format version is distinct from package/tool semantic version.

## Consequences
Breaking public Evidence schema changes require deliberate versioning/migration policy. Additive changes must remain semantically clear and backward-compatible where promised.

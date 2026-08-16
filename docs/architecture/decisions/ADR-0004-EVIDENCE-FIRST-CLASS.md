# ADR-0004 — Evidence Is First-Class

**Status:** Accepted

## Context
Console text alone is unsuitable for reliable review, CI, audit, or future integration.

## Decision
Evidence is a structured domain result with its own versioned contract. Console and Markdown are renderings; JSON is the canonical machine-readable serialization.

## Consequences
Reporters must not recalculate semantics. Evidence design must consider portability, determinism, compatibility, and sensitive-content exposure from the beginning.

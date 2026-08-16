# ADR-0002 — Local-First Architecture

**Status:** Accepted

## Context
AI prompts/outputs may contain sensitive business or personal data, and V0.1 value does not require hosted infrastructure.

## Decision
Core comparison, checks, verdicts, and evidence operate locally by default and can run offline after dependencies are installed.

## Consequences
No mandatory account/server/telemetry/upload. Future cloud features must be opt-in and must not make local core behavior dependent on cloud availability.

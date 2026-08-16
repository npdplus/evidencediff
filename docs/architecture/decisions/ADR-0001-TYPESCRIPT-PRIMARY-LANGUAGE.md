# ADR-0001 — TypeScript as Primary Language

**Status:** Accepted

## Context
EvidenceDiff V0.1 is a developer tool centered on a reusable core, CLI, local files, and possible future browser/Node integrations.

## Decision
Use TypeScript as the primary implementation language with Node.js LTS and pnpm workspace tooling.

## Consequences
Core/CLI/contracts share one type system and ecosystem. Python/.NET integrations remain possible later through adapters/process/API boundaries; V0.1 does not add a second primary language.

## Revisit When
A proven use case requires capabilities TypeScript/Node cannot reasonably provide or adoption strongly requires another first-class SDK/runtime.

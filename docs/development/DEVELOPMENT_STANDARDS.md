# EvidenceDiff Development Standards

**Status:** Accepted V0.1 Engineering Standard

## Language / Runtime

- TypeScript as primary language;
- Node.js LTS;
- pnpm workspace;
- strict type checking;
- deterministic, portable behavior where practical.

## Code Organization

Respect package dependency direction from `architecture/REPOSITORY_BLUEPRINT.md`. Domain behavior belongs in Core/Checks, not CLI/reporters. Provider/UI/storage imports are forbidden in Core.

## Quality Commands

P01 must establish reproducible repository commands for install, build, type-check, lint, formatting verification, and tests. Every later phase keeps them green.

## Dependencies

Add a runtime dependency only when it solves a concrete V0.1 problem, is maintained/licensed appropriately, does not violate local-first boundaries, and is clearer than existing platform/project capabilities.

## Error / Logging Discipline

Public errors are actionable and privacy-safe. Do not expose secrets or unnecessary raw output. Avoid catch-and-ignore behavior.

## Documentation Discipline

Material semantic changes update the relevant schema/spec and, when architectural, an ADR. Do not make source code the only record of a changed contract.

## Scope Discipline

No speculative provider adapters, Viewer, database, generalized plugin framework, cloud service, or V0.2 feature during V0.1 implementation phases.

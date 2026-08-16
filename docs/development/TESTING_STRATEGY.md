# PromptDiff V0.1 Testing Strategy

**Status:** Accepted Quality Baseline

PromptDiff claims to verify AI-output changes; its own behavior must therefore be strongly and deterministically tested.

## Test Layers

### Unit
Contracts, parsers/validators, diff primitives, each check, regression classification, verdict aggregation, Evidence assembly, reporters.

### Integration
Package boundaries, Test Definition loading, Baseline/Candidate evaluation, reporter consistency, error mapping.

### E2E
Real CLI invocation for `compare` and `test`, exit codes, stdout/stderr, report files, safe overwrite behavior, and offline execution.

### Fixtures
Synthetic text/JSON/configuration data including malformed inputs and privacy-safe edge cases.

## Required Edge Coverage

Nested objects, arrays/order, missing vs null, type changes, invalid JSON, Unicode/newlines, malformed regex/range, token/latency metadata absent/present, unchanged failure, regression, improvement, no-check REVIEW, explicit review requirement, deterministic ordering, reporter snapshots with non-deterministic metadata normalized.

## Required Example Scenarios

Structured JSON regression, prompt-output regression, captured Model A/B comparison, budget regression, and review-only comparison.

## Phase Rule

Every implementation phase adds tests at the layer it changes and reruns all existing quality commands before freeze.

# PromptDiff V0.1 Check Model

**Status:** Frozen Required Check Catalog

All V0.1 checks are deterministic. Invalid configuration is an execution/configuration error, not a Candidate `FAIL`.

## Common Check Result

Each result preserves: check id/type, Baseline status when applicable, Candidate status, expected/actual diagnostics where useful, concise explanation, and stable machine-readable details.

## Required Check Types

- `json-valid`
- `required-field`
- `field-type`
- `exact`
- `contains`
- `not-contains`
- `regex`
- `numeric-range`
- `allowed-values`
- `output-length`
- `token-budget`
- `latency-budget`

## Configuration Contract

P02 freezes the configuration-field names and value shapes below so malformed check configuration can be rejected before evaluation. These fields define configuration only; check execution remains P04.

Every check supports:

- optional non-empty `id`;
- required `type` from the catalog above;
- optional `description` string;
- `target` only where allowed below, using RFC 6901 JSON Pointer syntax.

Unknown fields are configuration errors.

Check-specific fields:

- `json-valid`: no additional fields; `target` is not allowed;
- `required-field`: required `target`;
- `field-type`: required `target` and required `expectedType`, one of `string`, `number`, `boolean`, `object`, `array`, `null`;
- `exact`: required `expected` JSON-compatible value; optional `target`;
- `contains`: required string `value`; optional `target`;
- `not-contains`: required string `value`; optional `target`;
- `regex`: required non-empty string `pattern`; optional `target`; malformed regular-expression syntax is a configuration error;
- `numeric-range`: optional finite numeric `min` and `max`, with at least one required and `min <= max` when both exist; optional `target`;
- `allowed-values`: required non-empty `values` array of JSON-compatible values; optional `target`;
- `output-length`: optional non-negative integer `min` and `max`, with at least one required and `min <= max` when both exist; optional `target`;
- `token-budget`: required non-negative integer `maxTokens`; `target` is not allowed;
- `latency-budget`: required finite non-negative number `maxLatencyMs`; `target` is not allowed.

The P04 implementation defines evaluation behavior for these already-frozen configuration shapes. P02 must not execute the checks.

## Semantics

Structured targets use JSON Pointer. No implicit trimming, case folding, coercion, or numeric tolerance unless explicitly defined by the check parameters. Malformed regex/ranges/types are configuration errors.

Token/latency checks consume supplied metadata; PromptDiff does not call a model or measure provider execution in V0.1. Missing required metadata is an explicit configuration/evaluation availability error according to the implementation contract, never a guessed value.

## Regression Use

Where meaningful, the same check is evaluated against Baseline and Candidate. Baseline PASS -> Candidate FAIL is a Regression. Baseline FAIL -> Candidate PASS may be an Improvement. Improvements do not cancel independent failures/regressions.

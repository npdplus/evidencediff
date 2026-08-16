# ADR-0008 — Difference Is Not Regression

**Status:** Accepted

## Context
AI outputs naturally vary. Treating every change as failure makes a comparison tool noisy and misleading.

## Decision
Difference is a neutral observed change. Regression is an acceptance degradation supported by deterministic check behavior, primarily Baseline PASS -> Candidate FAIL.

## Consequences
Direct comparison without acceptance checks returns `REVIEW`, not false `PASS`/`FAIL`. Reporters expose both differences and regression classifications explicitly.

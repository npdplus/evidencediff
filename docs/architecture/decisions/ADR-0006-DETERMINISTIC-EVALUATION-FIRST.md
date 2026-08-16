# ADR-0006 — Deterministic Evaluation First

**Status:** Accepted

## Context
AI-based evaluators introduce probabilistic behavior, cost, provider coupling, and ambiguous proof semantics.

## Decision
All required V0.1 checks are deterministic. Subjective quality remains `REVIEW`; no LLM-as-a-judge is required or implemented.

## Consequences
V0.1 results are reproducible and explainable. Future probabilistic evaluators must be labeled separately from deterministic evidence and cannot silently replace human approval.

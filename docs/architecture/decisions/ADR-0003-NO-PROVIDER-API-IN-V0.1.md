# ADR-0003 — No Provider API Calls in V0.1

**Status:** Accepted

## Context
Direct model execution adds SDK churn, API-key security, cost/error handling, and distracts from the core comparison/regression hypothesis.

## Decision
V0.1 consumes captured outputs and supplied metadata only. It does not call OpenAI, Anthropic, Gemini, Azure OpenAI, Ollama, or other model providers and has no API-key handling contract.

## Consequences
Examples are key-free and provider-neutral. Future provider adapters require a new explicit architecture/security decision and stay outside Core.

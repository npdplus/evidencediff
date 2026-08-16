# PromptDiff Product Principles

**Status:** Accepted V0.1 Principles

## 1. Testing, Comparison, Evidence — Not Chatbot UX
PromptDiff exists to make changes inspectable and verifiable. A chat experience is not the product center.

## 2. Local-First by Default
Core comparison and validation must work locally without mandatory upload, account, or service dependency.

## 3. Bring Your Own Output
V0.1 consumes captured outputs. It does not own model execution or provider credentials.

## 4. Deterministic Before Probabilistic
Objective contracts and checks come before AI-based judging. Probabilistic evaluators, if ever added, must be explicitly distinguishable.

## 5. Difference Is Neutral
Changed output is evidence, not automatically failure. Regression means acceptance behavior degraded.

## 6. Evidence Is a Product Output
Evidence must be structured, versioned, portable, reviewable, and useful beyond terminal presentation.

## 7. Humans Approve
Machine verdict and human approval are separate concepts. `REVIEW` is a valid result, not an incomplete implementation.

## 8. Small Wedge Before Platform
Do not build provider orchestration, tracing, SaaS workspaces, teams, or plugin ecosystems until real use proves the need.

## 9. Provider / UI / Storage Independence in Core
The Core must not know OpenAI, Gemini, Anthropic, React, database products, or terminal formatting.

## 10. Developer Trust Over Feature Count
Clear semantics, reproducibility, actionable failures, privacy, and strong self-testing matter more than a large checklist of integrations.

## NPD PLUS AI Principle

> **AI understands.**  
> **NPD PLUS models.**  
> **Engines validate.**  
> **Tests verify.**  
> **Humans approve.**  
> **Evidence proves.**

# PromptDiff V0.1 Examples

These five synthetic scenarios exercise the real local-first PromptDiff CLI. They require no provider API keys, cloud login, database, telemetry, or network access after repository dependencies are installed.

Build the CLI before running the examples:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Then run the scenarios from the repository root.

## 1. Structured JSON Regression

A candidate order changes a required policy decision from `approved` to `manual-review`. The deterministic `exact` check passes for Baseline and fails for Candidate, so this is a Regression and the verdict is `FAIL`.

```bash
node apps/cli/dist/index.js test examples/structured-json-regression/test-definition.json --format json
```

Expected exit code: `1`.

## 2. Prompt-Output Regression

A synthetic captured prompt asks for a response that includes an escalation notice. The Baseline output contains the required notice while the Candidate omits it. The local captured files are evaluated with a deterministic `contains` check.

```bash
node apps/cli/dist/index.js test examples/prompt-output-regression/test-definition.json
```

Expected exit code: `1`.

## 3. Captured Model A vs Model B

Two provider-neutral, previously captured synthetic outputs answer the same local prompt differently while both satisfy the deterministic acceptance requirement. The outputs differ, but no acceptance regression occurs.

```bash
node apps/cli/dist/index.js test examples/captured-model-a-vs-model-b/test-definition.json --format markdown
```

Expected exit code: `0`.

## 4. Token / Latency Budget Regression

The text output is unchanged; only supplied local metadata differs. Baseline is inside both budgets and Candidate exceeds both. PromptDiff uses the supplied `tokens` and `latencyMs` values only; it does not estimate tokens or measure provider latency.

```bash
node apps/cli/dist/index.js test examples/token-latency-budget-regression/test-definition.json --format json
```

Expected exit code: `1`.

## 5. Review-Only Direct Comparison

Direct comparison observes a content Difference but has no deterministic acceptance checks. Per ADR-0008, Difference is not Regression, so the valid result remains `REVIEW`.

```bash
node apps/cli/dist/index.js compare examples/review-only-direct-comparison/baseline.txt examples/review-only-direct-comparison/candidate.txt --content-type text --format json
```

Expected exit code: `3`.

## Verification

P08 integration tests execute these same repository examples through the CLI source surface, and `pnpm test:examples` executes all five through the built CLI. Generated Evidence `id` and `generatedAt` values are intentionally not committed as snapshots; tests normalize only those explicitly generated fields when comparing repeated semantic output.

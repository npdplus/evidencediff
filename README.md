# EvidenceDiff

> **NPD PLUS Labs / Experimental Open-source**
>
> Compare captured AI outputs locally, run deterministic regression checks, and produce reviewable Evidence without sending prompts to a model provider.

**Version:** `0.1.0`

EvidenceDiff answers one engineering question:

> **What changed, what failed, and what evidence do we have that a candidate AI behavior is safe to accept?**

Core workflow:

**Baseline → Candidate → Differences → Deterministic Checks → Regressions → Evidence → Human Review**

A Difference is not automatically a Regression. Direct comparison without deterministic acceptance checks returns `REVIEW`, not a false `PASS` or `FAIL`.

## V0.1 Capabilities

- local-first and offline-capable after dependencies are installed;
- exact plain-text Baseline vs Candidate comparison;
- structural JSON comparison with deterministic ordering;
- 12 deterministic check types, including exact/content/schema-style checks and supplied token/latency budgets;
- Regression and Improvement classification from Baseline/Candidate check transitions;
- `PASS`, `FAIL`, and `REVIEW` machine verdicts;
- Test Definition format version `1`;
- canonical Evidence format version `1`;
- console, JSON, and Markdown reporting;
- CLI commands `compare` and `test`;
- safe explicit output handling;
- no provider execution, API-key custody, cloud login, database, telemetry, or remote synchronization requirement.

EvidenceDiff is intentionally not a chatbot UI, prompt playground, provider gateway, or all-in-one AI platform.

## Requirements

- Node.js 24 LTS;
- pnpm 10.x.

## Build and Verify

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm check:boundaries
pnpm check:runtime-boundaries
pnpm check:dependency-policy
pnpm check:secret-history
pnpm audit --audit-level=moderate
pnpm build
pnpm test:cli-smoke
pnpm test:examples
pnpm test:package
```

The combined repository check is also available:

```bash
pnpm check
```

## CLI Quick Start

Build first, then invoke the built CLI:

```bash
pnpm build
node apps/cli/dist/index.js --help
```

Direct comparison:

```bash
node apps/cli/dist/index.js compare <baseline> <candidate> --content-type auto
```

A successful direct comparison returns `REVIEW` with exit code `3` because it has no deterministic acceptance checks.

Test Definition execution:

```bash
node apps/cli/dist/index.js test <test-definition.json> --format json
```

CLI exit codes:

- `0` — `PASS`;
- `1` — `FAIL`;
- `2` — execution/configuration error;
- `3` — `REVIEW`.

## Runnable Examples

Five synthetic, provider-key-free scenarios under [`examples/`](examples/) exercise the built CLI:

1. Structured JSON Regression — `FAIL` / exit `1`;
2. Prompt-Output Regression — `FAIL` / exit `1`;
3. Captured Model A vs Model B — `PASS` / exit `0` while reporting a Difference;
4. Token / Latency Budget Regression — `FAIL` / exit `1`;
5. Review-Only Direct Comparison — `REVIEW` / exit `3`.

See [`examples/README.md`](examples/README.md) for exact commands.

## Evidence and Privacy

Canonical JSON Evidence is contract-complete and may contain diagnostic values from Differences and Check Results, so treat it as potentially sensitive. Console and Markdown reports intentionally minimize raw diagnostic payloads.

Core V0.1 workflows run locally after dependencies/build artifacts are available. Product runtime packages have no third-party runtime dependency and do not require provider credentials or network access.

## Verified Platforms

The V0.1 quality posture is verified in GitHub Actions on:

- Linux (Ubuntu, Node.js 24, pnpm 10);
- Windows (Node.js 24, pnpm 10).

macOS is not claimed as a verified V0.1 platform.

## V0.1 Limitations

- captured/local outputs only; EvidenceDiff does not execute models;
- deterministic checks only; no LLM-as-a-judge or semantic evaluator;
- CLI-first; no Viewer/UI in V0.1;
- local files only; no shared database/history/collaboration service;
- text comparison is exact rather than fuzzy/semantic;
- arrays are order-sensitive and reported atomically when changed;
- human approval remains separate from machine verdict.

## Documentation

Start at [`docs/README.md`](docs/README.md). Behavioral contracts live under [`docs/schema/`](docs/schema/), architecture decisions under [`docs/architecture/`](docs/architecture/), and contributor engineering guidance under [`docs/development/`](docs/development/).

## License

MIT. See [`LICENSE`](LICENSE).

## NPD PLUS AI Principle

> **AI understands.**  
> **NPD PLUS models.**  
> **Engines validate.**  
> **Tests verify.**  
> **Humans approve.**  
> **Evidence proves.**

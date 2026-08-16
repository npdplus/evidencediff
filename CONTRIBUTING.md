# Contributing to EvidenceDiff

EvidenceDiff is an experimental NPD PLUS Labs open-source project focused on local AI-output comparison, deterministic regression checks, and versioned evidence.

## Before Contributing

Read [`docs/README.md`](docs/README.md), the relevant schema specifications, and accepted ADRs for the area you plan to change.

## Local Development

Requirements:

- Node.js 24 LTS;
- pnpm 10.x.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

For full release-quality verification also run:

```bash
pnpm check:secret-history
pnpm audit --audit-level=moderate
pnpm test:cli-smoke
pnpm test:examples
pnpm test:package
```

Do not commit generated `dist`, coverage, caches, environment files, local Evidence/report output, credentials, or private prompt/output data.

## Scope Discipline

V0.1 intentionally does not include provider execution, API-key handling, cloud workspaces, hosted authentication, LLM-as-a-judge, observability, or a full prompt-management UI.

A pull request should not introduce those capabilities indirectly through a dependency or convenience abstraction.

## Development Principles

- keep Core provider/UI/storage independent;
- keep deterministic product semantics outside reporters/presentation layers;
- preserve Difference vs Regression distinction;
- treat Evidence as a structured versioned contract;
- add tests for behavior changes;
- prefer small focused dependencies;
- use synthetic data in tests/examples;
- do not commit secrets or private prompts/outputs.

## Change Process

1. identify the relevant specification or ADR;
2. create a focused branch;
3. implement the smallest complete change;
4. add/update tests;
5. run repository verification commands;
6. update docs/changelog when behavior changes;
7. open a PR with problem, approach, verification, security/privacy, and compatibility notes.

Material changes to provider/storage/UI independence, public Evidence/Test Definition formats, verdict/regression semantics, or V0.1 scope require an ADR/spec update before or with implementation.

## Reporting Security Issues

Do not open a public issue for a vulnerability that could expose users or data. Follow [`SECURITY.md`](SECURITY.md).

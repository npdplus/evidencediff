# PromptDiff Repository Blueprint

## Public Repository Layout

```text
promptdiff/
├── .github/
├── apps/
│   └── cli/
├── packages/
│   ├── contracts/
│   ├── core/
│   ├── checks/
│   └── reporters/
├── examples/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── docs/
│   ├── strategy/
│   ├── architecture/
│   │   └── decisions/
│   ├── schema/
│   ├── development/
│   └── release/
├── scripts/
└── project configuration and public community files
```

## Dependency Direction

`contracts` must not depend on `core`, `checks`, `reporters`, or CLI. `core` may depend on contracts. `checks` may depend on contracts and narrow shared primitives; it must not depend on CLI/reporters. `reporters` consume contracts/results. CLI composes the packages.

Circular dependencies are not acceptable.

## Folder Rules

- `apps/` contains executable user-facing applications only;
- `packages/` contains reusable product modules;
- `tests/` contains cross-package/integration/e2e coverage;
- `examples/` contains runnable synthetic public examples;
- `scripts/` contains repository maintenance/build/security helper scripts, not product domain behavior;
- `.github/workflows/` contains repository CI; PromptDiff-as-a-PR-analysis product integration is not a V0.1 feature.

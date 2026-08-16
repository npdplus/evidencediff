# EvidenceDiff V0.1 Quality and Security Controls

EvidenceDiff's own verification is deterministic and layered because the tool is intended to provide trustworthy comparison evidence.

## Permanent Gates

The repository verifies:

- frozen-lockfile installation;
- formatting, lint, strict type checking, unit/integration tests, and build;
- package dependency direction;
- runtime/offline boundaries;
- exact-pinned direct development tools and reviewed direct licenses;
- `pnpm audit --audit-level=moderate`;
- full-history high-confidence secret scanning without printing matched secret values;
- built CLI smoke behavior;
- all five synthetic examples;
- package contents, CLI bin mapping, and Node shebang.

## Runtime / Offline Boundary

Product source is guarded against network-capable Node built-ins, runtime network APIs, provider SDK imports, external runtime package dependencies, and install-time lifecycle scripts in product workspace packages.

Dependency installation and vulnerability audit may use the package registry during development/CI. Built EvidenceDiff workflows remain offline after dependencies/build artifacts are available.

## Privacy and Filesystem Safety

Canonical JSON Evidence may contain diagnostic values and must be treated as potentially sensitive. Console and Markdown are minimized human reports. Operational errors avoid raw input payloads, stack traces, and unnecessary resolved absolute-path disclosure.

Output collision protection covers canonical path aliases and existing-file identity so protected inputs are not destructively overwritten through aliases/hard links.

## Supported OS Verification

V0.1 CI verifies Linux/Ubuntu and Windows with Node.js 24 and pnpm 10. macOS is not claimed as verified.

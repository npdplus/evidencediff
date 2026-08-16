# Changelog

All notable EvidenceDiff changes are recorded here.

## [0.1.0] — Unreleased

### Added

- local-first CLI commands `compare` and `test`;
- exact plain-text and deterministic structural JSON Baseline/Candidate comparison;
- Test Definition format version `1` with strict validation and RFC 6901 JSON Pointer targets;
- 12 deterministic V0.1 check types;
- Regression and Improvement classification from Baseline/Candidate check transitions;
- `PASS`, `FAIL`, and `REVIEW` verdict aggregation;
- Evidence format version `1` with canonical JSON plus minimized console and Markdown reporters;
- safe CLI output-file handling and exit codes `0`, `1`, `2`, and `3`;
- five synthetic runnable examples;
- unit, integration, built-CLI, example, package, determinism, privacy, filesystem-safety, runtime-boundary, dependency-policy, and repository-history secret-scan verification.

### Quality and Security

- product runtime remains provider-independent and network-free after dependencies/build artifacts are available;
- product workspace packages have no third-party runtime dependencies;
- canonical JSON Evidence remains contract-complete while console/Markdown reports minimize raw diagnostic payloads;
- dependency/license policy, moderate vulnerability audit, runtime/offline-boundary, history secret-scan, and package-contents gates are included in CI;
- Vitest `3.2.7` includes the reviewed V0.1 development-tooling security remediation;
- Linux/Ubuntu and Windows are verified with Node.js 24 and pnpm 10; macOS is not claimed as verified.

### Not Included in V0.1

- provider/model execution or API-key handling;
- LLM-as-a-judge or semantic evaluators;
- Viewer/UI;
- database/shared history/team collaboration;
- telemetry or remote synchronization;
- hosted services or PR-bot product behavior.

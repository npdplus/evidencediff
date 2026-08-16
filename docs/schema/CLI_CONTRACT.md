# EvidenceDiff V0.1 CLI Contract

**Status:** Frozen Primary Interface Contract

## Commands

### `evidencediff compare`
Directly compares local Baseline and Candidate outputs. Because no deterministic acceptance checks are supplied by this workflow, a successful comparison returns verdict `REVIEW`.

### `evidencediff test`
Executes a local Test Definition format `1`, including deterministic checks and Evidence generation.

## Required Capabilities

- local file inputs;
- predictable path resolution;
- console summary;
- JSON Evidence output;
- Markdown Evidence output;
- explicit output destinations and safe overwrite behavior;
- actionable validation errors;
- offline operation after dependency installation.

## Exit Codes

- `0` — valid evaluation, verdict `PASS`;
- `1` — valid evaluation, verdict `FAIL`;
- `2` — configuration/execution/runtime error prevented a valid evaluation;
- `3` — valid evaluation, verdict `REVIEW`.

## Streams

Human valid-run summaries use stdout. Operational/configuration errors use stderr where conventional. Requested machine JSON must not be polluted by unrelated logs.

## Non-Goals

No login, provider credentials, model execution, daemon/server mode, cloud workspace, telemetry requirement, or Viewer behavior in V0.1.

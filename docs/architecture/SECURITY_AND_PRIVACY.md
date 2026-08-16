# EvidenceDiff Security and Privacy Architecture

**Status:** Accepted V0.1 Security Baseline

## Privacy Position

EvidenceDiff V0.1 is local-first. Captured prompts/outputs can contain confidential, personal, proprietary, or regulated information. The tool must not upload them by default or require telemetry/network access to perform comparison.

## API Keys

V0.1 has no provider execution and no API-key custody. Do not add provider-key prompts, storage, config fields, environment-variable conventions, or logging logic merely for future use.

## Evidence Sensitivity

Evidence may itself be sensitive. Reporters should include the minimum diagnostic content needed to explain results and must not unexpectedly duplicate full private outputs into every artifact. Any full-content inclusion must be explicit and documented.

## Logging

Normal and debug logs must avoid secret-like environment values and unnecessary raw content. Machine JSON output must not be contaminated by diagnostic logs.

## Filesystem Safety

- predictable path resolution;
- explicit output destinations;
- no silent overwrite of unrelated files;
- clear handling of unreadable/missing files;
- no execution of arbitrary scripts from Test Definitions.

## Dependency Security

P01/P09 must review runtime dependencies for maintenance, licensing, known vulnerabilities, and unnecessary network behavior. Keep the runtime dependency surface small.

## Network Boundary

After dependencies are installed, core V0.1 workflows must be able to run offline. Any future network capability requires a separate architecture/security decision.

## Public Release Gate

Before public visibility: scan repository history for secrets, verify examples are synthetic, review dependencies/licenses, validate report redaction/content behavior, and confirm root `SECURITY.md` vulnerability-reporting guidance is accurate.

# Security Policy

EvidenceDiff processes AI prompts/outputs and generated Evidence that may contain sensitive information.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a Vulnerability

Do **not** open a public GitHub issue for an exploitable vulnerability.

Use GitHub's private vulnerability reporting / Security Advisory flow for this repository when enabled. If the repository does not expose that private form, contact the repository owner through a private GitHub channel and provide only minimized synthetic reproduction data until a secure exchange path is established.

Never attach real credentials, production customer data, or private model outputs to a public issue or discussion.

## V0.1 Security Scope

EvidenceDiff V0.1 is designed to avoid major secret-custody risks:

- no provider API keys are required;
- no provider execution is required;
- no cloud account/database is required;
- prompts/outputs/Evidence remain local by default;
- no telemetry is required for core functionality.

Security reports are especially relevant for unexpected network transmission, unsafe file/path handling, arbitrary code execution, report/log leakage, realistic dependency vulnerabilities, command injection, and destructive overwrite behavior.

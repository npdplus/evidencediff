# Security Policy

PromptDiff processes AI prompts/outputs and generated Evidence that may contain sensitive information.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a Vulnerability

Do **not** open a public GitHub issue for an exploitable vulnerability.

When this repository is public, use GitHub's private vulnerability reporting flow from the repository **Security** area to submit the report privately to the maintainers. If the private reporting form is unavailable, email `npdplus.co.th@gmail.com` with the subject `[PromptDiff Security]` and provide only minimized synthetic reproduction details until a secure exchange path is established.

Never attach real credentials, production customer data, private prompts, or private model outputs to a public issue or discussion.

## V0.1 Security Scope

PromptDiff V0.1 is designed to avoid major secret-custody risks:

- no provider API keys are required;
- no provider execution is required;
- no cloud account/database is required;
- prompts/outputs/Evidence remain local by default;
- no telemetry is required for core functionality.

Security reports are especially relevant for unexpected network transmission, unsafe file/path handling, arbitrary code execution, report/log leakage, realistic dependency vulnerabilities, command injection, and destructive overwrite behavior.

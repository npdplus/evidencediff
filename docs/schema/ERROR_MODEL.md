# PromptDiff V0.1 Error Model

**Status:** Frozen Behavioral Contract

PromptDiff distinguishes product verdicts from failures that prevent a valid evaluation.

## Product Outcomes

`PASS`, `FAIL`, and `REVIEW` are valid completed evaluations.

## Execution / Configuration Errors

Examples:

- unreadable/missing file;
- malformed Test Definition;
- unsupported format version;
- unknown check type;
- invalid check parameters or regex;
- content declared JSON but invalid where parsing is required for execution;
- unsafe output overwrite conflict;
- unexpected runtime failure.

These use the CLI execution-error path and exit code `2`; they are not Candidate `FAIL`.

## Error Requirements

Errors should be actionable, concise, identify the relevant option/path/field when practical, avoid raw sensitive content unless needed, and keep machine JSON output uncontaminated by unrelated diagnostic text.

## Internal Errors

Unexpected defects should fail safely and preserve a stable public error boundary rather than leaking stack traces by default. Debug detail may be opt-in and must respect privacy rules.

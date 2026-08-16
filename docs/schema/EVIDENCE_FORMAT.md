# EvidenceDiff V0.1 Evidence Format

**Status:** Frozen Behavioral/Data Contract  
**Format version:** `1`

## Purpose

Evidence is the canonical structured result of a completed EvidenceDiff comparison/test evaluation. Console and Markdown reports are renderings of Evidence; they are not independent sources of product semantics.

## Required Top-Level Model

Evidence format `1` contains:

- `formatVersion`: integer `1`;
- `toolVersion`: EvidenceDiff package/tool version used to create the artifact;
- `id`: opaque Evidence/comparison identifier;
- `generatedAt`: generation timestamp;
- optional Test Definition context (`id`, `name`, optional description);
- Baseline identity, resolved content type, and supplied metadata;
- Candidate identity, resolved content type, and supplied metadata;
- deterministic ordered `differences`;
- deterministic ordered Baseline/Candidate `checkResults`;
- explicit ordered `regressions`;
- optional ordered `improvements`;
- optional supplied token/latency metrics and deltas;
- machine `verdict`: `PASS`, `FAIL`, or `REVIEW`;
- review-required state and reason when applicable.

The Evidence format version is independent of the package semantic version.

## Assembly Semantics

Evidence assembly consumes already-produced P03-P05 domain results. It does not rerun comparison, checks, regression classification, metric comparison, or verdict aggregation.

Collection order is preserved from the frozen upstream domain results. Reporters must preserve that collection order and must not sort or reclassify domain collections to create a different truth source.

For P06, the generated Evidence `id` is an opaque UUID suitable for local correlation and contains no Baseline/Candidate content. `generatedAt` is an ISO timestamp. These two generated fields may vary between otherwise equivalent runs; semantic fields must remain deterministic.

When no Improvements exist, the optional `improvements` field may be omitted. Other optional fields are emitted only when the frozen contract supplies them.

## Metrics

EvidenceDiff records token/latency values only when supplied by input metadata. It does not call a provider or estimate missing values. When both sides exist, delta means `Candidate - Baseline`; one-sided metadata may be represented without an invented delta.

## Privacy / Content Inclusion

Evidence may contain sensitive data and must be handled as a potentially sensitive artifact.

Baseline/Candidate top-level Evidence identity objects contain path, resolved content type, optional label, and supplied metadata only. Evidence assembly does **not** copy the complete runtime Baseline/Candidate `value` into those identity objects.

Frozen P03 Difference and P04 Check Result diagnostics are still part of canonical Evidence and may themselves contain values needed to explain a result. P06 does not redact or rewrite those frozen domain objects because doing so would change canonical semantics.

Reporter behavior is therefore intentionally different by output type:

- canonical JSON serializes the complete Evidence contract and must be treated as potentially sensitive;
- Markdown and console reporters are concise by default and do not duplicate `Difference.baseline`, `Difference.candidate`, `CheckResult.expected`, `CheckResult.actual`, or `CheckResult.details` payloads;
- Markdown and console still expose stable kinds/paths, check identities/statuses, concise explanations, transitions, supplied metrics, verdict, and review state needed to understand the result.

Full raw prompts/outputs are never implicitly duplicated into every report. Any future full-content expansion requires an explicit documented contract change.

## Canonical JSON Serialization

JSON is the canonical machine-readable serialization of Evidence format `1`.

P06 writes top-level fields in the contract order above, canonicalizes nested object keys lexicographically, preserves array/collection order exactly, omits unavailable optional fields, and terminates the serialized document with a newline. This serialization normalization changes presentation only; it never recalculates domain semantics.

## Determinism / Snapshots

Repeated equivalent runs must produce equivalent semantic Evidence and deterministic reporter output. Snapshot tests may normalize only explicitly generated fields such as `id` and `generatedAt`; Differences, Check Results, Regressions, Improvements, metrics, verdict, and review state must never be normalized away.

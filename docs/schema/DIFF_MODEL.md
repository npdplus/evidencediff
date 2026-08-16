# EvidenceDiff V0.1 Diff Model

**Status:** Frozen Behavioral Contract

## Difference

A Difference is a neutral deterministic observation that Baseline and Candidate are not equivalent under the selected comparison mode. A Difference does not automatically fail the Candidate.

## Text

Comparison preserves enough information to explain inserted, removed, and changed textual content. Default behavior does not silently trim, lowercase, reorder, or normalize semantic content.

For V0.1 P03, plain-text comparison is exact and emits at most one Difference for the complete input pair. A single contiguous insertion or removal, determined after the longest common prefix and suffix are excluded, is represented as `inserted` or `removed`; all other unequal text is `changed`. The Difference preserves the complete Baseline and Candidate strings so whitespace, newline, and Unicode changes remain reviewable.

## JSON

JSON comparison is structural. Required kinds:

- key/field added;
- key/field removed;
- value changed;
- type changed;
- array content/order changed.

Object key order alone is not a semantic difference. Array order is significant by default. Missing and explicit `null` are different.

Structured differences identify a JSON Pointer-like path and Baseline/Candidate values/types sufficient to explain the change.

For V0.1 P03, objects are traversed depth-first with keys sorted lexicographically before comparison. Arrays are compared as ordered atomic values for Difference reporting: any unequal array content, length, nested value, or order produces one `array-changed` Difference at that array's JSON Pointer path rather than per-index child Differences. Arrays are never silently sorted.

## Regression

Primary rule: an equivalent deterministic check that passes Baseline and fails Candidate is a Regression. A Candidate failure with no meaningful Baseline comparison can still produce overall `FAIL` but is not mislabeled as historical regression.

## Improvement

Baseline FAIL -> Candidate PASS may be classified as Improvement. It never cancels another failure.

## Ordering

Machine-readable Difference, check-result, Regression, and Improvement collections use deterministic ordering so repeated runs remain reviewable and snapshot-testable.

For P03 JSON Differences, the depth-first sorted-key traversal above defines collection ordering. Text comparison emits zero or one Difference, so its ordering is inherently stable.

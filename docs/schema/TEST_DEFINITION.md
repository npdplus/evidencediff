# EvidenceDiff V0.1 Test Definition

**Status:** Frozen Behavioral/Data Contract  
**Format version:** `1`

## Purpose

A Test Definition is a local, declarative, reviewable description of Baseline/Candidate inputs and deterministic acceptance checks.

## Required Top-Level Model

- `version`: integer, must be `1`;
- `id`: stable non-empty test-case identifier;
- `name`: human-readable name;
- `baseline`: local input descriptor;
- `candidate`: local input descriptor;
- `checks`: zero or more deterministic check definitions;
- optional `description`;
- optional `reviewRequired` boolean.

## Input Descriptor

Each Baseline/Candidate descriptor supports:

- `path`: local file path;
- `contentType`: `text`, `json`, or documented `auto` detection;
- optional `label`;
- optional metadata: `model`, `promptVersion`, `build`, `tokens`, `latencyMs`.

Paths resolve relative to the Test Definition file unless the CLI contract explicitly documents another invocation mode.

## Check Definition

Each check includes:

- optional stable `id`;
- required `type`;
- optional JSON Pointer `target` when the check applies to a JSON location;
- parameters required by the chosen check type;
- optional description.

Unknown check types and invalid parameters are configuration errors and must never be silently ignored.

## JSON Target Syntax

V0.1 uses RFC 6901 JSON Pointer style, for example `/customer/age`. Missing and explicit `null` are distinct.

## Determinism / Security

No arbitrary JavaScript/Python, shell commands, remote HTTP assertions, provider requests, secret fields, or hidden network execution are allowed in V0.1 Test Definitions.

## No-Check Behavior

A valid comparison with zero deterministic acceptance checks is permitted, but its machine verdict is `REVIEW`, not `PASS`.

import { describe, expect, it } from "vitest";

import {
  CheckEvaluationError,
  assertValidCheckConfiguration,
  evaluateCheck,
  evaluateChecks,
  type CheckEvaluationJsonValue
} from "../../packages/checks/src/index.js";

const text = (value: string, metadata: { tokens?: number; latencyMs?: number } = {}) => ({
  contentType: "text" as const,
  value,
  ...metadata
});

const json = (
  value: CheckEvaluationJsonValue,
  metadata: { tokens?: number; latencyMs?: number } = {}
) => ({ contentType: "json" as const, value, ...metadata });

describe("P04 deterministic checks", () => {
  it("evaluates json-valid for text and already-parsed JSON", () => {
    expect(
      evaluateCheck({ type: "json-valid" }, text("not-json"), text('{"ok":true}'))
    ).toMatchObject({
      baselineStatus: "FAIL",
      candidateStatus: "PASS",
      expected: true,
      actual: true
    });
    expect(
      evaluateCheck({ type: "json-valid" }, json({ ok: true }), json(null)).candidateStatus
    ).toBe("PASS");
  });

  it("distinguishes missing required fields from explicit null and resolves escaped pointers", () => {
    const result = evaluateCheck(
      { type: "required-field", target: "/a~1b/m~0n" },
      json({ "a/b": { "m~n": null } }),
      json({ "a/b": {} })
    );

    expect(result.baselineStatus).toBe("PASS");
    expect(result.candidateStatus).toBe("FAIL");
  });

  it("checks exact field types without coercion", () => {
    expect(
      evaluateCheck(
        { type: "field-type", target: "/count", expectedType: "number" },
        json({ count: 1 }),
        json({ count: "1" })
      )
    ).toMatchObject({ baselineStatus: "PASS", candidateStatus: "FAIL", actual: "string" });
  });

  it("performs deep exact equality while preserving string exactness", () => {
    expect(
      evaluateCheck(
        { type: "exact", expected: { b: 2, a: 1 } },
        json({ a: 1, b: 2 }),
        json({ b: 2, a: 1 })
      ).candidateStatus
    ).toBe("PASS");
    expect(
      evaluateCheck({ type: "exact", expected: "Alpha" }, text("Alpha"), text("alpha"))
        .candidateStatus
    ).toBe("FAIL");
  });

  it("checks contains and not-contains case-sensitively", () => {
    expect(
      evaluateCheck({ type: "contains", value: "Needle" }, text("Needle"), text("needle"))
        .candidateStatus
    ).toBe("FAIL");
    expect(
      evaluateCheck({ type: "not-contains", value: "secret" }, text("secret"), text("public"))
        .candidateStatus
    ).toBe("PASS");
  });

  it("checks regular expressions and rejects malformed syntax as configuration errors", () => {
    expect(
      evaluateCheck({ type: "regex", pattern: "^[A-Z]{2}-\\d+$" }, text("AA-1"), text("TH-42"))
        .candidateStatus
    ).toBe("PASS");
    expect(() => evaluateCheck({ type: "regex", pattern: "[" }, text("a"), text("b"))).toThrowError(
      CheckEvaluationError
    );
  });

  it("uses inclusive numeric range boundaries and never coerces strings", () => {
    expect(
      evaluateCheck({ type: "numeric-range", min: 10, max: 20 }, json(10), json(20)).candidateStatus
    ).toBe("PASS");
    expect(
      evaluateCheck({ type: "numeric-range", min: 10 }, json(10), json("10")).candidateStatus
    ).toBe("FAIL");
  });

  it("uses deep equality for allowed values", () => {
    const check = { type: "allowed-values", values: [{ status: "ok" }, [1, 2]] };

    expect(
      evaluateCheck(check, json({ status: "bad" }), json({ status: "ok" })).candidateStatus
    ).toBe("PASS");
    expect(evaluateCheck(check, json([1, 2]), json([2, 1])).candidateStatus).toBe("FAIL");
  });

  it("checks Unicode code-point and array output lengths inclusively", () => {
    expect(
      evaluateCheck({ type: "output-length", max: 1 }, text("a"), text("😀")).candidateStatus
    ).toBe("PASS");
    expect(
      evaluateCheck(
        { type: "output-length", target: "/items", min: 2, max: 2 },
        json({ items: [] }),
        json({ items: [1, 2] })
      ).candidateStatus
    ).toBe("PASS");
  });

  it("checks token and latency budgets at the inclusive boundary", () => {
    expect(
      evaluateCheck(
        { type: "token-budget", maxTokens: 100 },
        text("baseline", { tokens: 101 }),
        text("candidate", { tokens: 100 })
      )
    ).toMatchObject({ baselineStatus: "FAIL", candidateStatus: "PASS", actual: 100 });
    expect(
      evaluateCheck(
        { type: "latency-budget", maxLatencyMs: 250 },
        text("baseline", { latencyMs: 200 }),
        text("candidate", { latencyMs: 251 })
      ).candidateStatus
    ).toBe("FAIL");
  });

  it("fails explicitly when required supplied metadata is unavailable", () => {
    expect(() =>
      evaluateCheck({ type: "token-budget", maxTokens: 10 }, text("a"), text("b"))
    ).toThrow(/requires supplied tokens metadata/);
    expect(() =>
      evaluateCheck({ type: "latency-budget", maxLatencyMs: 10 }, text("a"), text("b"))
    ).toThrow(/requires supplied latencyMs metadata/);
  });

  it("treats targeted checks on text as unavailable evaluation, not a guessed failure", () => {
    expect(() =>
      evaluateCheck({ type: "exact", target: "/name", expected: "A" }, text("A"), text("A"))
    ).toThrow(/requires JSON input/);
  });

  it("resolves array indices as JSON Pointer tokens", () => {
    expect(
      evaluateCheck(
        { type: "exact", target: "/1", expected: "b" },
        json(["a", "b"]),
        json(["a", "b"])
      ).candidateStatus
    ).toBe("PASS");
  });

  it("rejects invalid configuration before evaluation", () => {
    const invalidChecks: unknown[] = [
      { type: "unknown" },
      { type: "json-valid", target: "/x" },
      { type: "required-field" },
      { type: "field-type", target: "/x", expectedType: "integer" },
      { type: "exact" },
      { type: "contains", value: 1 },
      { type: "regex", pattern: "" },
      { type: "numeric-range", min: 2, max: 1 },
      { type: "allowed-values", values: [] },
      { type: "output-length", min: -1 },
      { type: "token-budget", maxTokens: 1.5 },
      { type: "latency-budget", maxLatencyMs: Number.POSITIVE_INFINITY },
      { type: "exact", target: "not-a-pointer", expected: "x" },
      { type: "exact", expected: "x", surprise: true }
    ];

    for (const check of invalidChecks) {
      expect(() => assertValidCheckConfiguration(check)).toThrowError(CheckEvaluationError);
    }
  });

  it("preserves check order and produces deterministic structured results", () => {
    const checks = [
      { id: "exact", type: "exact", expected: "ok" },
      { id: "contains", type: "contains", value: "o" }
    ] as const;
    const expected = evaluateChecks(checks, text("ok"), text("ok"));

    expect(expected.map((result) => result.checkId)).toEqual(["exact", "contains"]);
    for (let index = 0; index < 20; index += 1) {
      expect(evaluateChecks(checks, text("ok"), text("ok"))).toEqual(expected);
    }
  });
});

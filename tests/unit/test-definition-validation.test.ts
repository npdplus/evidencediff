import { describe, expect, it } from "vitest";

import {
  ContractValidationError,
  parseTestDefinition,
  parseTestDefinitionJson,
  validateTestDefinition
} from "../../packages/contracts/src/index.js";

function minimalDefinition(): Record<string, unknown> {
  return {
    version: 1,
    id: "case-001",
    name: "Minimal synthetic case",
    baseline: { path: "baseline.txt", contentType: "text" },
    candidate: { path: "candidate.txt", contentType: "text" },
    checks: []
  };
}

describe("Test Definition format 1 validation", () => {
  it("accepts a minimal valid definition with zero checks", () => {
    const parsed = parseTestDefinition(minimalDefinition());

    expect(parsed.version).toBe(1);
    expect(parsed.id).toBe("case-001");
    expect(parsed.checks).toEqual([]);
  });

  it("accepts a fully populated definition covering the frozen check catalog", () => {
    const input = {
      version: 1,
      id: "case-full",
      name: "Fully populated synthetic case",
      description: "Synthetic only",
      reviewRequired: true,
      baseline: {
        path: "fixtures/baseline.json",
        contentType: "json",
        label: "Baseline",
        model: "captured-model-a",
        promptVersion: "p1",
        build: "100",
        tokens: 120,
        latencyMs: 450.5
      },
      candidate: {
        path: "fixtures/candidate.json",
        contentType: "auto",
        label: "Candidate",
        model: "captured-model-b",
        promptVersion: "p2",
        build: "101",
        tokens: 110,
        latencyMs: 400
      },
      checks: [
        { id: "c1", type: "json-valid", description: "Valid JSON" },
        { id: "c2", type: "required-field", target: "/customer/id" },
        {
          id: "c3",
          type: "field-type",
          target: "/customer/age",
          expectedType: "number"
        },
        { id: "c4", type: "exact", target: "/status", expected: "ready" },
        { id: "c5", type: "contains", value: "approved" },
        { id: "c6", type: "not-contains", target: "/message", value: "secret" },
        { id: "c7", type: "regex", target: "/code", pattern: "^[A-Z]{2}-\\d+$" },
        { id: "c8", type: "numeric-range", target: "/score", min: 0, max: 1 },
        {
          id: "c9",
          type: "allowed-values",
          target: "/tier",
          values: ["basic", "pro", null]
        },
        { id: "c10", type: "output-length", min: 1, max: 2000 },
        { id: "c11", type: "token-budget", maxTokens: 500 },
        { id: "c12", type: "latency-budget", maxLatencyMs: 1500.5 }
      ]
    };

    const parsed = parseTestDefinition(input);

    expect(parsed).toEqual(input);
    expect(parsed.checks).toHaveLength(12);
  });

  it("accepts all supported content types", () => {
    for (const contentType of ["text", "json", "auto"] as const) {
      const input = minimalDefinition();
      input.baseline = { path: "baseline.out", contentType };
      expect(parseTestDefinition(input).baseline.contentType).toBe(contentType);
    }
  });

  it("accepts valid RFC 6901 pointer escapes and the root pointer", () => {
    const input = minimalDefinition();
    input.checks = [
      { type: "required-field", target: "" },
      { type: "required-field", target: "/a~1b" },
      { type: "required-field", target: "/m~0n" }
    ];

    expect(parseTestDefinition(input).checks).toHaveLength(3);
  });

  it("parses JSON text through the same validation boundary", () => {
    const parsed = parseTestDefinitionJson(JSON.stringify(minimalDefinition()));
    expect(parsed.id).toBe("case-001");
  });

  it("is deterministic for equivalent valid input", () => {
    const input = minimalDefinition();
    input.checks = [{ type: "exact", expected: { ok: true, nested: [1, 2, 3] } }];

    expect(parseTestDefinition(input)).toEqual(parseTestDefinition(structuredClone(input)));
  });
});

describe("invalid Test Definition rejection", () => {
  it("rejects missing fields, wrong types, bad enums, metadata, and unknown fields", () => {
    const missingId = minimalDefinition();
    delete missingId.id;
    const missingName = minimalDefinition();
    delete missingName.name;
    const missingBaseline = minimalDefinition();
    delete missingBaseline.baseline;
    const missingCandidate = minimalDefinition();
    delete missingCandidate.candidate;
    const missingChecks = minimalDefinition();
    delete missingChecks.checks;

    const cases: readonly [Record<string, unknown>, string][] = [
      [{ ...minimalDefinition(), version: "1" }, "$.version"],
      [{ ...minimalDefinition(), version: 2 }, "$.version"],
      [missingId, "$.id"],
      [{ ...minimalDefinition(), id: "" }, "$.id"],
      [missingName, "$.name"],
      [missingBaseline, "$.baseline"],
      [missingCandidate, "$.candidate"],
      [missingChecks, "$.checks"],
      [{ ...minimalDefinition(), checks: {} }, "$.checks"],
      [
        {
          ...minimalDefinition(),
          baseline: { path: "baseline.txt", contentType: "yaml" }
        },
        "$.baseline.contentType"
      ],
      [
        {
          ...minimalDefinition(),
          baseline: { path: "baseline.txt", contentType: "text", tokens: -1 }
        },
        "$.baseline.tokens"
      ],
      [
        {
          ...minimalDefinition(),
          candidate: { path: "candidate.txt", contentType: "text", latencyMs: -0.1 }
        },
        "$.candidate.latencyMs"
      ],
      [{ ...minimalDefinition(), extra: true }, "$.extra"]
    ];

    for (const [input, issuePath] of cases) {
      const result = validateTestDefinition(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.some((issue) => issue.path === issuePath)).toBe(true);
      }
    }
  });

  it("distinguishes missing version from unsupported version", () => {
    const missing = minimalDefinition();
    delete missing.version;
    const missingResult = validateTestDefinition(missing);
    const unsupportedResult = validateTestDefinition({ ...minimalDefinition(), version: 9 });

    expect(missingResult.success).toBe(false);
    expect(unsupportedResult.success).toBe(false);
    if (!missingResult.success && !unsupportedResult.success) {
      expect(missingResult.issues[0]?.code).toBe("missing-field");
      expect(unsupportedResult.issues[0]?.code).toBe("unsupported-version");
    }
  });

  it("rejects malformed JSON text without echoing private input", () => {
    const privateInput = '{"version":1,"secret":"TOP-SECRET"';

    expect(() => parseTestDefinitionJson(privateInput)).toThrow(ContractValidationError);
    try {
      parseTestDefinitionJson(privateInput);
    } catch (error) {
      expect(String(error)).not.toContain("TOP-SECRET");
    }
  });

  it("produces deterministic validation issues for equivalent invalid input", () => {
    const input = { ...minimalDefinition(), version: 7, extra: true };
    const first = validateTestDefinition(input);
    const second = validateTestDefinition(structuredClone(input));

    expect(first).toEqual(second);
  });
});

describe("invalid check configuration rejection", () => {
  it("rejects unknown checks and malformed check-specific configuration", () => {
    const cases: readonly [Record<string, unknown>, string][] = [
      [{ type: "semantic-score" }, "unknown-check"],
      [{ type: "required-field" }, "missing-field"],
      [{ type: "required-field", target: "customer/id" }, "invalid-json-pointer"],
      [{ type: "required-field", target: "/bad~2escape" }, "invalid-json-pointer"],
      [{ type: "field-type", target: "/age", expectedType: "integer" }, "invalid-value"],
      [{ type: "exact" }, "missing-field"],
      [{ type: "contains", value: 12 }, "invalid-type"],
      [{ type: "regex", pattern: "[" }, "invalid-check-configuration"],
      [{ type: "numeric-range" }, "invalid-check-configuration"],
      [{ type: "numeric-range", min: 10, max: 1 }, "invalid-check-configuration"],
      [{ type: "allowed-values", values: [] }, "invalid-value"],
      [{ type: "output-length" }, "invalid-check-configuration"],
      [{ type: "output-length", max: 2.5 }, "invalid-value"],
      [{ type: "token-budget", maxTokens: -1 }, "invalid-value"],
      [{ type: "token-budget", maxTokens: 1.5 }, "invalid-value"],
      [{ type: "latency-budget", maxLatencyMs: -1 }, "invalid-value"],
      [{ type: "json-valid", target: "/x" }, "unknown-field"],
      [{ type: "exact", expected: 1, tolerance: 0.1 }, "unknown-field"]
    ];

    for (const [check, expectedCode] of cases) {
      const input = minimalDefinition();
      input.checks = [check];
      const result = validateTestDefinition(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.some((issue) => issue.code === expectedCode)).toBe(true);
      }
    }
  });
});

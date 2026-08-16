import { describe, expect, it } from "vitest";

import {
  CHECK_TYPES,
  CONTENT_TYPES,
  EVIDENCE_FORMAT_VERSION,
  TEST_DEFINITION_FORMAT_VERSION,
  VERDICTS,
  isJsonPointer,
  parseJsonPointer,
  type Difference,
  type Improvement,
  type Regression
} from "../../packages/contracts/src/index.js";

describe("P02 contract invariants", () => {
  it("freezes Test Definition and Evidence format versions at 1", () => {
    expect(TEST_DEFINITION_FORMAT_VERSION).toBe(1);
    expect(EVIDENCE_FORMAT_VERSION).toBe(1);
  });

  it("exposes only the frozen V0.1 content types", () => {
    expect(CONTENT_TYPES).toEqual(["text", "json", "auto"]);
  });

  it("exposes only the frozen deterministic check catalog", () => {
    expect(CHECK_TYPES).toEqual([
      "json-valid",
      "required-field",
      "field-type",
      "exact",
      "contains",
      "not-contains",
      "regex",
      "numeric-range",
      "allowed-values",
      "output-length",
      "token-budget",
      "latency-budget"
    ]);
  });

  it("keeps machine verdicts separate from human approval language", () => {
    expect(VERDICTS).toEqual(["PASS", "FAIL", "REVIEW"]);
    expect(VERDICTS).not.toContain("APPROVED");
    expect(VERDICTS).not.toContain("REJECTED");
  });

  it("keeps Difference, Regression, and Improvement as distinct concepts", () => {
    const difference: Difference = {
      domain: "json",
      kind: "value-changed",
      path: parseJsonPointer("/status"),
      baseline: "draft",
      candidate: "ready"
    };
    const regression: Regression = {
      kind: "REGRESSION",
      checkType: "exact",
      baselineStatus: "PASS",
      candidateStatus: "FAIL",
      explanation: "Synthetic regression"
    };
    const improvement: Improvement = {
      kind: "IMPROVEMENT",
      checkType: "exact",
      baselineStatus: "FAIL",
      candidateStatus: "PASS",
      explanation: "Synthetic improvement"
    };

    expect(difference.domain).toBe("json");
    expect(regression.kind).toBe("REGRESSION");
    expect(improvement.kind).toBe("IMPROVEMENT");
  });
});

describe("RFC 6901 JSON Pointer contract", () => {
  it("accepts valid root, escaped, indexed, and Unicode pointers", () => {
    const pointers = ["", "/customer/age", "/a~1b", "/m~0n", "/0", "/unicode/ไทย"];

    for (const pointer of pointers) {
      expect(isJsonPointer(pointer)).toBe(true);
      expect(parseJsonPointer(pointer)).toBe(pointer);
    }
  });

  it("rejects non-pointer and malformed escape syntax", () => {
    const pointers = ["customer/age", "a", "/bad~", "/bad~2escape"];

    for (const pointer of pointers) {
      expect(isJsonPointer(pointer)).toBe(false);
      expect(() => parseJsonPointer(pointer)).toThrow("Invalid RFC 6901 JSON Pointer");
    }
  });
});

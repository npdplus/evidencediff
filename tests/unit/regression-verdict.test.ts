import { describe, expect, it } from "vitest";

import type { CheckResult } from "../../packages/contracts/src/index.js";
import {
  aggregateRegressionVerdict,
  classifyCheckResults,
  compareMetrics
} from "../../packages/core/src/index.js";

const result = (
  checkId: string,
  baselineStatus: "PASS" | "FAIL" | undefined,
  candidateStatus: "PASS" | "FAIL"
): CheckResult => ({
  checkId,
  checkType: "exact",
  ...(baselineStatus !== undefined ? { baselineStatus } : {}),
  candidateStatus,
  explanation: `${checkId}:${baselineStatus ?? "N/A"}->${candidateStatus}`
});

describe("P05 regression and verdict", () => {
  it("keeps unchanged PASS neutral and returns PASS when all checks pass", () => {
    const summary = aggregateRegressionVerdict([result("stable", "PASS", "PASS")]);

    expect(summary).toMatchObject({
      regressions: [],
      improvements: [],
      unchangedFailures: [],
      candidateFailures: [],
      verdict: "PASS",
      reviewRequired: false
    });
  });

  it("classifies Baseline PASS to Candidate FAIL as Regression", () => {
    const summary = aggregateRegressionVerdict([result("regressed", "PASS", "FAIL")]);

    expect(summary.regressions).toEqual([
      {
        kind: "REGRESSION",
        checkId: "regressed",
        checkType: "exact",
        baselineStatus: "PASS",
        candidateStatus: "FAIL",
        explanation: "regressed:PASS->FAIL"
      }
    ]);
    expect(summary.candidateFailures).toHaveLength(1);
    expect(summary.verdict).toBe("FAIL");
  });

  it("classifies Baseline FAIL to Candidate PASS as Improvement", () => {
    const summary = aggregateRegressionVerdict([result("improved", "FAIL", "PASS")]);

    expect(summary.improvements).toEqual([
      {
        kind: "IMPROVEMENT",
        checkId: "improved",
        checkType: "exact",
        baselineStatus: "FAIL",
        candidateStatus: "PASS",
        explanation: "improved:FAIL->PASS"
      }
    ]);
    expect(summary.regressions).toEqual([]);
    expect(summary.verdict).toBe("PASS");
  });

  it("represents unchanged failures without misclassifying them as regressions", () => {
    const unchangedFailure = result("still-failing", "FAIL", "FAIL");
    const summary = aggregateRegressionVerdict([unchangedFailure]);

    expect(summary.unchangedFailures).toEqual([unchangedFailure]);
    expect(summary.regressions).toEqual([]);
    expect(summary.improvements).toEqual([]);
    expect(summary.candidateFailures).toEqual([unchangedFailure]);
    expect(summary.verdict).toBe("FAIL");
  });

  it("fails Candidate-only check failures without inventing a historical regression", () => {
    const candidateOnlyFailure = result("candidate-only", undefined, "FAIL");
    const summary = aggregateRegressionVerdict([candidateOnlyFailure]);

    expect(summary.regressions).toEqual([]);
    expect(summary.unchangedFailures).toEqual([]);
    expect(summary.candidateFailures).toEqual([candidateOnlyFailure]);
    expect(summary.verdict).toBe("FAIL");
  });

  it("aggregates multiple checks in input order and Improvements never cancel failures", () => {
    const checkResults = [
      result("stable", "PASS", "PASS"),
      result("improved", "FAIL", "PASS"),
      result("regressed", "PASS", "FAIL"),
      result("unchanged", "FAIL", "FAIL")
    ];

    const transitions = classifyCheckResults(checkResults);
    const summary = aggregateRegressionVerdict(checkResults);

    expect(transitions.regressions.map((item) => item.checkId)).toEqual(["regressed"]);
    expect(transitions.improvements.map((item) => item.checkId)).toEqual(["improved"]);
    expect(transitions.unchangedFailures.map((item) => item.checkId)).toEqual(["unchanged"]);
    expect(transitions.candidateFailures.map((item) => item.checkId)).toEqual([
      "regressed",
      "unchanged"
    ]);
    expect(summary.verdict).toBe("FAIL");
  });

  it("returns REVIEW when explicit human review is required", () => {
    const summary = aggregateRegressionVerdict([result("stable", "PASS", "PASS")], {
      reviewRequired: true
    });

    expect(summary).toMatchObject({
      verdict: "REVIEW",
      reviewRequired: true,
      reviewReason: "Test definition requires human review."
    });
  });

  it("returns REVIEW for a valid no-check comparison", () => {
    const summary = aggregateRegressionVerdict([]);

    expect(summary).toMatchObject({
      verdict: "REVIEW",
      reviewRequired: true,
      reviewReason: "No deterministic acceptance checks were provided."
    });
  });

  it("gives Candidate failure priority over explicit review", () => {
    const summary = aggregateRegressionVerdict([result("required", "PASS", "FAIL")], {
      reviewRequired: true
    });

    expect(summary.verdict).toBe("FAIL");
    expect(summary.reviewRequired).toBe(true);
    expect(summary.reviewReason).toBe("Test definition requires human review.");
  });

  it("computes supplied token and latency deltas as Candidate minus Baseline", () => {
    expect(compareMetrics({ tokens: 80, latencyMs: 250 }, { tokens: 120, latencyMs: 200 })).toEqual(
      {
        tokens: { baseline: 80, candidate: 120, delta: 40 },
        latencyMs: { baseline: 250, candidate: 200, delta: -50 }
      }
    );
  });

  it("preserves one-sided supplied metrics and omits unavailable deltas", () => {
    expect(compareMetrics({ tokens: 80 }, { latencyMs: 200 })).toEqual({
      tokens: { baseline: 80 },
      latencyMs: { candidate: 200 }
    });
    expect(compareMetrics()).toBeUndefined();
  });

  it("is deterministic across repeated aggregation", () => {
    const checkResults = [
      result("regression-a", "PASS", "FAIL"),
      result("improvement", "FAIL", "PASS"),
      result("regression-b", "PASS", "FAIL")
    ];
    const options = {
      reviewRequired: true,
      baselineMetrics: { tokens: 100, latencyMs: 300 },
      candidateMetrics: { tokens: 90, latencyMs: 325 }
    } as const;
    const expected = aggregateRegressionVerdict(checkResults, options);

    for (let index = 0; index < 20; index += 1) {
      expect(aggregateRegressionVerdict(checkResults, options)).toEqual(expected);
    }
  });
});

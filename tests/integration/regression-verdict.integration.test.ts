import { describe, expect, it } from "vitest";

import {
  CheckEvaluationError,
  evaluateChecks,
  type CheckEvaluationJsonValue
} from "../../packages/checks/src/index.js";
import { parseTestDefinition } from "../../packages/contracts/src/index.js";
import { aggregateRegressionVerdict } from "../../packages/core/src/index.js";

const json = (
  value: CheckEvaluationJsonValue,
  metadata: { tokens?: number; latencyMs?: number } = {}
) => ({ contentType: "json" as const, value, ...metadata });

describe("P05 frozen P04 integration", () => {
  it("classifies P04 results and supplied metrics without changing check semantics", () => {
    const definition = parseTestDefinition({
      version: 1,
      id: "regression-verdict",
      name: "Regression verdict",
      baseline: { path: "baseline.json", contentType: "json", tokens: 80, latencyMs: 250 },
      candidate: { path: "candidate.json", contentType: "json", tokens: 120, latencyMs: 200 },
      checks: [
        { id: "status", type: "exact", target: "/status", expected: "ok" },
        { id: "tokens", type: "token-budget", maxTokens: 100 },
        { id: "legacy", type: "required-field", target: "/legacy" }
      ]
    });

    const checkResults = evaluateChecks(
      definition.checks,
      json({ status: "ok" }, { tokens: 80, latencyMs: 250 }),
      json({ status: "ok", legacy: true }, { tokens: 120, latencyMs: 200 })
    );
    const summary = aggregateRegressionVerdict(checkResults, {
      reviewRequired: definition.reviewRequired === true,
      baselineMetrics: definition.baseline,
      candidateMetrics: definition.candidate
    });

    expect(
      checkResults.map((item) => [item.checkId, item.baselineStatus, item.candidateStatus])
    ).toEqual([
      ["status", "PASS", "PASS"],
      ["tokens", "PASS", "FAIL"],
      ["legacy", "FAIL", "PASS"]
    ]);
    expect(summary.regressions.map((item) => item.checkId)).toEqual(["tokens"]);
    expect(summary.improvements.map((item) => item.checkId)).toEqual(["legacy"]);
    expect(summary.unchangedFailures).toEqual([]);
    expect(summary.verdict).toBe("FAIL");
    expect(summary.metrics).toEqual({
      tokens: { baseline: 80, candidate: 120, delta: 40 },
      latencyMs: { baseline: 250, candidate: 200, delta: -50 }
    });
  });

  it("keeps P04 evaluation/configuration errors outside normal verdict aggregation", () => {
    const definition = parseTestDefinition({
      version: 1,
      id: "missing-metadata",
      name: "Missing metadata",
      baseline: { path: "baseline.json", contentType: "json" },
      candidate: { path: "candidate.json", contentType: "json" },
      checks: [{ id: "tokens", type: "token-budget", maxTokens: 100 }]
    });

    expect(() => {
      const checkResults = evaluateChecks(
        definition.checks,
        json({ status: "ok" }),
        json({ status: "ok" })
      );
      return aggregateRegressionVerdict(checkResults);
    }).toThrowError(CheckEvaluationError);
  });

  it("maps a parsed no-check Test Definition to REVIEW deterministically", () => {
    const definition = parseTestDefinition({
      version: 1,
      id: "review-only",
      name: "Review only",
      baseline: { path: "baseline.txt", contentType: "text" },
      candidate: { path: "candidate.txt", contentType: "text" },
      checks: []
    });

    const expected = aggregateRegressionVerdict([], {
      reviewRequired: definition.reviewRequired === true,
      baselineMetrics: definition.baseline,
      candidateMetrics: definition.candidate
    });

    expect(expected).toMatchObject({
      verdict: "REVIEW",
      reviewRequired: true,
      reviewReason: "No deterministic acceptance checks were provided."
    });
    for (let index = 0; index < 20; index += 1) {
      expect(
        aggregateRegressionVerdict([], {
          reviewRequired: definition.reviewRequired === true,
          baselineMetrics: definition.baseline,
          candidateMetrics: definition.candidate
        })
      ).toEqual(expected);
    }
  });
});

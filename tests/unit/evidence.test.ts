import { describe, expect, it } from "vitest";

import {
  parseJsonPointer,
  type Baseline,
  type Candidate,
  type CheckResult,
  type Difference
} from "../../packages/contracts/src/index.js";
import {
  aggregateRegressionVerdict,
  assembleEvidence,
  type RegressionVerdictSummary
} from "../../packages/core/src/index.js";

const baseline: Baseline = {
  role: "baseline",
  path: "fixtures/baseline.json",
  contentType: "json",
  value: { status: "BASELINE-PRIVATE-CONTENT" },
  label: "accepted",
  model: "captured-model-a",
  promptVersion: "prompt-v1",
  build: "100",
  tokens: 80,
  latencyMs: 250
};

const candidate: Candidate = {
  role: "candidate",
  path: "fixtures/candidate.json",
  contentType: "json",
  value: { status: "CANDIDATE-PRIVATE-CONTENT" },
  label: "candidate",
  model: "captured-model-b",
  promptVersion: "prompt-v2",
  build: "101",
  tokens: 120,
  latencyMs: 200
};

const differences: readonly Difference[] = [
  {
    domain: "json",
    kind: "value-changed",
    path: parseJsonPointer("/status"),
    baseline: "ready",
    candidate: "broken",
    baselineType: "string",
    candidateType: "string"
  }
];

const checkResults: readonly CheckResult[] = [
  {
    checkId: "status",
    checkType: "exact",
    baselineStatus: "PASS",
    candidateStatus: "FAIL",
    expected: "ready",
    actual: "broken",
    explanation: "value does not exactly match expected value"
  }
];

describe("P06 Evidence assembly", () => {
  it("assembles Evidence format 1 with input identity and supplied metadata but not raw input content", () => {
    const summary = aggregateRegressionVerdict(checkResults, {
      baselineMetrics: baseline,
      candidateMetrics: candidate
    });
    const evidence = assembleEvidence({
      toolVersion: "0.1.1-test",
      test: { id: "evidence-contract", name: "Evidence contract", description: "Synthetic" },
      baseline,
      candidate,
      differences,
      checkResults,
      regressionVerdict: summary
    });

    expect(evidence).toMatchObject({
      formatVersion: 1,
      toolVersion: "0.1.1-test",
      test: { id: "evidence-contract", name: "Evidence contract", description: "Synthetic" },
      baseline: {
        path: "fixtures/baseline.json",
        contentType: "json",
        label: "accepted",
        model: "captured-model-a",
        promptVersion: "prompt-v1",
        build: "100",
        tokens: 80,
        latencyMs: 250
      },
      candidate: {
        path: "fixtures/candidate.json",
        contentType: "json",
        label: "candidate",
        model: "captured-model-b",
        promptVersion: "prompt-v2",
        build: "101",
        tokens: 120,
        latencyMs: 200
      },
      verdict: "FAIL",
      reviewRequired: false
    });
    expect(evidence.baseline).not.toHaveProperty("role");
    expect(evidence.baseline).not.toHaveProperty("value");
    expect(evidence.candidate).not.toHaveProperty("role");
    expect(evidence.candidate).not.toHaveProperty("value");
    expect(JSON.stringify(evidence.baseline)).not.toContain("BASELINE-PRIVATE-CONTENT");
    expect(JSON.stringify(evidence.candidate)).not.toContain("CANDIDATE-PRIVATE-CONTENT");
  });

  it("carries frozen Differences, Check Results, transitions, metrics, and verdict state without recalculation", () => {
    const preclassified: RegressionVerdictSummary = {
      regressions: [],
      improvements: [
        {
          kind: "IMPROVEMENT",
          checkId: "legacy",
          checkType: "required-field",
          baselineStatus: "FAIL",
          candidateStatus: "PASS",
          explanation: "pre-classified improvement"
        }
      ],
      unchangedFailures: [],
      candidateFailures: [],
      metrics: {
        tokens: { candidate: 120 },
        latencyMs: { baseline: 250, candidate: 200, delta: -50 }
      },
      verdict: "REVIEW",
      reviewRequired: true,
      reviewReason: "pre-classified review reason"
    };

    const evidence = assembleEvidence({
      toolVersion: "0.1.1-test",
      baseline,
      candidate,
      differences,
      checkResults,
      regressionVerdict: preclassified
    });

    expect(evidence.differences).toEqual(differences);
    expect(evidence.checkResults).toEqual(checkResults);
    expect(evidence.regressions).toEqual(preclassified.regressions);
    expect(evidence.improvements).toEqual(preclassified.improvements);
    expect(evidence.metrics).toEqual(preclassified.metrics);
    expect(evidence.verdict).toBe("REVIEW");
    expect(evidence.reviewRequired).toBe(true);
    expect(evidence.reviewReason).toBe("pre-classified review reason");
  });

  it.each([
    ["PASS", false, undefined],
    ["FAIL", false, undefined],
    ["REVIEW", true, "review required"]
  ] as const)("carries %s machine verdict and review state", (verdict, reviewRequired, reason) => {
    const summary: RegressionVerdictSummary = {
      regressions: [],
      improvements: [],
      unchangedFailures: [],
      candidateFailures: [],
      verdict,
      reviewRequired,
      ...(reason !== undefined ? { reviewReason: reason } : {})
    };
    const evidence = assembleEvidence({
      toolVersion: "0.1.1-test",
      baseline,
      candidate,
      differences: [],
      checkResults: [],
      regressionVerdict: summary
    });

    expect(evidence.verdict).toBe(verdict);
    expect(evidence.reviewRequired).toBe(reviewRequired);
    expect(evidence.reviewReason).toBe(reason);
    expect(evidence.improvements).toBeUndefined();
  });

  it("preserves supplied-only one-sided metrics without inventing deltas", () => {
    const summary = aggregateRegressionVerdict([], {
      baselineMetrics: { tokens: 80 },
      candidateMetrics: { latencyMs: 200 }
    });
    const evidence = assembleEvidence({
      toolVersion: "0.1.1-test",
      baseline,
      candidate,
      differences: [],
      checkResults: [],
      regressionVerdict: summary
    });

    expect(evidence.metrics).toEqual({
      tokens: { baseline: 80 },
      latencyMs: { candidate: 200 }
    });
  });

  it("generates an opaque UUID and ISO timestamp without embedding input content", () => {
    const summary = aggregateRegressionVerdict([]);
    const evidence = assembleEvidence({
      toolVersion: "0.1.1-test",
      baseline,
      candidate,
      differences: [],
      checkResults: [],
      regressionVerdict: summary
    });

    expect(evidence.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(new Date(evidence.generatedAt).toISOString()).toBe(evidence.generatedAt);
    expect(evidence.id).not.toContain("PRIVATE-CONTENT");
  });

  it("is deterministic when only approved generated fields are normalized", () => {
    const summary = aggregateRegressionVerdict(checkResults, {
      baselineMetrics: baseline,
      candidateMetrics: candidate
    });
    const input = {
      toolVersion: "0.1.1-test",
      baseline,
      candidate,
      differences,
      checkResults,
      regressionVerdict: summary
    } as const;
    const expected = assembleEvidence(input);

    for (let index = 0; index < 20; index += 1) {
      const next = assembleEvidence(input);
      expect({ ...next, id: expected.id, generatedAt: expected.generatedAt }).toEqual(expected);
    }
  });
});

import { describe, expect, it } from "vitest";

import { evaluateChecks } from "../../packages/checks/src/index.js";
import {
  parseTestDefinition,
  type Baseline,
  type Candidate
} from "../../packages/contracts/src/index.js";
import {
  aggregateRegressionVerdict,
  assembleEvidence,
  compareJson
} from "../../packages/core/src/index.js";
import {
  renderEvidenceConsole,
  renderEvidenceJson,
  renderEvidenceMarkdown
} from "../../packages/reporters/src/index.js";

describe("P06 Evidence/reporters integration with frozen P03-P05 outputs", () => {
  it("preserves comparison/check/classification ordering and renders one canonical Evidence result", () => {
    const definition = parseTestDefinition({
      version: 1,
      id: "p06-integration",
      name: "P06 integration",
      baseline: { path: "baseline.json", contentType: "json", tokens: 80, latencyMs: 250 },
      candidate: { path: "candidate.json", contentType: "json", tokens: 120, latencyMs: 200 },
      checks: [
        { id: "status", type: "exact", target: "/status", expected: "ok" },
        { id: "tokens", type: "token-budget", maxTokens: 100 },
        { id: "legacy", type: "required-field", target: "/legacy" }
      ]
    });
    const baseline: Baseline = {
      role: "baseline",
      path: definition.baseline.path,
      contentType: "json",
      value: { status: "ok" },
      tokens: 80,
      latencyMs: 250
    };
    const candidate: Candidate = {
      role: "candidate",
      path: definition.candidate.path,
      contentType: "json",
      value: { legacy: true, status: "changed" },
      tokens: 120,
      latencyMs: 200
    };

    const differences = compareJson(baseline.value, candidate.value);
    const checkResults = evaluateChecks(definition.checks, baseline, candidate);
    const regressionVerdict = aggregateRegressionVerdict(checkResults, {
      reviewRequired: definition.reviewRequired === true,
      baselineMetrics: definition.baseline,
      candidateMetrics: definition.candidate
    });
    const evidence = assembleEvidence({
      toolVersion: "0.1.0-test",
      test: { id: definition.id, name: definition.name },
      baseline,
      candidate,
      differences,
      checkResults,
      regressionVerdict
    });

    expect(
      evidence.differences.map((item) => (item.domain === "json" ? item.path : item.kind))
    ).toEqual(["/legacy", "/status"]);
    expect(evidence.checkResults.map((item) => item.checkId)).toEqual([
      "status",
      "tokens",
      "legacy"
    ]);
    expect(evidence.regressions.map((item) => item.checkId)).toEqual(["status", "tokens"]);
    expect(evidence.improvements?.map((item) => item.checkId)).toEqual(["legacy"]);
    expect(evidence.metrics).toEqual({
      tokens: { baseline: 80, candidate: 120, delta: 40 },
      latencyMs: { baseline: 250, candidate: 200, delta: -50 }
    });
    expect(evidence.verdict).toBe("FAIL");

    const json = renderEvidenceJson(evidence);
    const markdown = renderEvidenceMarkdown(evidence);
    const consoleReport = renderEvidenceConsole(evidence);
    expect(JSON.parse(json)).toEqual(evidence);
    expect(markdown).toContain("## Differences (2)");
    expect(markdown).toContain("## Regressions (2)");
    expect(consoleReport).toContain("Regressions: 2");

    for (let index = 0; index < 20; index += 1) {
      expect(renderEvidenceJson(evidence)).toBe(json);
      expect(renderEvidenceMarkdown(evidence)).toBe(markdown);
      expect(renderEvidenceConsole(evidence)).toBe(consoleReport);
    }
  });
});

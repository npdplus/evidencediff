import { describe, expect, it } from "vitest";

import { evaluateChecks } from "../../packages/checks/src/index.js";
import { parseTestDefinition } from "../../packages/contracts/src/index.js";

describe("P04 contracts/checks integration", () => {
  it("evaluates parsed frozen check definitions against Baseline and Candidate inputs", () => {
    const definition = parseTestDefinition({
      version: 1,
      id: "budgeted-json",
      name: "Budgeted JSON",
      baseline: { path: "baseline.json", contentType: "json", tokens: 80, latencyMs: 200 },
      candidate: { path: "candidate.json", contentType: "json", tokens: 120, latencyMs: 240 },
      checks: [
        { id: "status", type: "exact", target: "/status", expected: "ok" },
        { id: "tokens", type: "token-budget", maxTokens: 100 },
        { id: "latency", type: "latency-budget", maxLatencyMs: 250 }
      ]
    });

    const results = evaluateChecks(
      definition.checks,
      {
        contentType: "json",
        value: { status: "ok" },
        tokens: 80,
        latencyMs: 200
      },
      {
        contentType: "json",
        value: { status: "ok" },
        tokens: 120,
        latencyMs: 240
      }
    );

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      checkId: "status",
      baselineStatus: "PASS",
      candidateStatus: "PASS"
    });
    expect(results[1]).toMatchObject({
      checkId: "tokens",
      baselineStatus: "PASS",
      candidateStatus: "FAIL"
    });
    expect(results[2]).toMatchObject({
      checkId: "latency",
      baselineStatus: "PASS",
      candidateStatus: "PASS"
    });
  });
});

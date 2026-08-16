import { describe, expect, it } from "vitest";

import { parseJsonPointer, type Evidence } from "../../packages/contracts/src/index.js";
import {
  renderEvidenceConsole,
  renderEvidenceJson,
  renderEvidenceMarkdown
} from "../../packages/reporters/src/index.js";

function evidenceWithDetails(details: Record<string, number>): Evidence {
  return {
    formatVersion: 1,
    toolVersion: "0.1.0-test",
    id: "11111111-2222-4333-8444-555555555555",
    generatedAt: "2026-08-16T08:00:00.000Z",
    test: { id: "reporters", name: "Reporter snapshot" },
    baseline: { path: "baseline.json", contentType: "json", tokens: 80, latencyMs: 250 },
    candidate: { path: "candidate.json", contentType: "json", tokens: 120, latencyMs: 200 },
    differences: [
      {
        domain: "json",
        kind: "value-changed",
        path: parseJsonPointer("/status"),
        baseline: "DO-NOT-PRINT-BASELINE",
        candidate: "DO-NOT-PRINT-CANDIDATE",
        baselineType: "string",
        candidateType: "string"
      }
    ],
    checkResults: [
      {
        checkId: "status",
        checkType: "exact",
        baselineStatus: "PASS",
        candidateStatus: "FAIL",
        expected: "DO-NOT-PRINT-EXPECTED",
        actual: "DO-NOT-PRINT-ACTUAL",
        explanation: "value does not exactly match expected value",
        details: { ...details, hidden: "DO-NOT-PRINT-DETAILS" }
      }
    ],
    regressions: [
      {
        kind: "REGRESSION",
        checkId: "status",
        checkType: "exact",
        baselineStatus: "PASS",
        candidateStatus: "FAIL",
        explanation: "value does not exactly match expected value"
      }
    ],
    improvements: [],
    metrics: {
      tokens: { baseline: 80, candidate: 120, delta: 40 },
      latencyMs: { baseline: 250, candidate: 200, delta: -50 }
    },
    verdict: "FAIL",
    reviewRequired: false
  };
}

describe("P06 reporters", () => {
  it("serializes canonical Evidence JSON deterministically with stable nested object ordering", () => {
    const first = evidenceWithDetails({ z: 1, a: 2 });
    const second = evidenceWithDetails({ a: 2, z: 1 });
    const rendered = renderEvidenceJson(first);

    expect(rendered).toBe(renderEvidenceJson(second));
    expect(rendered).toBe(renderEvidenceJson(first));
    expect(JSON.parse(rendered)).toEqual(first);
    expect(rendered.endsWith("\n")).toBe(true);
    expect(rendered.indexOf('"formatVersion"')).toBeLessThan(rendered.indexOf('"toolVersion"'));
  });

  it("renders concise deterministic Markdown without duplicating raw diagnostic payloads", () => {
    const rendered = renderEvidenceMarkdown(evidenceWithDetails({ a: 2, z: 1 }));

    expect(rendered).not.toContain("DO-NOT-PRINT-BASELINE");
    expect(rendered).not.toContain("DO-NOT-PRINT-CANDIDATE");
    expect(rendered).not.toContain("DO-NOT-PRINT-EXPECTED");
    expect(rendered).not.toContain("DO-NOT-PRINT-ACTUAL");
    expect(rendered).not.toContain("DO-NOT-PRINT-DETAILS");
    expect(rendered).toBe(renderEvidenceMarkdown(evidenceWithDetails({ z: 1, a: 2 })));
    expect(rendered).toMatchInlineSnapshot(`
      "# EvidenceDiff Evidence

      - Verdict: **FAIL**
      - Review required: **no**
      - Evidence ID: 11111111-2222-4333-8444-555555555555
      - Generated at: 2026-08-16T08:00:00.000Z
      - Tool version: 0.1.0-test
      - Test: reporters — Reporter snapshot

      ## Inputs

      - Baseline: path=baseline.json, contentType=json, tokens=80, latencyMs=250
      - Candidate: path=candidate.json, contentType=json, tokens=120, latencyMs=200

      ## Differences (1)

      - json/value-changed at /status

      ## Checks (1)

      - status (exact): PASS -> FAIL; value does not exactly match expected value

      ## Regressions (1)

      - status (exact): PASS -> FAIL; value does not exactly match expected value

      ## Improvements (0)

      - None

      ## Metrics

      - Tokens: baseline=80, candidate=120, delta=40
      - Latency ms: baseline=250, candidate=200, delta=-50
      "
    `);
  });

  it("renders concise deterministic console output without duplicating raw diagnostic payloads", () => {
    const rendered = renderEvidenceConsole(evidenceWithDetails({ a: 2, z: 1 }));

    expect(rendered).not.toContain("DO-NOT-PRINT-BASELINE");
    expect(rendered).not.toContain("DO-NOT-PRINT-CANDIDATE");
    expect(rendered).not.toContain("DO-NOT-PRINT-EXPECTED");
    expect(rendered).not.toContain("DO-NOT-PRINT-ACTUAL");
    expect(rendered).not.toContain("DO-NOT-PRINT-DETAILS");
    expect(rendered).toBe(renderEvidenceConsole(evidenceWithDetails({ z: 1, a: 2 })));
    expect(rendered).toMatchInlineSnapshot(`
      "EvidenceDiff FAIL
      Evidence: 11111111-2222-4333-8444-555555555555
      Generated: 2026-08-16T08:00:00.000Z
      Tool: 0.1.0-test
      Review required: no
      Test: reporters - Reporter snapshot
      Baseline: path=baseline.json, contentType=json, tokens=80, latencyMs=250
      Candidate: path=candidate.json, contentType=json, tokens=120, latencyMs=200
      Differences: 1
        - json/value-changed at /status
      Checks: 1
        - status (exact): PASS -> FAIL; value does not exactly match expected value
      Regressions: 1
        - status (exact): PASS -> FAIL; value does not exactly match expected value
      Improvements: 0
      Tokens: baseline=80, candidate=120, delta=40
      Latency ms: baseline=250, candidate=200, delta=-50
      "
    `);
  });

  it("renders the machine verdict and transitions already present in Evidence without recalculation", () => {
    const evidence = { ...evidenceWithDetails({}), verdict: "REVIEW" as const, regressions: [] };

    expect(renderEvidenceJson(evidence)).toContain('"verdict": "REVIEW"');
    expect(renderEvidenceMarkdown(evidence)).toContain("Verdict: **REVIEW**");
    expect(renderEvidenceConsole(evidence)).toContain("EvidenceDiff REVIEW");
  });
});

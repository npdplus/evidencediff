import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../../apps/cli/src/cli.js";
import { parseTestDefinitionJson } from "../../packages/contracts/src/index.js";

interface CapturedRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

const root = process.cwd();

async function run(args: readonly string[]): Promise<CapturedRun> {
  let stdout = "";
  let stderr = "";
  const code = await runCli(args, {
    cwd: root,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    }
  });
  return { code, stdout, stderr };
}

function normalizedEvidence(jsonText: string): Record<string, unknown> {
  const evidence = JSON.parse(jsonText) as Record<string, unknown>;
  delete evidence.id;
  delete evidence.generatedAt;
  return evidence;
}

describe("P08 examples and integration", () => {
  it("keeps every Test Definition example valid through the frozen contract", async () => {
    const definitions = [
      "examples/structured-json-regression/test-definition.json",
      "examples/prompt-output-regression/test-definition.json",
      "examples/captured-model-a-vs-model-b/test-definition.json",
      "examples/token-latency-budget-regression/test-definition.json"
    ];

    for (const path of definitions) {
      const text = await readFile(resolve(root, path), "utf8");
      expect(() => parseTestDefinitionJson(text)).not.toThrow();
    }
  });

  it("runs structured JSON regression through the real CLI pipeline", async () => {
    const result = await run([
      "test",
      "examples/structured-json-regression/test-definition.json",
      "--format",
      "json"
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");
    const evidence = JSON.parse(result.stdout) as {
      verdict: string;
      regressions: readonly unknown[];
      differences: readonly unknown[];
    };
    expect(evidence.verdict).toBe("FAIL");
    expect(evidence.regressions).toHaveLength(1);
    expect(evidence.differences).toHaveLength(1);
  });

  it("runs captured prompt-output regression with concise console reporting", async () => {
    const result = await run([
      "test",
      "examples/prompt-output-regression/test-definition.json",
      "--format",
      "console"
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("EvidenceDiff FAIL");
    expect(result.stdout).toContain("Regressions: 1");
    expect(result.stdout).toContain("required-escalation");
    expect(result.stdout).not.toContain("Your billing request is queued");
  });

  it("compares provider-neutral Model A and Model B captures with Markdown output", async () => {
    const result = await run([
      "test",
      "examples/captured-model-a-vs-model-b/test-definition.json",
      "--format",
      "markdown"
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("# EvidenceDiff Evidence");
    expect(result.stdout).toContain("- Verdict: **PASS**");
    expect(result.stdout).toContain("## Differences (1)");
  });

  it("uses supplied token and latency metadata for deterministic budget regression", async () => {
    const result = await run([
      "test",
      "examples/token-latency-budget-regression/test-definition.json",
      "--format",
      "json"
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");
    const evidence = JSON.parse(result.stdout) as {
      verdict: string;
      regressions: readonly unknown[];
      metrics: {
        tokens: { baseline: number; candidate: number; delta: number };
        latencyMs: { baseline: number; candidate: number; delta: number };
      };
    };
    expect(evidence.verdict).toBe("FAIL");
    expect(evidence.regressions).toHaveLength(2);
    expect(evidence.metrics).toEqual({
      latencyMs: { baseline: 240, candidate: 720, delta: 480 },
      tokens: { baseline: 80, candidate: 140, delta: 60 }
    });
  });

  it("keeps direct visual/content Difference review-only with exit code 3", async () => {
    const result = await run([
      "compare",
      "examples/review-only-direct-comparison/baseline.txt",
      "examples/review-only-direct-comparison/candidate.txt",
      "--content-type",
      "text",
      "--format",
      "json"
    ]);

    expect(result.code).toBe(3);
    expect(result.stderr).toBe("");
    const evidence = JSON.parse(result.stdout) as {
      verdict: string;
      regressions: readonly unknown[];
      differences: readonly unknown[];
      reviewRequired: boolean;
      reviewReason?: string;
    };
    expect(evidence.verdict).toBe("REVIEW");
    expect(evidence.regressions).toEqual([]);
    expect(evidence.differences).toHaveLength(1);
    expect(evidence.reviewRequired).toBe(true);
    expect(evidence.reviewReason).toBe("No deterministic acceptance checks were provided.");
  });

  it("repeats example execution deterministically apart from generated Evidence fields", async () => {
    const args = [
      "test",
      "examples/structured-json-regression/test-definition.json",
      "--format",
      "json"
    ] as const;

    const first = await run(args);
    const second = await run(args);

    expect(first.code).toBe(1);
    expect(second.code).toBe(1);
    expect(first.stderr).toBe("");
    expect(second.stderr).toBe("");
    expect(normalizedEvidence(first.stdout)).toEqual(normalizedEvidence(second.stdout));
  });
});

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const cli = resolve(root, "apps/cli/dist/index.js");

function execute(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertClean(result, expectedStatus, label) {
  assert(result.status === expectedStatus, `${label} exit code was ${result.status}`);
  assert(result.stderr === "", `${label} wrote stderr: ${result.stderr}`);
}

const structured = execute([
  "test",
  "examples/structured-json-regression/test-definition.json",
  "--format",
  "json"
]);
assertClean(structured, 1, "structured JSON regression");
const structuredEvidence = JSON.parse(structured.stdout);
assert(structuredEvidence.verdict === "FAIL", "structured example did not FAIL");
assert(structuredEvidence.regressions.length === 1, "structured example regression count changed");

const promptOutput = execute([
  "test",
  "examples/prompt-output-regression/test-definition.json",
  "--format",
  "console"
]);
assertClean(promptOutput, 1, "prompt-output regression");
assert(
  promptOutput.stdout.includes("PromptDiff FAIL"),
  "prompt-output example did not render FAIL"
);
assert(
  !promptOutput.stdout.includes("Your billing request is queued"),
  "console output exposed captured raw output"
);

const modelComparison = execute([
  "test",
  "examples/captured-model-a-vs-model-b/test-definition.json",
  "--format",
  "markdown"
]);
assertClean(modelComparison, 0, "captured Model A/B comparison");
assert(modelComparison.stdout.includes("- Verdict: **PASS**"), "Model A/B example did not PASS");
assert(
  modelComparison.stdout.includes("## Differences (1)"),
  "Model A/B Difference was not reported"
);

const budget = execute([
  "test",
  "examples/token-latency-budget-regression/test-definition.json",
  "--format",
  "json"
]);
assertClean(budget, 1, "budget regression");
const budgetEvidence = JSON.parse(budget.stdout);
assert(budgetEvidence.verdict === "FAIL", "budget example did not FAIL");
assert(budgetEvidence.regressions.length === 2, "budget example regression count changed");
assert(budgetEvidence.metrics.tokens.delta === 60, "token delta changed");
assert(budgetEvidence.metrics.latencyMs.delta === 480, "latency delta changed");

const review = execute([
  "compare",
  "examples/review-only-direct-comparison/baseline.txt",
  "examples/review-only-direct-comparison/candidate.txt",
  "--content-type",
  "text",
  "--format",
  "json"
]);
assertClean(review, 3, "review-only direct comparison");
const reviewEvidence = JSON.parse(review.stdout);
assert(reviewEvidence.verdict === "REVIEW", "direct comparison did not remain REVIEW");
assert(reviewEvidence.regressions.length === 0, "direct comparison invented a regression");
assert(reviewEvidence.differences.length === 1, "direct comparison did not report the Difference");

process.stdout.write("PromptDiff P08 example smoke tests passed.\n");

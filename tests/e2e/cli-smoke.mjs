import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const cli = resolve(root, "apps/cli/dist/index.js");
const fixtureDirectory = mkdtempSync(join(tmpdir(), "promptdiff-cli-smoke-"));

function execute(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: fixtureDirectory,
    encoding: "utf8"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  const help = execute(["--help"]);
  assert(help.status === 0, `help exit code was ${help.status}`);
  assert(help.stderr === "", `help wrote stderr: ${help.stderr}`);
  assert(help.stdout.includes("promptdiff compare"), "help did not list compare");

  writeFileSync(join(fixtureDirectory, "baseline.txt"), "accepted", "utf8");
  writeFileSync(join(fixtureDirectory, "candidate.txt"), "changed", "utf8");

  const compare = execute([
    "compare",
    "baseline.txt",
    "candidate.txt",
    "--content-type",
    "text",
    "--format",
    "json"
  ]);
  assert(compare.status === 3, `compare REVIEW exit code was ${compare.status}`);
  assert(compare.stderr === "", `compare wrote stderr: ${compare.stderr}`);
  const compareEvidence = JSON.parse(compare.stdout);
  assert(compareEvidence.verdict === "REVIEW", "compare did not produce REVIEW Evidence");

  writeFileSync(
    join(fixtureDirectory, "test.json"),
    `${JSON.stringify(
      {
        version: 1,
        id: "cli-smoke",
        name: "CLI smoke",
        baseline: { path: "baseline.txt", contentType: "text" },
        candidate: { path: "baseline.txt", contentType: "text" },
        checks: [{ id: "exact", type: "exact", expected: "accepted" }]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const test = execute(["test", "test.json", "--format", "json"]);
  assert(test.status === 0, `test PASS exit code was ${test.status}`);
  assert(test.stderr === "", `test wrote stderr: ${test.stderr}`);
  const testEvidence = JSON.parse(test.stdout);
  assert(testEvidence.verdict === "PASS", "test did not produce PASS Evidence");

  process.stdout.write("Built PromptDiff CLI smoke tests passed.\n");
} finally {
  rmSync(fixtureDirectory, { recursive: true, force: true });
}

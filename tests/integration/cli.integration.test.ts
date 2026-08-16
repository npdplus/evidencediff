import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../../apps/cli/src/cli.js";

interface CapturedRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "evidencediff-cli-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function run(cwd: string, args: readonly string[]): Promise<CapturedRun> {
  let stdout = "";
  let stderr = "";
  const code = await runCli(args, {
    cwd,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    }
  });
  return { code, stdout, stderr };
}

async function writeDefinition(
  directory: string,
  definition: Record<string, unknown>,
  name = "test.json"
): Promise<string> {
  const path = join(directory, name);
  await writeFile(path, `${JSON.stringify(definition, null, 2)}\n`, "utf8");
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  );
});

describe("P07 CLI integration", () => {
  it("runs direct compare as REVIEW with exit code 3 and human console output", async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, "baseline.txt"), "accepted", "utf8");
    await writeFile(join(cwd, "candidate.txt"), "changed", "utf8");

    const result = await run(cwd, [
      "compare",
      "--baseline",
      "baseline.txt",
      "--candidate",
      "candidate.txt",
      "--content-type",
      "text"
    ]);

    expect(result.code).toBe(3);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("EvidenceDiff REVIEW");
    expect(result.stdout).toContain("Differences: 1");
    expect(result.stdout).toContain("Regressions: 0");
    expect(result.stdout).toContain("No deterministic acceptance checks were provided.");
  });

  it("keeps JSON stdout machine-clean and semantically deterministic", async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, "baseline.json"), '{"a":1,"b":2}\n', "utf8");
    await writeFile(join(cwd, "candidate.json"), '{"a":1,"b":3}\n', "utf8");

    const first = await run(cwd, [
      "compare",
      "baseline.json",
      "candidate.json",
      "--content-type",
      "json",
      "--format",
      "json"
    ]);
    const second = await run(cwd, [
      "compare",
      "baseline.json",
      "candidate.json",
      "--content-type",
      "json",
      "--format",
      "json"
    ]);

    expect(first.code).toBe(3);
    expect(first.stderr).toBe("");
    expect(second.code).toBe(3);
    const firstEvidence = JSON.parse(first.stdout) as Record<string, unknown>;
    const secondEvidence = JSON.parse(second.stdout) as Record<string, unknown>;
    expect(firstEvidence.verdict).toBe("REVIEW");
    expect(firstEvidence.differences).toEqual([
      {
        baseline: 2,
        baselineType: "number",
        candidate: 3,
        candidateType: "number",
        domain: "json",
        kind: "value-changed",
        path: "/b"
      }
    ]);

    delete firstEvidence.id;
    delete firstEvidence.generatedAt;
    delete secondEvidence.id;
    delete secondEvidence.generatedAt;
    expect(firstEvidence).toEqual(secondEvidence);
  });

  it("renders Markdown through the frozen P06 reporter", async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, "baseline.txt"), "same", "utf8");
    await writeFile(join(cwd, "candidate.txt"), "same", "utf8");

    const result = await run(cwd, [
      "compare",
      "baseline.txt",
      "candidate.txt",
      "--format",
      "markdown"
    ]);

    expect(result.code).toBe(3);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("# EvidenceDiff Evidence");
    expect(result.stdout).toContain("- Verdict: **REVIEW**");
  });

  it("runs a Test Definition PASS with exit code 0", async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, "baseline.txt"), "approved", "utf8");
    await writeFile(join(cwd, "candidate.txt"), "approved", "utf8");
    await writeDefinition(cwd, {
      version: 1,
      id: "pass-case",
      name: "PASS case",
      baseline: { path: "baseline.txt", contentType: "text" },
      candidate: { path: "candidate.txt", contentType: "text" },
      checks: [{ id: "exact", type: "exact", expected: "approved" }]
    });

    const result = await run(cwd, ["test", "--definition", "test.json", "--format", "json"]);
    const evidence = JSON.parse(result.stdout) as Record<string, unknown>;

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(evidence.verdict).toBe("PASS");
    expect(evidence.regressions).toEqual([]);
  });

  it("runs a Test Definition FAIL with exit code 1 and frozen regression semantics", async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, "baseline.txt"), "approved", "utf8");
    await writeFile(join(cwd, "candidate.txt"), "changed", "utf8");
    await writeDefinition(cwd, {
      version: 1,
      id: "fail-case",
      name: "FAIL case",
      baseline: { path: "baseline.txt", contentType: "text" },
      candidate: { path: "candidate.txt", contentType: "text" },
      checks: [{ id: "exact", type: "exact", expected: "approved" }]
    });

    const result = await run(cwd, ["test", "test.json", "--format", "json"]);
    const evidence = JSON.parse(result.stdout) as {
      readonly verdict: string;
      readonly regressions: readonly Record<string, unknown>[];
    };

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");
    expect(evidence.verdict).toBe("FAIL");
    expect(evidence.regressions).toEqual([
      {
        baselineStatus: "PASS",
        candidateStatus: "FAIL",
        checkId: "exact",
        checkType: "exact",
        explanation: "value does not exactly match expected value",
        kind: "REGRESSION"
      }
    ]);
  });

  it("runs a no-check Test Definition as REVIEW with exit code 3", async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, "baseline.txt"), "accepted", "utf8");
    await writeFile(join(cwd, "candidate.txt"), "candidate", "utf8");
    await writeDefinition(cwd, {
      version: 1,
      id: "review-case",
      name: "REVIEW case",
      baseline: { path: "baseline.txt", contentType: "text" },
      candidate: { path: "candidate.txt", contentType: "text" },
      checks: []
    });

    const result = await run(cwd, ["test", "test.json"]);

    expect(result.code).toBe(3);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("EvidenceDiff REVIEW");
  });

  it("resolves Test Definition inputs relative to the definition file", async () => {
    const cwd = await temporaryDirectory();
    const definitions = join(cwd, "config");
    const data = join(cwd, "data");
    await mkdir(definitions);
    await mkdir(data);
    await writeFile(join(data, "baseline.json"), '{"status":"ok"}\n', "utf8");
    await writeFile(join(data, "candidate.json"), '{"status":"ok"}\n', "utf8");
    await writeDefinition(
      definitions,
      {
        version: 1,
        id: "relative-paths",
        name: "Relative paths",
        baseline: { path: "../data/baseline.json", contentType: "json" },
        candidate: { path: "../data/candidate.json", contentType: "json" },
        checks: [{ type: "required-field", target: "/status" }]
      },
      "relative.json"
    );

    const result = await run(cwd, ["test", "config/relative.json", "--format", "json"]);
    const evidence = JSON.parse(result.stdout) as {
      readonly verdict: string;
      readonly baseline: { readonly path: string };
    };

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(evidence.verdict).toBe("PASS");
    expect(evidence.baseline.path).toBe("../data/baseline.json");
  });

  it("maps missing files and malformed Test Definitions to exit code 2 on stderr", async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, "broken.json"), "{not-json", "utf8");

    const missing = await run(cwd, ["compare", "missing.txt", "candidate.txt"]);
    const malformed = await run(cwd, ["test", "broken.json", "--format", "json"]);

    expect(missing.code).toBe(2);
    expect(missing.stdout).toBe("");
    expect(missing.stderr).toContain("Cannot read baseline input");
    expect(malformed.code).toBe(2);
    expect(malformed.stdout).toBe("");
    expect(malformed.stderr).toContain("Invalid Test Definition");
  });

  it("refuses destructive output overwrite unless --force is explicit", async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, "baseline.txt"), "accepted", "utf8");
    await writeFile(join(cwd, "candidate.txt"), "changed", "utf8");
    await writeFile(join(cwd, "evidence.json"), "keep-me", "utf8");

    const refused = await run(cwd, [
      "compare",
      "baseline.txt",
      "candidate.txt",
      "--format",
      "json",
      "--output",
      "evidence.json"
    ]);
    expect(refused.code).toBe(2);
    expect(refused.stdout).toBe("");
    expect(refused.stderr).toContain("Use --force to replace it");
    expect(await readFile(join(cwd, "evidence.json"), "utf8")).toBe("keep-me");

    const replaced = await run(cwd, [
      "compare",
      "baseline.txt",
      "candidate.txt",
      "--format",
      "json",
      "--output",
      "evidence.json",
      "--force"
    ]);
    expect(replaced.code).toBe(3);
    expect(replaced.stdout).toBe("");
    expect(replaced.stderr).toBe("");
    expect(JSON.parse(await readFile(join(cwd, "evidence.json"), "utf8"))).toMatchObject({
      verdict: "REVIEW"
    });
  });

  it("never overwrites protected input paths even with --force", async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, "baseline.txt"), "accepted", "utf8");
    await writeFile(join(cwd, "candidate.txt"), "changed", "utf8");

    const result = await run(cwd, [
      "compare",
      "baseline.txt",
      "candidate.txt",
      "--output",
      "candidate.txt",
      "--force"
    ]);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("must not overwrite an input");
    expect(await readFile(join(cwd, "candidate.txt"), "utf8")).toBe("changed");
  });

  it("provides concise discoverable help without stderr noise", async () => {
    const cwd = await temporaryDirectory();
    const topLevel = await run(cwd, ["--help"]);
    const compare = await run(cwd, ["compare", "--help"]);
    const test = await run(cwd, ["test", "--help"]);

    expect(topLevel).toMatchObject({ code: 0, stderr: "" });
    expect(topLevel.stdout).toContain("evidencediff compare");
    expect(compare).toMatchObject({ code: 0, stderr: "" });
    expect(compare.stdout).toContain("--content-type");
    expect(test).toMatchObject({ code: 0, stderr: "" });
    expect(test.stdout).toContain("Test Definition Baseline/Candidate paths resolve relative");
  });
});

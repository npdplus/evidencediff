import { link, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const generatedAtPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "evidencediff-hardening-test-"));
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

function normalizeGeneratedText(text: string): string {
  return text.replace(uuidPattern, "<evidence-id>").replace(generatedAtPattern, "<generated-at>");
}

function normalizeEvidenceJson(text: string): Record<string, unknown> {
  const evidence = JSON.parse(text) as Record<string, unknown>;
  delete evidence.id;
  delete evidence.generatedAt;
  return evidence;
}

async function writeDeterminismFixture(cwd: string): Promise<void> {
  await writeFile(join(cwd, "baseline.json"), '{"status":"ok","nested":{"b":2,"a":1}}\n', "utf8");
  await writeFile(join(cwd, "candidate.json"), '{"nested":{"a":2,"b":3},"status":"bad"}\n', "utf8");
  await writeFile(
    join(cwd, "test.json"),
    `${JSON.stringify(
      {
        version: 1,
        id: "p09-determinism",
        name: "P09 deterministic execution",
        baseline: { path: "baseline.json", contentType: "json", tokens: 10, latencyMs: 100 },
        candidate: { path: "candidate.json", contentType: "json", tokens: 12, latencyMs: 120 },
        checks: [
          { id: "status", type: "exact", target: "/status", expected: "ok" },
          { id: "nested-a", type: "numeric-range", target: "/nested/a", min: 1, max: 2 },
          { id: "tokens", type: "token-budget", maxTokens: 11 }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("P09 quality and security hardening", () => {
  it("keeps JSON, console, and Markdown semantics deterministic across repeated executions", async () => {
    const cwd = await temporaryDirectory();
    await writeDeterminismFixture(cwd);

    for (const format of ["json", "console", "markdown"] as const) {
      const first = await run(cwd, ["test", "test.json", "--format", format]);
      expect(first.code).toBe(1);
      expect(first.stderr).toBe("");

      const expected =
        format === "json"
          ? normalizeEvidenceJson(first.stdout)
          : normalizeGeneratedText(first.stdout);

      for (let index = 0; index < 10; index += 1) {
        const next = await run(cwd, ["test", "test.json", "--format", format]);
        expect(next.code).toBe(1);
        expect(next.stderr).toBe("");
        expect(
          format === "json"
            ? normalizeEvidenceJson(next.stdout)
            : normalizeGeneratedText(next.stdout)
        ).toEqual(expected);
      }
    }
  });

  it("minimizes human reports while preserving canonical JSON diagnostics", async () => {
    const cwd = await temporaryDirectory();
    const expectedSentinel = "EXPECTED-SECRET-SENTINEL";
    const candidateSentinel = "CANDIDATE-SECRET-SENTINEL";
    await writeFile(join(cwd, "baseline.txt"), expectedSentinel, "utf8");
    await writeFile(join(cwd, "candidate.txt"), candidateSentinel, "utf8");
    await writeFile(
      join(cwd, "test.json"),
      `${JSON.stringify(
        {
          version: 1,
          id: "p09-privacy",
          name: "P09 privacy reporting",
          baseline: { path: "baseline.txt", contentType: "text" },
          candidate: { path: "candidate.txt", contentType: "text" },
          checks: [{ id: "exact", type: "exact", expected: expectedSentinel }]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    for (const format of ["console", "markdown"] as const) {
      const result = await run(cwd, ["test", "test.json", "--format", format]);
      expect(result.code).toBe(1);
      expect(result.stderr).toBe("");
      expect(result.stdout).not.toContain(expectedSentinel);
      expect(result.stdout).not.toContain(candidateSentinel);
    }

    const machine = await run(cwd, ["test", "test.json", "--format", "json"]);
    expect(machine.code).toBe(1);
    expect(machine.stderr).toBe("");
    expect(machine.stdout).toContain(expectedSentinel);
    expect(machine.stdout).toContain(candidateSentinel);
  });

  it("does not expose implicit absolute working paths in operational errors", async () => {
    const cwd = await temporaryDirectory();

    const missing = await run(cwd, ["compare", "missing.txt", "candidate.txt"]);
    expect(missing.code).toBe(2);
    expect(missing.stdout).toBe("");
    expect(missing.stderr).toContain("missing.txt");
    expect(missing.stderr).not.toContain(cwd);

    await writeFile(join(cwd, "baseline.txt"), "accepted", "utf8");
    await writeFile(join(cwd, "candidate.txt"), "candidate", "utf8");
    await writeFile(join(cwd, "evidence.json"), "existing", "utf8");
    const existingOutput = await run(cwd, [
      "compare",
      "baseline.txt",
      "candidate.txt",
      "--output",
      "evidence.json"
    ]);
    expect(existingOutput.code).toBe(2);
    expect(existingOutput.stdout).toBe("");
    expect(existingOutput.stderr).toContain("evidence.json");
    expect(existingOutput.stderr).not.toContain(cwd);

    const unwritableOutput = await run(cwd, [
      "compare",
      "baseline.txt",
      "candidate.txt",
      "--output",
      "missing-directory/evidence.json"
    ]);
    expect(unwritableOutput.code).toBe(2);
    expect(unwritableOutput.stdout).toBe("");
    expect(unwritableOutput.stderr).toContain("missing-directory/evidence.json");
    expect(unwritableOutput.stderr).not.toContain(cwd);
  });

  it("refuses force-overwrite through a hard-link alias of a protected input", async () => {
    const cwd = await temporaryDirectory();
    const candidatePath = join(cwd, "candidate.txt");
    const aliasPath = join(cwd, "candidate-alias.txt");
    await writeFile(join(cwd, "baseline.txt"), "accepted", "utf8");
    await writeFile(candidatePath, "candidate", "utf8");
    await link(candidatePath, aliasPath);

    const result = await run(cwd, [
      "compare",
      "baseline.txt",
      "candidate.txt",
      "--output",
      "candidate-alias.txt",
      "--force"
    ]);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("must not overwrite an input");
    expect(await readFile(candidatePath, "utf8")).toBe("candidate");
    expect(await readFile(aliasPath, "utf8")).toBe("candidate");
  });
});

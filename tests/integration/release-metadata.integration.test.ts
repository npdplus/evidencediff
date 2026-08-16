import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { runCli } from "../../apps/cli/src/cli.js";

interface PackageManifest {
  readonly version: string;
}

async function packageVersion(relativePath: string): Promise<string> {
  const text = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return (JSON.parse(text) as PackageManifest).version;
}

describe("P10 release metadata", () => {
  it("keeps every V0.1 package version aligned at 0.1.0", async () => {
    const versions = await Promise.all([
      packageVersion("../../package.json"),
      packageVersion("../../apps/cli/package.json"),
      packageVersion("../../packages/contracts/package.json"),
      packageVersion("../../packages/core/package.json"),
      packageVersion("../../packages/checks/package.json"),
      packageVersion("../../packages/reporters/package.json")
    ]);

    expect(new Set(versions)).toEqual(new Set(["0.1.0"]));
  });

  it("reports the V0.1 release version through CLI help", async () => {
    let stdout = "";
    let stderr = "";

    const code = await runCli(["--help"], {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      }
    });

    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("EvidenceDiff 0.1.0");
  });
});

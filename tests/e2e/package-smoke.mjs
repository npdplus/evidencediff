import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const packageRoots = [
  "packages/contracts",
  "packages/core",
  "packages/checks",
  "packages/reporters",
  "apps/cli"
];
const destination = mkdtempSync(join(tmpdir(), "evidencediff-package-smoke-"));
const pnpmCli = process.env.npm_execpath;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function pack(packageRoot) {
  assert(pnpmCli !== undefined, "pnpm executable path is unavailable");
  const before = new Set(readdirSync(destination));
  const result = spawnSync(process.execPath, [pnpmCli, "pack", "--pack-destination", destination], {
    cwd: resolve(root, packageRoot),
    encoding: "utf8"
  });
  assert(result.status === 0, `${packageRoot} pack failed: ${result.stderr || result.stdout}`);
  const created = readdirSync(destination).filter(
    (name) => !before.has(name) && name.endsWith(".tgz")
  );
  assert(created.length === 1, `${packageRoot} did not produce exactly one package archive`);
  return join(destination, created[0]);
}

function listArchive(archive) {
  const result = spawnSync("tar", ["-tf", archive], { encoding: "utf8" });
  assert(result.status === 0, `cannot inspect ${archive}: ${result.stderr}`);
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

try {
  for (const packageRoot of packageRoots) {
    const manifest = JSON.parse(readFileSync(resolve(root, packageRoot, "package.json"), "utf8"));
    assert(manifest.license === "MIT", `${packageRoot} package metadata must declare MIT`);
    assert(
      Array.isArray(manifest.files) && manifest.files.length === 1 && manifest.files[0] === "dist",
      `${packageRoot} must package dist only`
    );

    const archive = pack(packageRoot);
    const entries = listArchive(archive);
    assert(
      entries.includes("package/package.json"),
      `${packageRoot} archive is missing package.json`
    );
    assert(
      entries.includes("package/dist/index.js"),
      `${packageRoot} archive is missing dist/index.js`
    );
    assert(
      entries.includes("package/dist/index.d.ts"),
      `${packageRoot} archive is missing dist/index.d.ts`
    );
    assert(
      !entries.some((entry) => entry.startsWith("package/src/")),
      `${packageRoot} archive includes source files`
    );
    assert(
      !entries.some((entry) => entry.startsWith("package/tests/")),
      `${packageRoot} archive includes tests`
    );
    assert(
      !entries.some((entry) => entry.startsWith("package/docs/")),
      `${packageRoot} archive includes docs`
    );
    assert(
      !entries.some((entry) => entry.startsWith("package/examples/")),
      `${packageRoot} archive includes examples`
    );
  }

  const cliManifest = JSON.parse(readFileSync(resolve(root, "apps/cli/package.json"), "utf8"));
  assert(
    cliManifest.bin?.evidencediff === "./dist/index.js",
    "CLI package bin mapping is incorrect"
  );
  const builtCli = readFileSync(resolve(root, "apps/cli/dist/index.js"), "utf8");
  assert(
    builtCli.startsWith("#!/usr/bin/env node\n"),
    "built CLI entry point is missing its shebang"
  );

  process.stdout.write(
    `Packaging smoke tests passed for ${packageRoots.length} workspace packages.\n`
  );
} finally {
  rmSync(destination, { recursive: true, force: true });
}

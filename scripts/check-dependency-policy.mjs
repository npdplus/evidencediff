import console from "node:console";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const workspacePackageRoots = [
  "apps/cli",
  "packages/contracts",
  "packages/core",
  "packages/checks",
  "packages/reporters"
];
const allowedDirectToolLicenses = new Set(["MIT", "Apache-2.0"]);
const violations = [];

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const rootManifestPath = join(root, "package.json");
const rootManifest = await readJson(rootManifestPath);
if (rootManifest.license !== "MIT") {
  violations.push("package.json: repository license metadata must remain MIT");
}

for (const packageRoot of workspacePackageRoots) {
  const manifestPath = join(root, packageRoot, "package.json");
  const manifest = await readJson(manifestPath);
  if (manifest.license !== "MIT") {
    violations.push(`${relative(root, manifestPath)}: package license metadata must be MIT`);
  }
}

const directDevDependencies = Object.entries(rootManifest.devDependencies ?? {});
for (const [name, declaredVersion] of directDevDependencies) {
  if (!/^\d+\.\d+\.\d+$/.test(String(declaredVersion))) {
    violations.push(`package.json: ${name} must use an exact pinned development version`);
  }

  const installedManifestPath = join(root, "node_modules", ...name.split("/"), "package.json");
  let installedManifest;
  try {
    installedManifest = await readJson(installedManifestPath);
  } catch {
    violations.push(`package.json: installed metadata for ${name} is unavailable`);
    continue;
  }

  if (installedManifest.version !== declaredVersion) {
    violations.push(
      `package.json: installed ${name} version ${installedManifest.version} does not match ${declaredVersion}`
    );
  }
  if (!allowedDirectToolLicenses.has(installedManifest.license)) {
    violations.push(
      `package.json: direct development dependency ${name} has unreviewed license ${String(installedManifest.license)}`
    );
  }
}

if (violations.length > 0) {
  console.error("Dependency/license policy verification failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Dependency/license policy verification passed for ${workspacePackageRoots.length} workspace packages and ${directDevDependencies.length} direct development dependencies.`
  );
}

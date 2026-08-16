import console from "node:console";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const workspaceRoots = ["apps", "packages"];
const allowedWorkspaceDependencies = new Map([
  ["@npdplus/promptdiff-contracts", new Set()],
  ["@npdplus/promptdiff-core", new Set(["@npdplus/promptdiff-contracts"])],
  ["@npdplus/promptdiff-checks", new Set(["@npdplus/promptdiff-contracts"])],
  ["@npdplus/promptdiff-reporters", new Set(["@npdplus/promptdiff-contracts"])],
  [
    "@npdplus/promptdiff-cli",
    new Set([
      "@npdplus/promptdiff-contracts",
      "@npdplus/promptdiff-core",
      "@npdplus/promptdiff-checks",
      "@npdplus/promptdiff-reporters"
    ])
  ]
]);

async function findWorkspacePackages() {
  const packages = [];

  for (const workspaceRoot of workspaceRoots) {
    const absoluteRoot = join(root, workspaceRoot);
    let entries;

    try {
      entries = await readdir(absoluteRoot, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageJsonPath = join(absoluteRoot, entry.name, "package.json");
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
        packages.push({
          name: packageJson.name,
          path: relative(root, packageJsonPath),
          dependencies: {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
            ...packageJson.peerDependencies
          }
        });
      } catch (error) {
        if (error?.code === "ENOENT") {
          continue;
        }
        throw error;
      }
    }
  }

  return packages;
}

function verifyBoundaries(packages) {
  const workspaceNames = new Set(packages.map((item) => item.name));
  const graph = new Map();
  const violations = [];

  for (const item of packages) {
    const allowed = allowedWorkspaceDependencies.get(item.name);
    if (!allowed) {
      violations.push(`${item.path}: unknown workspace package name ${item.name}`);
      continue;
    }

    const workspaceDependencies = Object.keys(item.dependencies ?? {}).filter((name) =>
      workspaceNames.has(name)
    );

    graph.set(item.name, workspaceDependencies);

    for (const dependency of workspaceDependencies) {
      if (!allowed.has(dependency)) {
        violations.push(`${item.name} must not depend on ${dependency}`);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();

  function visit(name, stack) {
    if (visiting.has(name)) {
      violations.push(`workspace dependency cycle: ${[...stack, name].join(" -> ")}`);
      return;
    }

    if (visited.has(name)) {
      return;
    }

    visiting.add(name);
    for (const dependency of graph.get(name) ?? []) {
      visit(dependency, [...stack, name]);
    }
    visiting.delete(name);
    visited.add(name);
  }

  for (const name of graph.keys()) {
    visit(name, []);
  }

  return violations;
}

const packages = await findWorkspacePackages();
const violations = verifyBoundaries(packages);

if (violations.length > 0) {
  console.error("Package boundary verification failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Package boundary verification passed for ${packages.length} workspace packages.`);
}

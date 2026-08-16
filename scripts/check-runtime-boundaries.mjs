import console from "node:console";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const productSourceRoots = [
  "apps/cli/src",
  "packages/contracts/src",
  "packages/core/src",
  "packages/checks/src",
  "packages/reporters/src"
];
const workspacePackageRoots = [
  "apps/cli",
  "packages/contracts",
  "packages/core",
  "packages/checks",
  "packages/reporters"
];
const forbiddenSourcePatterns = [
  {
    label: "network-capable Node built-in",
    pattern: /["']node:(?:http|https|http2|net|tls|dns|dgram)["']/
  },
  {
    label: "runtime network API",
    pattern: /\b(?:fetch|WebSocket|EventSource)\s*(?:\(|\.)/
  },
  {
    label: "provider SDK import",
    pattern:
      /["'](?:openai|@anthropic-ai\/sdk|@google\/genai|@google\/generative-ai|@azure\/openai|ollama)["']/i
  }
];
const lifecycleScripts = new Set(["preinstall", "install", "postinstall"]);

async function collectSourceFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(path)));
      continue;
    }
    if (entry.isFile() && /\.(?:ts|js|mjs)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

const violations = [];

for (const sourceRoot of productSourceRoots) {
  const absoluteRoot = join(root, sourceRoot);
  const files = await collectSourceFiles(absoluteRoot);
  for (const file of files) {
    const content = await readFile(file, "utf8");
    for (const detector of forbiddenSourcePatterns) {
      if (detector.pattern.test(content)) {
        violations.push(`${relative(root, file)}: ${detector.label}`);
      }
    }
  }
}

for (const packageRoot of workspacePackageRoots) {
  const manifestPath = join(root, packageRoot, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const runtimeDependencies = {
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies
  };

  for (const [name, specifier] of Object.entries(runtimeDependencies)) {
    if (!name.startsWith("@npdplus/promptdiff-") || !String(specifier).startsWith("workspace:")) {
      violations.push(`${relative(root, manifestPath)}: external runtime dependency ${name}`);
    }
  }

  for (const scriptName of Object.keys(manifest.scripts ?? {})) {
    if (lifecycleScripts.has(scriptName)) {
      violations.push(`${relative(root, manifestPath)}: lifecycle script ${scriptName}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Runtime/offline boundary verification failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Runtime/offline boundary verification passed for ${productSourceRoots.length} source roots and ${workspacePackageRoots.length} workspace packages.`
  );
}

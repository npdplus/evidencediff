import console from "node:console";
import { spawnSync } from "node:child_process";
import process from "node:process";

const root = process.cwd();
const detectors = [
  ["private-key", "-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----"],
  ["github-token", "gh[pousr]_[A-Za-z0-9]{30,}"],
  ["openai-style-key", "sk-[A-Za-z0-9]{20,}"],
  ["google-api-key", "AIza[0-9A-Za-z_-]{35}"],
  ["aws-access-key", "AKIA[0-9A-Z]{16}"],
  ["slack-token", "xox[baprs]-[0-9A-Za-z-]{10,}"],
  ["live-secret-key", "[sr]k_live_[0-9A-Za-z]{16,}"],
  ["jwt", "eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}"],
  ["azure-account-key", "AccountKey=[A-Za-z0-9+/]{40,}={0,2}"],
  [
    "credentialed-database-url",
    "(mongodb(\\+srv)?|postgres(ql)?|mysql)://[^[:space:]/]+:[^[:space:]@]+@"
  ]
];
const riskyFilenamePattern =
  /(^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|id_rsa|id_ed25519|credentials?\.json|secrets?\.json)$|\.(?:pem|key|p12|pfx)$/i;

function runGit(args, allowedStatuses = new Set([0])) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (!allowedStatuses.has(result.status ?? -1)) {
    throw new Error(`git ${args[0]} failed with exit code ${result.status ?? "unknown"}`);
  }
  return result;
}

const commits = runGit(["rev-list", "--all"])
  .stdout.split(/\r?\n/)
  .map((value) => value.trim())
  .filter(Boolean);

if (commits.length === 0) {
  throw new Error("Repository history is unavailable for secret scanning.");
}

const findings = new Map();

for (const commit of commits) {
  for (const [label, pattern] of detectors) {
    const result = runGit(
      ["grep", "-I", "-l", "-E", "-e", pattern, commit, "--", "."],
      new Set([0, 1])
    );
    if (result.status !== 0) {
      continue;
    }
    for (const line of result.stdout.split(/\r?\n/).filter(Boolean)) {
      const prefix = `${commit}:`;
      const path = line.startsWith(prefix) ? line.slice(prefix.length) : line;
      findings.set(`${label}:${commit}:${path}`, { label, commit, path });
    }
  }

  const filenames = runGit(["ls-tree", "-r", "--name-only", commit])
    .stdout.split(/\r?\n/)
    .filter(Boolean);
  for (const path of filenames) {
    if (path === ".env.example") {
      continue;
    }
    if (riskyFilenamePattern.test(path)) {
      findings.set(`risky-filename:${commit}:${path}`, {
        label: "risky-filename",
        commit,
        path
      });
    }
  }
}

if (findings.size > 0) {
  console.error("Repository-history secret scan found potential secret material.");
  console.error("Matched values are intentionally omitted from output.");
  for (const finding of findings.values()) {
    console.error(`- ${finding.label}: ${finding.commit.slice(0, 12)}:${finding.path}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Repository-history secret scan passed across ${commits.length} commits with ${detectors.length} high-confidence content detectors.`
  );
}

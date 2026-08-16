import type {
  CheckResult,
  Difference,
  Evidence,
  EvidenceInputIdentity,
  Improvement,
  MetricComparison,
  Regression
} from "@npdplus/evidencediff-contracts";

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

function canonicalize(value: unknown): CanonicalValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item) ?? null);
  }
  if (typeof value === "object") {
    const result: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(value).sort()) {
      const normalized = canonicalize((value as Record<string, unknown>)[key]);
      if (normalized !== undefined) {
        result[key] = normalized;
      }
    }
    return result;
  }
  throw new TypeError("Evidence contains a non-JSON-serializable value.");
}

function canonicalEvidenceObject(evidence: Evidence): Record<string, CanonicalValue> {
  const entries: readonly (readonly [string, unknown])[] = [
    ["formatVersion", evidence.formatVersion],
    ["toolVersion", evidence.toolVersion],
    ["id", evidence.id],
    ["generatedAt", evidence.generatedAt],
    ...(evidence.test !== undefined ? ([["test", evidence.test]] as const) : []),
    ["baseline", evidence.baseline],
    ["candidate", evidence.candidate],
    ["differences", evidence.differences],
    ["checkResults", evidence.checkResults],
    ["regressions", evidence.regressions],
    ...(evidence.improvements !== undefined
      ? ([["improvements", evidence.improvements]] as const)
      : []),
    ...(evidence.metrics !== undefined ? ([["metrics", evidence.metrics]] as const) : []),
    ["verdict", evidence.verdict],
    ["reviewRequired", evidence.reviewRequired],
    ...(evidence.reviewReason !== undefined
      ? ([["reviewReason", evidence.reviewReason]] as const)
      : [])
  ];

  const result: Record<string, CanonicalValue> = {};
  for (const [key, value] of entries) {
    const normalized = canonicalize(value);
    if (normalized !== undefined) {
      result[key] = normalized;
    }
  }
  return result;
}

export function renderEvidenceJson(evidence: Evidence): string {
  return `${JSON.stringify(canonicalEvidenceObject(evidence), null, 2)}\n`;
}

function oneLine(value: string): string {
  return value.replaceAll("\r", "\\r").replaceAll("\n", "\\n");
}

function markdownText(value: string): string {
  return oneLine(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

function inputMetadata(input: EvidenceInputIdentity, render: (value: string) => string): string {
  const fields = [
    `path=${render(input.path)}`,
    `contentType=${input.contentType}`,
    ...(input.label !== undefined ? [`label=${render(input.label)}`] : []),
    ...(input.model !== undefined ? [`model=${render(input.model)}`] : []),
    ...(input.promptVersion !== undefined ? [`promptVersion=${render(input.promptVersion)}`] : []),
    ...(input.build !== undefined ? [`build=${render(input.build)}`] : []),
    ...(input.tokens !== undefined ? [`tokens=${input.tokens}`] : []),
    ...(input.latencyMs !== undefined ? [`latencyMs=${input.latencyMs}`] : [])
  ];
  return fields.join(", ");
}

function differenceSummary(difference: Difference, render: (value: string) => string): string {
  return difference.domain === "json"
    ? `${difference.domain}/${difference.kind} at ${render(difference.path === "" ? "<root>" : difference.path)}`
    : `${difference.domain}/${difference.kind}`;
}

function checkSummary(result: CheckResult, render: (value: string) => string): string {
  const id =
    result.checkId === undefined ? result.checkType : `${result.checkId} (${result.checkType})`;
  const baseline = result.baselineStatus === undefined ? "N/A" : result.baselineStatus;
  return `${render(id)}: ${baseline} -> ${result.candidateStatus}; ${render(result.explanation)}`;
}

function transitionSummary(
  transition: Regression | Improvement,
  render: (value: string) => string
): string {
  const id =
    transition.checkId === undefined
      ? transition.checkType
      : `${transition.checkId} (${transition.checkType})`;
  return `${render(id)}: ${transition.baselineStatus} -> ${transition.candidateStatus}; ${render(transition.explanation)}`;
}

function metricSummary(metric: MetricComparison): string {
  return [
    ...(metric.baseline !== undefined ? [`baseline=${metric.baseline}`] : []),
    ...(metric.candidate !== undefined ? [`candidate=${metric.candidate}`] : []),
    ...(metric.delta !== undefined ? [`delta=${metric.delta}`] : [])
  ].join(", ");
}

export function renderEvidenceMarkdown(evidence: Evidence): string {
  const lines = [
    "# EvidenceDiff Evidence",
    "",
    `- Verdict: **${evidence.verdict}**`,
    `- Review required: **${evidence.reviewRequired ? "yes" : "no"}**`,
    `- Evidence ID: ${markdownText(evidence.id)}`,
    `- Generated at: ${markdownText(evidence.generatedAt)}`,
    `- Tool version: ${markdownText(evidence.toolVersion)}`
  ];

  if (evidence.test !== undefined) {
    lines.push(`- Test: ${markdownText(evidence.test.id)} — ${markdownText(evidence.test.name)}`);
  }
  if (evidence.reviewReason !== undefined) {
    lines.push(`- Review reason: ${markdownText(evidence.reviewReason)}`);
  }

  lines.push(
    "",
    "## Inputs",
    "",
    `- Baseline: ${inputMetadata(evidence.baseline, markdownText)}`,
    `- Candidate: ${inputMetadata(evidence.candidate, markdownText)}`,
    "",
    `## Differences (${evidence.differences.length})`,
    ""
  );
  lines.push(
    ...(evidence.differences.length === 0
      ? ["- None"]
      : evidence.differences.map(
          (difference) => `- ${differenceSummary(difference, markdownText)}`
        ))
  );

  lines.push("", `## Checks (${evidence.checkResults.length})`, "");
  lines.push(
    ...(evidence.checkResults.length === 0
      ? ["- None"]
      : evidence.checkResults.map((result) => `- ${checkSummary(result, markdownText)}`))
  );

  lines.push("", `## Regressions (${evidence.regressions.length})`, "");
  lines.push(
    ...(evidence.regressions.length === 0
      ? ["- None"]
      : evidence.regressions.map((item) => `- ${transitionSummary(item, markdownText)}`))
  );

  const improvements = evidence.improvements ?? [];
  lines.push("", `## Improvements (${improvements.length})`, "");
  lines.push(
    ...(improvements.length === 0
      ? ["- None"]
      : improvements.map((item) => `- ${transitionSummary(item, markdownText)}`))
  );

  if (evidence.metrics !== undefined) {
    lines.push("", "## Metrics", "");
    if (evidence.metrics.tokens !== undefined) {
      lines.push(`- Tokens: ${metricSummary(evidence.metrics.tokens)}`);
    }
    if (evidence.metrics.latencyMs !== undefined) {
      lines.push(`- Latency ms: ${metricSummary(evidence.metrics.latencyMs)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function renderEvidenceConsole(evidence: Evidence): string {
  const lines = [
    `EvidenceDiff ${evidence.verdict}`,
    `Evidence: ${oneLine(evidence.id)}`,
    `Generated: ${oneLine(evidence.generatedAt)}`,
    `Tool: ${oneLine(evidence.toolVersion)}`,
    `Review required: ${evidence.reviewRequired ? "yes" : "no"}`
  ];

  if (evidence.test !== undefined) {
    lines.push(`Test: ${oneLine(evidence.test.id)} - ${oneLine(evidence.test.name)}`);
  }
  if (evidence.reviewReason !== undefined) {
    lines.push(`Review reason: ${oneLine(evidence.reviewReason)}`);
  }

  lines.push(
    `Baseline: ${inputMetadata(evidence.baseline, oneLine)}`,
    `Candidate: ${inputMetadata(evidence.candidate, oneLine)}`,
    `Differences: ${evidence.differences.length}`
  );
  for (const difference of evidence.differences) {
    lines.push(`  - ${differenceSummary(difference, oneLine)}`);
  }

  lines.push(`Checks: ${evidence.checkResults.length}`);
  for (const result of evidence.checkResults) {
    lines.push(`  - ${checkSummary(result, oneLine)}`);
  }

  lines.push(`Regressions: ${evidence.regressions.length}`);
  for (const regression of evidence.regressions) {
    lines.push(`  - ${transitionSummary(regression, oneLine)}`);
  }

  const improvements = evidence.improvements ?? [];
  lines.push(`Improvements: ${improvements.length}`);
  for (const improvement of improvements) {
    lines.push(`  - ${transitionSummary(improvement, oneLine)}`);
  }

  if (evidence.metrics?.tokens !== undefined) {
    lines.push(`Tokens: ${metricSummary(evidence.metrics.tokens)}`);
  }
  if (evidence.metrics?.latencyMs !== undefined) {
    lines.push(`Latency ms: ${metricSummary(evidence.metrics.latencyMs)}`);
  }

  return `${lines.join("\n")}\n`;
}

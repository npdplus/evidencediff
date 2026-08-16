import { randomUUID } from "node:crypto";

import type {
  Baseline,
  Candidate,
  CheckResult,
  Difference,
  Evidence,
  EvidenceInputIdentity,
  EvidenceTestContext
} from "@npdplus/evidencediff-contracts";

import type { RegressionVerdictSummary } from "./regression-verdict.js";

export interface EvidenceAssemblyInput {
  readonly toolVersion: string;
  readonly baseline: Baseline;
  readonly candidate: Candidate;
  readonly differences: readonly Difference[];
  readonly checkResults: readonly CheckResult[];
  readonly regressionVerdict: RegressionVerdictSummary;
  readonly test?: EvidenceTestContext;
}

function toEvidenceInputIdentity(input: Baseline | Candidate): EvidenceInputIdentity {
  return {
    path: input.path,
    contentType: input.contentType,
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.promptVersion !== undefined ? { promptVersion: input.promptVersion } : {}),
    ...(input.build !== undefined ? { build: input.build } : {}),
    ...(input.tokens !== undefined ? { tokens: input.tokens } : {}),
    ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {})
  };
}

export function assembleEvidence(input: EvidenceAssemblyInput): Evidence {
  const summary = input.regressionVerdict;
  const improvements = [...summary.improvements];

  return {
    formatVersion: 1,
    toolVersion: input.toolVersion,
    id: randomUUID(),
    generatedAt: new Date().toISOString(),
    ...(input.test !== undefined ? { test: { ...input.test } } : {}),
    baseline: toEvidenceInputIdentity(input.baseline),
    candidate: toEvidenceInputIdentity(input.candidate),
    differences: [...input.differences],
    checkResults: [...input.checkResults],
    regressions: [...summary.regressions],
    ...(improvements.length > 0 ? { improvements } : {}),
    ...(summary.metrics !== undefined ? { metrics: summary.metrics } : {}),
    verdict: summary.verdict,
    reviewRequired: summary.reviewRequired,
    ...(summary.reviewReason !== undefined ? { reviewReason: summary.reviewReason } : {})
  };
}

import type {
  CheckResult,
  EvidenceMetrics,
  Improvement,
  InputMetadata,
  MetricComparison,
  Regression,
  Verdict
} from "@npdplus/evidencediff-contracts";

type MetricMetadata = Pick<InputMetadata, "tokens" | "latencyMs">;

export interface CheckTransitionSummary {
  readonly regressions: readonly Regression[];
  readonly improvements: readonly Improvement[];
  readonly unchangedFailures: readonly CheckResult[];
  readonly candidateFailures: readonly CheckResult[];
}

export interface RegressionVerdictOptions {
  readonly reviewRequired?: boolean;
  readonly baselineMetrics?: MetricMetadata;
  readonly candidateMetrics?: MetricMetadata;
}

export interface RegressionVerdictSummary extends CheckTransitionSummary {
  readonly metrics?: EvidenceMetrics;
  readonly verdict: Verdict;
  readonly reviewRequired: boolean;
  readonly reviewReason?: string;
}

export function classifyCheckResults(checkResults: readonly CheckResult[]): CheckTransitionSummary {
  const regressions: Regression[] = [];
  const improvements: Improvement[] = [];
  const unchangedFailures: CheckResult[] = [];
  const candidateFailures: CheckResult[] = [];

  for (const result of checkResults) {
    if (result.candidateStatus === "FAIL") {
      candidateFailures.push(result);
    }

    if (result.baselineStatus === "PASS" && result.candidateStatus === "FAIL") {
      regressions.push({
        kind: "REGRESSION",
        ...(result.checkId !== undefined ? { checkId: result.checkId } : {}),
        checkType: result.checkType,
        baselineStatus: "PASS",
        candidateStatus: "FAIL",
        explanation: result.explanation
      });
      continue;
    }

    if (result.baselineStatus === "FAIL" && result.candidateStatus === "PASS") {
      improvements.push({
        kind: "IMPROVEMENT",
        ...(result.checkId !== undefined ? { checkId: result.checkId } : {}),
        checkType: result.checkType,
        baselineStatus: "FAIL",
        candidateStatus: "PASS",
        explanation: result.explanation
      });
      continue;
    }

    if (result.baselineStatus === "FAIL" && result.candidateStatus === "FAIL") {
      unchangedFailures.push(result);
    }
  }

  return { regressions, improvements, unchangedFailures, candidateFailures };
}

function compareMetric(
  baseline: number | undefined,
  candidate: number | undefined
): MetricComparison | undefined {
  if (baseline === undefined && candidate === undefined) {
    return undefined;
  }

  return {
    ...(baseline !== undefined ? { baseline } : {}),
    ...(candidate !== undefined ? { candidate } : {}),
    ...(baseline !== undefined && candidate !== undefined ? { delta: candidate - baseline } : {})
  };
}

export function compareMetrics(
  baseline: MetricMetadata = {},
  candidate: MetricMetadata = {}
): EvidenceMetrics | undefined {
  const tokens = compareMetric(baseline.tokens, candidate.tokens);
  const latencyMs = compareMetric(baseline.latencyMs, candidate.latencyMs);

  if (tokens === undefined && latencyMs === undefined) {
    return undefined;
  }

  return {
    ...(tokens !== undefined ? { tokens } : {}),
    ...(latencyMs !== undefined ? { latencyMs } : {})
  };
}

function reviewReason(reviewRequired: boolean, noChecks: boolean): string | undefined {
  if (reviewRequired) {
    return "Test definition requires human review.";
  }
  if (noChecks) {
    return "No deterministic acceptance checks were provided.";
  }
  return undefined;
}

export function aggregateRegressionVerdict(
  checkResults: readonly CheckResult[],
  options: RegressionVerdictOptions = {}
): RegressionVerdictSummary {
  const transitions = classifyCheckResults(checkResults);
  const noChecks = checkResults.length === 0;
  const explicitReviewRequired = options.reviewRequired === true;
  const effectiveReviewRequired = explicitReviewRequired || noChecks;

  const verdict: Verdict =
    transitions.candidateFailures.length > 0 ? "FAIL" : effectiveReviewRequired ? "REVIEW" : "PASS";

  const metrics = compareMetrics(options.baselineMetrics, options.candidateMetrics);
  const reason = reviewReason(explicitReviewRequired, noChecks);

  return {
    ...transitions,
    ...(metrics !== undefined ? { metrics } : {}),
    verdict,
    reviewRequired: effectiveReviewRequired,
    ...(reason !== undefined ? { reviewReason: reason } : {})
  };
}

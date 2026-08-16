export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

export const TEST_DEFINITION_FORMAT_VERSION = 1 as const;
export type TestDefinitionFormatVersion = typeof TEST_DEFINITION_FORMAT_VERSION;

export const EVIDENCE_FORMAT_VERSION = 1 as const;
export type EvidenceFormatVersion = typeof EVIDENCE_FORMAT_VERSION;

export const CONTENT_TYPES = ["text", "json", "auto"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export type ResolvedContentType = Exclude<ContentType, "auto">;

export interface InputMetadata {
  readonly model?: string;
  readonly promptVersion?: string;
  readonly build?: string;
  readonly tokens?: number;
  readonly latencyMs?: number;
}

export interface TestInputDescriptor extends InputMetadata {
  readonly path: string;
  readonly contentType: ContentType;
  readonly label?: string;
}

export interface TextInputContent {
  readonly contentType: "text";
  readonly value: string;
}

export interface JsonInputContent {
  readonly contentType: "json";
  readonly value: JsonValue;
}

export type InputContent = TextInputContent | JsonInputContent;

interface RuntimeInputBase extends InputMetadata {
  readonly path: string;
  readonly label?: string;
}

export type Baseline = RuntimeInputBase &
  InputContent & {
    readonly role: "baseline";
  };

export type Candidate = RuntimeInputBase &
  InputContent & {
    readonly role: "candidate";
  };

export const CHECK_TYPES = [
  "json-valid",
  "required-field",
  "field-type",
  "exact",
  "contains",
  "not-contains",
  "regex",
  "numeric-range",
  "allowed-values",
  "output-length",
  "token-budget",
  "latency-budget"
] as const;

export type CheckType = (typeof CHECK_TYPES)[number];

declare const jsonPointerBrand: unique symbol;
export type JsonPointer = string & { readonly [jsonPointerBrand]: true };

export const EXPECTED_JSON_TYPES = [
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "null"
] as const;
export type ExpectedJsonType = (typeof EXPECTED_JSON_TYPES)[number];

interface CheckBase<TType extends CheckType> {
  readonly id?: string;
  readonly type: TType;
  readonly description?: string;
}

export type JsonValidCheck = CheckBase<"json-valid">;

export interface RequiredFieldCheck extends CheckBase<"required-field"> {
  readonly target: JsonPointer;
}

export interface FieldTypeCheck extends CheckBase<"field-type"> {
  readonly target: JsonPointer;
  readonly expectedType: ExpectedJsonType;
}

export interface ExactCheck extends CheckBase<"exact"> {
  readonly target?: JsonPointer;
  readonly expected: JsonValue;
}

export interface ContainsCheck extends CheckBase<"contains"> {
  readonly target?: JsonPointer;
  readonly value: string;
}

export interface NotContainsCheck extends CheckBase<"not-contains"> {
  readonly target?: JsonPointer;
  readonly value: string;
}

export interface RegexCheck extends CheckBase<"regex"> {
  readonly target?: JsonPointer;
  readonly pattern: string;
}

export interface NumericRangeCheck extends CheckBase<"numeric-range"> {
  readonly target?: JsonPointer;
  readonly min?: number;
  readonly max?: number;
}

export interface AllowedValuesCheck extends CheckBase<"allowed-values"> {
  readonly target?: JsonPointer;
  readonly values: readonly JsonValue[];
}

export interface OutputLengthCheck extends CheckBase<"output-length"> {
  readonly target?: JsonPointer;
  readonly min?: number;
  readonly max?: number;
}

export interface TokenBudgetCheck extends CheckBase<"token-budget"> {
  readonly maxTokens: number;
}

export interface LatencyBudgetCheck extends CheckBase<"latency-budget"> {
  readonly maxLatencyMs: number;
}

export type Check =
  | JsonValidCheck
  | RequiredFieldCheck
  | FieldTypeCheck
  | ExactCheck
  | ContainsCheck
  | NotContainsCheck
  | RegexCheck
  | NumericRangeCheck
  | AllowedValuesCheck
  | OutputLengthCheck
  | TokenBudgetCheck
  | LatencyBudgetCheck;

export function isJsonPointer(value: string): boolean {
  if (value === "") {
    return true;
  }

  if (!value.startsWith("/")) {
    return false;
  }

  for (const token of value.slice(1).split("/")) {
    for (let index = 0; index < token.length; index += 1) {
      if (token[index] !== "~") {
        continue;
      }

      const escaped = token[index + 1];
      if (escaped !== "0" && escaped !== "1") {
        return false;
      }
      index += 1;
    }
  }

  return true;
}

export function parseJsonPointer(value: string): JsonPointer {
  if (!isJsonPointer(value)) {
    throw new TypeError("Invalid RFC 6901 JSON Pointer.");
  }

  return value as JsonPointer;
}

export const CHECK_STATUSES = ["PASS", "FAIL"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export interface CheckResult {
  readonly checkId?: string;
  readonly checkType: CheckType;
  readonly baselineStatus?: CheckStatus;
  readonly candidateStatus: CheckStatus;
  readonly expected?: JsonValue;
  readonly actual?: JsonValue;
  readonly explanation: string;
  readonly details?: JsonObject;
}

export const TEXT_DIFFERENCE_KINDS = ["inserted", "removed", "changed"] as const;
export type TextDifferenceKind = (typeof TEXT_DIFFERENCE_KINDS)[number];

export const JSON_DIFFERENCE_KINDS = [
  "added",
  "removed",
  "value-changed",
  "type-changed",
  "array-changed"
] as const;
export type JsonDifferenceKind = (typeof JSON_DIFFERENCE_KINDS)[number];

export interface TextDifference {
  readonly domain: "text";
  readonly kind: TextDifferenceKind;
  readonly baseline?: string;
  readonly candidate?: string;
}

export interface JsonDifference {
  readonly domain: "json";
  readonly kind: JsonDifferenceKind;
  readonly path: JsonPointer;
  readonly baseline?: JsonValue;
  readonly candidate?: JsonValue;
  readonly baselineType?: string;
  readonly candidateType?: string;
}

export type Difference = TextDifference | JsonDifference;

export interface Regression {
  readonly kind: "REGRESSION";
  readonly checkId?: string;
  readonly checkType: CheckType;
  readonly baselineStatus: "PASS";
  readonly candidateStatus: "FAIL";
  readonly explanation: string;
}

export interface Improvement {
  readonly kind: "IMPROVEMENT";
  readonly checkId?: string;
  readonly checkType: CheckType;
  readonly baselineStatus: "FAIL";
  readonly candidateStatus: "PASS";
  readonly explanation: string;
}

export const VERDICTS = ["PASS", "FAIL", "REVIEW"] as const;
export type Verdict = (typeof VERDICTS)[number];

export interface MetricComparison {
  readonly baseline?: number;
  readonly candidate?: number;
  readonly delta?: number;
}

export interface EvidenceMetrics {
  readonly tokens?: MetricComparison;
  readonly latencyMs?: MetricComparison;
}

export interface EvidenceInputIdentity extends InputMetadata {
  readonly path: string;
  readonly contentType: ResolvedContentType;
  readonly label?: string;
}

export interface EvidenceTestContext {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

export interface Evidence {
  readonly formatVersion: EvidenceFormatVersion;
  readonly toolVersion: string;
  readonly id: string;
  readonly generatedAt: string;
  readonly test?: EvidenceTestContext;
  readonly baseline: EvidenceInputIdentity;
  readonly candidate: EvidenceInputIdentity;
  readonly differences: readonly Difference[];
  readonly checkResults: readonly CheckResult[];
  readonly regressions: readonly Regression[];
  readonly improvements?: readonly Improvement[];
  readonly metrics?: EvidenceMetrics;
  readonly verdict: Verdict;
  readonly reviewRequired: boolean;
  readonly reviewReason?: string;
}

export interface TestDefinition {
  readonly version: TestDefinitionFormatVersion;
  readonly id: string;
  readonly name: string;
  readonly baseline: TestInputDescriptor;
  readonly candidate: TestInputDescriptor;
  readonly checks: readonly Check[];
  readonly description?: string;
  readonly reviewRequired?: boolean;
}

export interface Run {
  readonly definition: TestDefinition;
  readonly baseline: Baseline;
  readonly candidate: Candidate;
}

export type CheckEvaluationStatus = "PASS" | "FAIL";

export type CheckEvaluationJsonPrimitive = string | number | boolean | null;
export interface CheckEvaluationJsonObject {
  readonly [key: string]: CheckEvaluationJsonValue;
}
export type CheckEvaluationJsonValue =
  | CheckEvaluationJsonPrimitive
  | CheckEvaluationJsonObject
  | readonly CheckEvaluationJsonValue[];

export type DeterministicCheckType =
  | "json-valid"
  | "required-field"
  | "field-type"
  | "exact"
  | "contains"
  | "not-contains"
  | "regex"
  | "numeric-range"
  | "allowed-values"
  | "output-length"
  | "token-budget"
  | "latency-budget";

export type CheckEvaluationInput =
  | {
      readonly contentType: "text";
      readonly value: string;
      readonly tokens?: number;
      readonly latencyMs?: number;
    }
  | {
      readonly contentType: "json";
      readonly value: CheckEvaluationJsonValue;
      readonly tokens?: number;
      readonly latencyMs?: number;
    };

export interface DeterministicCheckResult {
  readonly checkId?: string;
  readonly checkType: DeterministicCheckType;
  readonly baselineStatus: CheckEvaluationStatus;
  readonly candidateStatus: CheckEvaluationStatus;
  readonly expected?: CheckEvaluationJsonValue;
  readonly actual?: CheckEvaluationJsonValue;
  readonly explanation: string;
  readonly details?: CheckEvaluationJsonObject;
}

export type CheckEvaluationErrorCode = "invalid-check-configuration" | "evaluation-unavailable";

export class CheckEvaluationError extends Error {
  readonly code: CheckEvaluationErrorCode;
  readonly checkType: string | undefined;

  constructor(code: CheckEvaluationErrorCode, message: string, checkType?: string) {
    super(message);
    this.name = "CheckEvaluationError";
    this.code = code;
    this.checkType = checkType;
  }
}

type UnknownRecord = Record<string, unknown>;
type ExpectedJsonType = "string" | "number" | "boolean" | "object" | "array" | "null";

interface CheckCommon {
  readonly id?: string;
  readonly description?: string;
}

type NormalizedCheck =
  | (CheckCommon & { readonly type: "json-valid" })
  | (CheckCommon & { readonly type: "required-field"; readonly target: string })
  | (CheckCommon & {
      readonly type: "field-type";
      readonly target: string;
      readonly expectedType: ExpectedJsonType;
    })
  | (CheckCommon & {
      readonly type: "exact";
      readonly target?: string;
      readonly expected: CheckEvaluationJsonValue;
    })
  | (CheckCommon & { readonly type: "contains"; readonly target?: string; readonly value: string })
  | (CheckCommon & {
      readonly type: "not-contains";
      readonly target?: string;
      readonly value: string;
    })
  | (CheckCommon & { readonly type: "regex"; readonly target?: string; readonly pattern: string })
  | (CheckCommon & {
      readonly type: "numeric-range";
      readonly target?: string;
      readonly min?: number;
      readonly max?: number;
    })
  | (CheckCommon & {
      readonly type: "allowed-values";
      readonly target?: string;
      readonly values: readonly CheckEvaluationJsonValue[];
    })
  | (CheckCommon & {
      readonly type: "output-length";
      readonly target?: string;
      readonly min?: number;
      readonly max?: number;
    })
  | (CheckCommon & { readonly type: "token-budget"; readonly maxTokens: number })
  | (CheckCommon & { readonly type: "latency-budget"; readonly maxLatencyMs: number });

interface SingleEvaluation {
  readonly status: CheckEvaluationStatus;
  readonly explanation: string;
  readonly actual?: CheckEvaluationJsonValue;
}

interface ResolvedTarget {
  readonly found: boolean;
  readonly value?: CheckEvaluationJsonValue;
}

const checkTypes = new Set<DeterministicCheckType>([
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
]);

const expectedJsonTypes = new Set<ExpectedJsonType>([
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "null"
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isJsonValue(value: unknown): value is CheckEvaluationJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (!isRecord(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  return Object.values(value).every(isJsonValue);
}

function isJsonPointer(value: string): boolean {
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

function failConfiguration(message: string, checkType?: string): never {
  throw new CheckEvaluationError("invalid-check-configuration", message, checkType);
}

function readOptionalCommon(record: UnknownRecord, type: DeterministicCheckType): CheckCommon {
  const id = record.id;
  if (id !== undefined && (typeof id !== "string" || id.length === 0)) {
    failConfiguration("check.id must be a non-empty string when provided", type);
  }
  const description = record.description;
  if (description !== undefined && typeof description !== "string") {
    failConfiguration("check.description must be a string when provided", type);
  }
  return {
    ...(typeof id === "string" ? { id } : {}),
    ...(typeof description === "string" ? { description } : {})
  };
}

function rejectUnknownFields(
  record: UnknownRecord,
  allowed: readonly string[],
  type: DeterministicCheckType
): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(record).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) {
    failConfiguration(`unknown field(s) for ${type}: ${unknown.sort().join(", ")}`, type);
  }
}

function readTarget(
  record: UnknownRecord,
  type: DeterministicCheckType,
  required: boolean
): string | undefined {
  if (!hasOwn(record, "target")) {
    if (required) {
      failConfiguration(`${type} requires target`, type);
    }
    return undefined;
  }
  if (typeof record.target !== "string" || !isJsonPointer(record.target)) {
    failConfiguration(`${type}.target must be a valid RFC 6901 JSON Pointer`, type);
  }
  return record.target;
}

function readFiniteNumber(
  record: UnknownRecord,
  field: string,
  type: DeterministicCheckType,
  options: {
    readonly required: boolean;
    readonly integer?: boolean;
    readonly nonNegative?: boolean;
  }
): number | undefined {
  if (!hasOwn(record, field)) {
    if (options.required) {
      failConfiguration(`${type} requires ${field}`, type);
    }
    return undefined;
  }
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    failConfiguration(`${type}.${field} must be a finite number`, type);
  }
  if (options.integer === true && !Number.isInteger(value)) {
    failConfiguration(`${type}.${field} must be an integer`, type);
  }
  if (options.nonNegative === true && value < 0) {
    failConfiguration(`${type}.${field} must be non-negative`, type);
  }
  return value;
}

function normalizeCheck(input: unknown): NormalizedCheck {
  if (!isRecord(input)) {
    failConfiguration("check must be an object");
  }
  if (typeof input.type !== "string" || !checkTypes.has(input.type as DeterministicCheckType)) {
    failConfiguration("check.type must be a supported V0.1 deterministic check type");
  }

  const type = input.type as DeterministicCheckType;
  const common = readOptionalCommon(input, type);
  const commonFields = ["id", "type", "description"] as const;

  switch (type) {
    case "json-valid":
      rejectUnknownFields(input, commonFields, type);
      return { ...common, type };

    case "required-field": {
      rejectUnknownFields(input, [...commonFields, "target"], type);
      const target = readTarget(input, type, true);
      if (target === undefined) {
        failConfiguration(`${type} requires target`, type);
      }
      return { ...common, type, target };
    }

    case "field-type": {
      rejectUnknownFields(input, [...commonFields, "target", "expectedType"], type);
      const target = readTarget(input, type, true);
      if (target === undefined) {
        failConfiguration(`${type} requires target`, type);
      }
      if (
        typeof input.expectedType !== "string" ||
        !expectedJsonTypes.has(input.expectedType as ExpectedJsonType)
      ) {
        failConfiguration(
          "field-type.expectedType must be one of string, number, boolean, object, array, null",
          type
        );
      }
      return { ...common, type, target, expectedType: input.expectedType as ExpectedJsonType };
    }

    case "exact": {
      rejectUnknownFields(input, [...commonFields, "target", "expected"], type);
      const target = readTarget(input, type, false);
      if (!hasOwn(input, "expected") || !isJsonValue(input.expected)) {
        failConfiguration("exact.expected must be a JSON-compatible value", type);
      }
      return {
        ...common,
        type,
        ...(target !== undefined ? { target } : {}),
        expected: input.expected
      };
    }

    case "contains":
    case "not-contains": {
      rejectUnknownFields(input, [...commonFields, "target", "value"], type);
      const target = readTarget(input, type, false);
      if (typeof input.value !== "string") {
        failConfiguration(`${type}.value must be a string`, type);
      }
      return {
        ...common,
        type,
        ...(target !== undefined ? { target } : {}),
        value: input.value
      };
    }

    case "regex": {
      rejectUnknownFields(input, [...commonFields, "target", "pattern"], type);
      const target = readTarget(input, type, false);
      if (typeof input.pattern !== "string" || input.pattern.length === 0) {
        failConfiguration("regex.pattern must be a non-empty string", type);
      }
      try {
        RegExp(input.pattern);
      } catch {
        failConfiguration("regex.pattern must contain valid regular-expression syntax", type);
      }
      return {
        ...common,
        type,
        ...(target !== undefined ? { target } : {}),
        pattern: input.pattern
      };
    }

    case "numeric-range": {
      rejectUnknownFields(input, [...commonFields, "target", "min", "max"], type);
      const target = readTarget(input, type, false);
      const min = readFiniteNumber(input, "min", type, { required: false });
      const max = readFiniteNumber(input, "max", type, { required: false });
      if (min === undefined && max === undefined) {
        failConfiguration("numeric-range requires min, max, or both", type);
      }
      if (min !== undefined && max !== undefined && min > max) {
        failConfiguration("numeric-range requires min <= max", type);
      }
      return {
        ...common,
        type,
        ...(target !== undefined ? { target } : {}),
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {})
      };
    }

    case "allowed-values": {
      rejectUnknownFields(input, [...commonFields, "target", "values"], type);
      const target = readTarget(input, type, false);
      if (
        !Array.isArray(input.values) ||
        input.values.length === 0 ||
        !input.values.every(isJsonValue)
      ) {
        failConfiguration(
          "allowed-values.values must be a non-empty array of JSON-compatible values",
          type
        );
      }
      return {
        ...common,
        type,
        ...(target !== undefined ? { target } : {}),
        values: input.values
      };
    }

    case "output-length": {
      rejectUnknownFields(input, [...commonFields, "target", "min", "max"], type);
      const target = readTarget(input, type, false);
      const min = readFiniteNumber(input, "min", type, {
        required: false,
        integer: true,
        nonNegative: true
      });
      const max = readFiniteNumber(input, "max", type, {
        required: false,
        integer: true,
        nonNegative: true
      });
      if (min === undefined && max === undefined) {
        failConfiguration("output-length requires min, max, or both", type);
      }
      if (min !== undefined && max !== undefined && min > max) {
        failConfiguration("output-length requires min <= max", type);
      }
      return {
        ...common,
        type,
        ...(target !== undefined ? { target } : {}),
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {})
      };
    }

    case "token-budget": {
      rejectUnknownFields(input, [...commonFields, "maxTokens"], type);
      const maxTokens = readFiniteNumber(input, "maxTokens", type, {
        required: true,
        integer: true,
        nonNegative: true
      });
      if (maxTokens === undefined) {
        failConfiguration("token-budget requires maxTokens", type);
      }
      return { ...common, type, maxTokens };
    }

    case "latency-budget": {
      rejectUnknownFields(input, [...commonFields, "maxLatencyMs"], type);
      const maxLatencyMs = readFiniteNumber(input, "maxLatencyMs", type, {
        required: true,
        nonNegative: true
      });
      if (maxLatencyMs === undefined) {
        failConfiguration("latency-budget requires maxLatencyMs", type);
      }
      return { ...common, type, maxLatencyMs };
    }
  }
}

export function assertValidCheckConfiguration(check: unknown): void {
  normalizeCheck(check);
}

function unescapePointerToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveJsonPointer(root: CheckEvaluationJsonValue, pointer: string): ResolvedTarget {
  if (pointer === "") {
    return { found: true, value: root };
  }

  let current: CheckEvaluationJsonValue = root;
  for (const encodedToken of pointer.slice(1).split("/")) {
    const token = unescapePointerToken(encodedToken);
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(token)) {
        return { found: false };
      }
      const index = Number(token);
      const next = current[index];
      if (next === undefined) {
        return { found: false };
      }
      current = next;
      continue;
    }
    if (!isRecord(current) || !hasOwn(current, token)) {
      return { found: false };
    }
    const next = current[token];
    if (!isJsonValue(next)) {
      return { found: false };
    }
    current = next;
  }
  return { found: true, value: current };
}

function targetValue(
  input: CheckEvaluationInput,
  target: string | undefined,
  checkType: DeterministicCheckType
): ResolvedTarget {
  if (target === undefined) {
    return { found: true, value: input.value };
  }
  if (input.contentType !== "json") {
    throw new CheckEvaluationError(
      "evaluation-unavailable",
      `${checkType} target ${target} requires JSON input`,
      checkType
    );
  }
  return resolveJsonPointer(input.value, target);
}

function jsonType(value: CheckEvaluationJsonValue): ExpectedJsonType {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value as ExpectedJsonType;
}

function deepEqual(left: CheckEvaluationJsonValue, right: CheckEvaluationJsonValue): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((value, index) => {
      const other = right[index];
      return other !== undefined && deepEqual(value, other);
    });
  }
  if (!isRecord(left) || !isRecord(right)) {
    return false;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key, index) => {
    if (key !== rightKeys[index]) {
      return false;
    }
    const leftValue = left[key];
    const rightValue = right[key];
    return isJsonValue(leftValue) && isJsonValue(rightValue) && deepEqual(leftValue, rightValue);
  });
}

function rangeExpectation(
  min: number | undefined,
  max: number | undefined
): CheckEvaluationJsonObject {
  return {
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {})
  };
}

function inRange(value: number, min: number | undefined, max: number | undefined): boolean {
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

function evaluateSingle(check: NormalizedCheck, input: CheckEvaluationInput): SingleEvaluation {
  switch (check.type) {
    case "json-valid": {
      if (input.contentType === "json") {
        return { status: "PASS", actual: true, explanation: "input is valid JSON" };
      }
      try {
        JSON.parse(input.value);
        return { status: "PASS", actual: true, explanation: "text is valid JSON" };
      } catch {
        return { status: "FAIL", actual: false, explanation: "text is not valid JSON" };
      }
    }

    case "required-field": {
      if (input.contentType !== "json") {
        throw new CheckEvaluationError(
          "evaluation-unavailable",
          `required-field target ${check.target} requires JSON input`,
          check.type
        );
      }
      const resolved = resolveJsonPointer(input.value, check.target);
      return resolved.found
        ? { status: "PASS", actual: true, explanation: `required field ${check.target} is present` }
        : {
            status: "FAIL",
            actual: false,
            explanation: `required field ${check.target} is missing`
          };
    }

    case "field-type": {
      if (input.contentType !== "json") {
        throw new CheckEvaluationError(
          "evaluation-unavailable",
          `field-type target ${check.target} requires JSON input`,
          check.type
        );
      }
      const resolved = resolveJsonPointer(input.value, check.target);
      if (!resolved.found || resolved.value === undefined) {
        return { status: "FAIL", explanation: `target ${check.target} is missing` };
      }
      const actualType = jsonType(resolved.value);
      const matches = actualType === check.expectedType;
      return {
        status: matches ? "PASS" : "FAIL",
        actual: actualType,
        explanation: matches
          ? `target ${check.target} has type ${check.expectedType}`
          : `target ${check.target} has type ${actualType}, expected ${check.expectedType}`
      };
    }

    case "exact": {
      const resolved = targetValue(input, check.target, check.type);
      if (!resolved.found || resolved.value === undefined) {
        return { status: "FAIL", explanation: "target is missing" };
      }
      const matches = deepEqual(resolved.value, check.expected);
      return {
        status: matches ? "PASS" : "FAIL",
        actual: resolved.value,
        explanation: matches
          ? "value exactly matches expected value"
          : "value does not exactly match expected value"
      };
    }

    case "contains":
    case "not-contains": {
      const resolved = targetValue(input, check.target, check.type);
      if (!resolved.found || typeof resolved.value !== "string") {
        return {
          status: "FAIL",
          explanation: resolved.found ? "target value is not a string" : "target is missing"
        };
      }
      const contains = resolved.value.includes(check.value);
      const passes = check.type === "contains" ? contains : !contains;
      return {
        status: passes ? "PASS" : "FAIL",
        actual: contains,
        explanation:
          check.type === "contains"
            ? passes
              ? "string contains required value"
              : "string does not contain required value"
            : passes
              ? "string does not contain forbidden value"
              : "string contains forbidden value"
      };
    }

    case "regex": {
      const resolved = targetValue(input, check.target, check.type);
      if (!resolved.found || typeof resolved.value !== "string") {
        return {
          status: "FAIL",
          explanation: resolved.found ? "target value is not a string" : "target is missing"
        };
      }
      const matches = RegExp(check.pattern).test(resolved.value);
      return {
        status: matches ? "PASS" : "FAIL",
        actual: matches,
        explanation: matches
          ? "string matches regular expression"
          : "string does not match regular expression"
      };
    }

    case "numeric-range": {
      const resolved = targetValue(input, check.target, check.type);
      if (!resolved.found || typeof resolved.value !== "number") {
        return {
          status: "FAIL",
          explanation: resolved.found ? "target value is not a number" : "target is missing"
        };
      }
      const passes = inRange(resolved.value, check.min, check.max);
      return {
        status: passes ? "PASS" : "FAIL",
        actual: resolved.value,
        explanation: passes
          ? "number is within the inclusive range"
          : "number is outside the inclusive range"
      };
    }

    case "allowed-values": {
      const resolved = targetValue(input, check.target, check.type);
      if (!resolved.found || resolved.value === undefined) {
        return { status: "FAIL", explanation: "target is missing" };
      }
      const actual = resolved.value;
      const passes = check.values.some((allowed) => deepEqual(allowed, actual));
      return {
        status: passes ? "PASS" : "FAIL",
        actual,
        explanation: passes ? "value is in the allowed set" : "value is not in the allowed set"
      };
    }

    case "output-length": {
      const resolved = targetValue(input, check.target, check.type);
      if (!resolved.found || resolved.value === undefined) {
        return { status: "FAIL", explanation: "target is missing" };
      }
      let length: number;
      if (typeof resolved.value === "string") {
        length = Array.from(resolved.value).length;
      } else if (Array.isArray(resolved.value)) {
        length = resolved.value.length;
      } else {
        return { status: "FAIL", explanation: "target value has no supported output length" };
      }
      const passes = inRange(length, check.min, check.max);
      return {
        status: passes ? "PASS" : "FAIL",
        actual: length,
        explanation: passes
          ? "output length is within the inclusive range"
          : "output length is outside the inclusive range"
      };
    }

    case "token-budget": {
      if (input.tokens === undefined) {
        throw new CheckEvaluationError(
          "evaluation-unavailable",
          "token-budget requires supplied tokens metadata",
          check.type
        );
      }
      const passes = input.tokens <= check.maxTokens;
      return {
        status: passes ? "PASS" : "FAIL",
        actual: input.tokens,
        explanation: passes ? "token count is within budget" : "token count exceeds budget"
      };
    }

    case "latency-budget": {
      if (input.latencyMs === undefined) {
        throw new CheckEvaluationError(
          "evaluation-unavailable",
          "latency-budget requires supplied latencyMs metadata",
          check.type
        );
      }
      const passes = input.latencyMs <= check.maxLatencyMs;
      return {
        status: passes ? "PASS" : "FAIL",
        actual: input.latencyMs,
        explanation: passes ? "latency is within budget" : "latency exceeds budget"
      };
    }
  }
}

function expectedDiagnostic(check: NormalizedCheck): CheckEvaluationJsonValue | undefined {
  switch (check.type) {
    case "json-valid":
    case "required-field":
      return true;
    case "field-type":
      return check.expectedType;
    case "exact":
      return check.expected;
    case "contains":
    case "not-contains":
      return check.value;
    case "regex":
      return check.pattern;
    case "numeric-range":
    case "output-length":
      return rangeExpectation(check.min, check.max);
    case "allowed-values":
      return check.values;
    case "token-budget":
      return check.maxTokens;
    case "latency-budget":
      return check.maxLatencyMs;
  }
}

function resultDetails(
  check: NormalizedCheck,
  baseline: SingleEvaluation
): CheckEvaluationJsonObject {
  const target = "target" in check ? check.target : undefined;
  return {
    ...(target !== undefined ? { target } : {}),
    baselineExplanation: baseline.explanation
  };
}

export function evaluateCheck(
  checkInput: unknown,
  baseline: CheckEvaluationInput,
  candidate: CheckEvaluationInput
): DeterministicCheckResult {
  const check = normalizeCheck(checkInput);
  const baselineEvaluation = evaluateSingle(check, baseline);
  const candidateEvaluation = evaluateSingle(check, candidate);
  const expected = expectedDiagnostic(check);

  return {
    ...(check.id !== undefined ? { checkId: check.id } : {}),
    checkType: check.type,
    baselineStatus: baselineEvaluation.status,
    candidateStatus: candidateEvaluation.status,
    ...(expected !== undefined ? { expected } : {}),
    ...(candidateEvaluation.actual !== undefined ? { actual: candidateEvaluation.actual } : {}),
    explanation: candidateEvaluation.explanation,
    details: resultDetails(check, baselineEvaluation)
  };
}

export function evaluateChecks(
  checks: readonly unknown[],
  baseline: CheckEvaluationInput,
  candidate: CheckEvaluationInput
): readonly DeterministicCheckResult[] {
  return checks.map((check) => evaluateCheck(check, baseline, candidate));
}

import { parseJsonPointer, type JsonPointer } from "./types.js";

export type ValidationIssueCode =
  | "invalid-json"
  | "invalid-type"
  | "missing-field"
  | "unknown-field"
  | "invalid-value"
  | "unsupported-version"
  | "unknown-check"
  | "invalid-json-pointer"
  | "invalid-check-configuration";

export interface ValidationIssue {
  readonly path: string;
  readonly code: ValidationIssueCode;
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] };

export class ContractValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    const first = issues[0];
    super(
      first
        ? `Invalid Test Definition: ${issues.length} issue(s); ${first.path}: ${first.message}`
        : "Invalid Test Definition."
    );
    this.name = "ContractValidationError";
    this.issues = issues;
  }
}

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function addIssue(
  issues: ValidationIssue[],
  path: string,
  code: ValidationIssueCode,
  message: string
): void {
  issues.push({ path, code, message });
}

export function rejectUnknownFields(
  record: UnknownRecord,
  allowedFields: ReadonlySet<string>,
  path: string,
  issues: ValidationIssue[]
): void {
  for (const key of Object.keys(record).sort()) {
    if (!allowedFields.has(key)) {
      addIssue(
        issues,
        `${path}.${key}`,
        "unknown-field",
        "field is not defined by format version 1"
      );
    }
  }
}

export function readRequiredString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[]
): string | undefined {
  if (!hasOwn(record, key)) {
    addIssue(issues, `${path}.${key}`, "missing-field", "required field is missing");
    return undefined;
  }

  const value = record[key];
  if (typeof value !== "string") {
    addIssue(issues, `${path}.${key}`, "invalid-type", "must be a string");
    return undefined;
  }

  return value;
}

export function readRequiredNonEmptyString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[]
): string | undefined {
  const value = readRequiredString(record, key, path, issues);
  if (value !== undefined && value.length === 0) {
    addIssue(issues, `${path}.${key}`, "invalid-value", "must be non-empty");
    return undefined;
  }
  return value;
}

export function readOptionalString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[]
): string | undefined {
  if (!hasOwn(record, key)) {
    return undefined;
  }

  const value = record[key];
  if (typeof value !== "string") {
    addIssue(issues, `${path}.${key}`, "invalid-type", "must be a string when provided");
    return undefined;
  }

  return value;
}

export function readOptionalNonEmptyString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[]
): string | undefined {
  const value = readOptionalString(record, key, path, issues);
  if (value !== undefined && value.length === 0) {
    addIssue(issues, `${path}.${key}`, "invalid-value", "must be non-empty when provided");
    return undefined;
  }
  return value;
}

export function readOptionalBoolean(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[]
): boolean | undefined {
  if (!hasOwn(record, key)) {
    return undefined;
  }

  const value = record[key];
  if (typeof value !== "boolean") {
    addIssue(issues, `${path}.${key}`, "invalid-type", "must be a boolean when provided");
    return undefined;
  }

  return value;
}

export function readFiniteNumber(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
  options: {
    readonly required: boolean;
    readonly integer?: boolean;
    readonly nonNegative?: boolean;
  }
): number | undefined {
  if (!hasOwn(record, key)) {
    if (options.required) {
      addIssue(issues, `${path}.${key}`, "missing-field", "required field is missing");
    }
    return undefined;
  }

  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    addIssue(issues, `${path}.${key}`, "invalid-type", "must be a finite number");
    return undefined;
  }

  if (options.integer && !Number.isInteger(value)) {
    addIssue(issues, `${path}.${key}`, "invalid-value", "must be an integer");
    return undefined;
  }

  if (options.nonNegative && value < 0) {
    addIssue(issues, `${path}.${key}`, "invalid-value", "must be non-negative");
    return undefined;
  }

  return value;
}

export function readTarget(
  record: UnknownRecord,
  path: string,
  issues: ValidationIssue[],
  required: boolean
): JsonPointer | undefined {
  if (!hasOwn(record, "target")) {
    if (required) {
      addIssue(
        issues,
        `${path}.target`,
        "missing-field",
        "required JSON Pointer target is missing"
      );
    }
    return undefined;
  }

  const value = record.target;
  if (typeof value !== "string") {
    addIssue(issues, `${path}.target`, "invalid-type", "must be an RFC 6901 JSON Pointer string");
    return undefined;
  }

  try {
    return parseJsonPointer(value);
  } catch {
    addIssue(
      issues,
      `${path}.target`,
      "invalid-json-pointer",
      "must use valid RFC 6901 JSON Pointer syntax"
    );
    return undefined;
  }
}

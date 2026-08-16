import {
  CHECK_TYPES,
  EXPECTED_JSON_TYPES,
  isJsonValue,
  type Check,
  type CheckType,
  type JsonValue
} from "./types.js";
import {
  addIssue,
  hasOwn,
  isRecord,
  readFiniteNumber,
  readOptionalNonEmptyString,
  readOptionalString,
  readRequiredNonEmptyString,
  readRequiredString,
  readTarget,
  rejectUnknownFields,
  type UnknownRecord,
  type ValidationIssue
} from "./validation-issues.js";

const commonCheckFields = ["id", "type", "description"] as const;

const checkFields: Readonly<Record<CheckType, readonly string[]>> = {
  "json-valid": commonCheckFields,
  "required-field": [...commonCheckFields, "target"],
  "field-type": [...commonCheckFields, "target", "expectedType"],
  exact: [...commonCheckFields, "target", "expected"],
  contains: [...commonCheckFields, "target", "value"],
  "not-contains": [...commonCheckFields, "target", "value"],
  regex: [...commonCheckFields, "target", "pattern"],
  "numeric-range": [...commonCheckFields, "target", "min", "max"],
  "allowed-values": [...commonCheckFields, "target", "values"],
  "output-length": [...commonCheckFields, "target", "min", "max"],
  "token-budget": [...commonCheckFields, "maxTokens"],
  "latency-budget": [...commonCheckFields, "maxLatencyMs"]
};

function isCheckType(value: string): value is CheckType {
  return (CHECK_TYPES as readonly string[]).includes(value);
}

function readCommonCheckFields(
  record: UnknownRecord,
  path: string,
  issues: ValidationIssue[]
): { readonly id?: string; readonly description?: string } {
  const id = readOptionalNonEmptyString(record, "id", path, issues);
  const description = readOptionalString(record, "description", path, issues);
  return {
    ...(id !== undefined ? { id } : {}),
    ...(description !== undefined ? { description } : {})
  };
}

export function parseCheck(
  input: unknown,
  path: string,
  issues: ValidationIssue[]
): Check | undefined {
  if (!isRecord(input)) {
    addIssue(issues, path, "invalid-type", "check must be an object");
    return undefined;
  }

  if (!hasOwn(input, "type")) {
    addIssue(issues, `${path}.type`, "missing-field", "required field is missing");
    return undefined;
  }

  if (typeof input.type !== "string") {
    addIssue(issues, `${path}.type`, "invalid-type", "must be a check type string");
    return undefined;
  }

  if (!isCheckType(input.type)) {
    addIssue(issues, `${path}.type`, "unknown-check", "check type is not supported in V0.1");
    return undefined;
  }

  const type = input.type;
  const initialIssueCount = issues.length;
  rejectUnknownFields(input, new Set(checkFields[type]), path, issues);
  const common = readCommonCheckFields(input, path, issues);

  switch (type) {
    case "json-valid":
      return issues.length === initialIssueCount ? { ...common, type } : undefined;

    case "required-field": {
      const target = readTarget(input, path, issues, true);
      return issues.length === initialIssueCount && target !== undefined
        ? { ...common, type, target }
        : undefined;
    }

    case "field-type": {
      const target = readTarget(input, path, issues, true);
      let expectedType: (typeof EXPECTED_JSON_TYPES)[number] | undefined;
      if (!hasOwn(input, "expectedType")) {
        addIssue(issues, `${path}.expectedType`, "missing-field", "required field is missing");
      } else if (
        typeof input.expectedType !== "string" ||
        !(EXPECTED_JSON_TYPES as readonly string[]).includes(input.expectedType)
      ) {
        addIssue(
          issues,
          `${path}.expectedType`,
          "invalid-value",
          "must be one of string, number, boolean, object, array, null"
        );
      } else {
        expectedType = input.expectedType as (typeof EXPECTED_JSON_TYPES)[number];
      }

      if (
        issues.length !== initialIssueCount ||
        target === undefined ||
        expectedType === undefined
      ) {
        return undefined;
      }
      return { ...common, type, target, expectedType };
    }

    case "exact": {
      const target = readTarget(input, path, issues, false);
      let expected: JsonValue | undefined;
      if (!hasOwn(input, "expected")) {
        addIssue(issues, `${path}.expected`, "missing-field", "required field is missing");
      } else if (!isJsonValue(input.expected)) {
        addIssue(issues, `${path}.expected`, "invalid-type", "must be a JSON-compatible value");
      } else {
        expected = input.expected;
      }

      return issues.length === initialIssueCount && expected !== undefined
        ? { ...common, type, ...(target !== undefined ? { target } : {}), expected }
        : undefined;
    }

    case "contains":
    case "not-contains": {
      const target = readTarget(input, path, issues, false);
      const value = readRequiredString(input, "value", path, issues);
      return issues.length === initialIssueCount && value !== undefined
        ? { ...common, type, ...(target !== undefined ? { target } : {}), value }
        : undefined;
    }

    case "regex": {
      const target = readTarget(input, path, issues, false);
      const pattern = readRequiredNonEmptyString(input, "pattern", path, issues);
      if (pattern !== undefined) {
        try {
          RegExp(pattern);
        } catch {
          addIssue(
            issues,
            `${path}.pattern`,
            "invalid-check-configuration",
            "must be valid regular-expression syntax"
          );
        }
      }

      return issues.length === initialIssueCount && pattern !== undefined
        ? { ...common, type, ...(target !== undefined ? { target } : {}), pattern }
        : undefined;
    }

    case "numeric-range": {
      const target = readTarget(input, path, issues, false);
      const min = readFiniteNumber(input, "min", path, issues, { required: false });
      const max = readFiniteNumber(input, "max", path, issues, { required: false });
      if (!hasOwn(input, "min") && !hasOwn(input, "max")) {
        addIssue(
          issues,
          path,
          "invalid-check-configuration",
          "numeric-range requires min, max, or both"
        );
      }
      if (min !== undefined && max !== undefined && min > max) {
        addIssue(issues, path, "invalid-check-configuration", "numeric-range requires min <= max");
      }

      return issues.length === initialIssueCount
        ? {
            ...common,
            type,
            ...(target !== undefined ? { target } : {}),
            ...(min !== undefined ? { min } : {}),
            ...(max !== undefined ? { max } : {})
          }
        : undefined;
    }

    case "allowed-values": {
      const target = readTarget(input, path, issues, false);
      let values: readonly JsonValue[] | undefined;
      if (!hasOwn(input, "values")) {
        addIssue(issues, `${path}.values`, "missing-field", "required field is missing");
      } else if (!Array.isArray(input.values)) {
        addIssue(issues, `${path}.values`, "invalid-type", "must be an array");
      } else if (input.values.length === 0) {
        addIssue(issues, `${path}.values`, "invalid-value", "must be non-empty");
      } else if (!input.values.every(isJsonValue)) {
        addIssue(
          issues,
          `${path}.values`,
          "invalid-type",
          "must contain only JSON-compatible values"
        );
      } else {
        values = input.values;
      }

      return issues.length === initialIssueCount && values !== undefined
        ? { ...common, type, ...(target !== undefined ? { target } : {}), values }
        : undefined;
    }

    case "output-length": {
      const target = readTarget(input, path, issues, false);
      const min = readFiniteNumber(input, "min", path, issues, {
        required: false,
        integer: true,
        nonNegative: true
      });
      const max = readFiniteNumber(input, "max", path, issues, {
        required: false,
        integer: true,
        nonNegative: true
      });
      if (!hasOwn(input, "min") && !hasOwn(input, "max")) {
        addIssue(
          issues,
          path,
          "invalid-check-configuration",
          "output-length requires min, max, or both"
        );
      }
      if (min !== undefined && max !== undefined && min > max) {
        addIssue(issues, path, "invalid-check-configuration", "output-length requires min <= max");
      }

      return issues.length === initialIssueCount
        ? {
            ...common,
            type,
            ...(target !== undefined ? { target } : {}),
            ...(min !== undefined ? { min } : {}),
            ...(max !== undefined ? { max } : {})
          }
        : undefined;
    }

    case "token-budget": {
      const maxTokens = readFiniteNumber(input, "maxTokens", path, issues, {
        required: true,
        integer: true,
        nonNegative: true
      });
      return issues.length === initialIssueCount && maxTokens !== undefined
        ? { ...common, type, maxTokens }
        : undefined;
    }

    case "latency-budget": {
      const maxLatencyMs = readFiniteNumber(input, "maxLatencyMs", path, issues, {
        required: true,
        nonNegative: true
      });
      return issues.length === initialIssueCount && maxLatencyMs !== undefined
        ? { ...common, type, maxLatencyMs }
        : undefined;
    }
  }
}

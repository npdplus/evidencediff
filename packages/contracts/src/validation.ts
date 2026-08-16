import {
  CONTENT_TYPES,
  TEST_DEFINITION_FORMAT_VERSION,
  type Check,
  type ContentType,
  type TestDefinition,
  type TestInputDescriptor
} from "./types.js";
import { parseCheck } from "./validation-checks.js";
import {
  ContractValidationError,
  addIssue,
  hasOwn,
  isRecord,
  readFiniteNumber,
  readOptionalBoolean,
  readOptionalString,
  readRequiredNonEmptyString,
  rejectUnknownFields,
  type ValidationIssue,
  type ValidationResult
} from "./validation-issues.js";

const testDefinitionFields = new Set([
  "version",
  "id",
  "name",
  "baseline",
  "candidate",
  "checks",
  "description",
  "reviewRequired"
]);

const inputDescriptorFields = new Set([
  "path",
  "contentType",
  "label",
  "model",
  "promptVersion",
  "build",
  "tokens",
  "latencyMs"
]);

function parseInputDescriptor(
  input: unknown,
  path: string,
  issues: ValidationIssue[]
): TestInputDescriptor | undefined {
  if (!isRecord(input)) {
    addIssue(issues, path, "invalid-type", "must be an object");
    return undefined;
  }

  const initialIssueCount = issues.length;
  rejectUnknownFields(input, inputDescriptorFields, path, issues);
  const filePath = readRequiredNonEmptyString(input, "path", path, issues);

  let contentType: ContentType | undefined;
  if (!hasOwn(input, "contentType")) {
    addIssue(issues, `${path}.contentType`, "missing-field", "required field is missing");
  } else if (
    typeof input.contentType !== "string" ||
    !(CONTENT_TYPES as readonly string[]).includes(input.contentType)
  ) {
    addIssue(issues, `${path}.contentType`, "invalid-value", "must be one of text, json, auto");
  } else {
    contentType = input.contentType as ContentType;
  }

  const label = readOptionalString(input, "label", path, issues);
  const model = readOptionalString(input, "model", path, issues);
  const promptVersion = readOptionalString(input, "promptVersion", path, issues);
  const build = readOptionalString(input, "build", path, issues);
  const tokens = readFiniteNumber(input, "tokens", path, issues, {
    required: false,
    integer: true,
    nonNegative: true
  });
  const latencyMs = readFiniteNumber(input, "latencyMs", path, issues, {
    required: false,
    nonNegative: true
  });

  if (issues.length !== initialIssueCount || filePath === undefined || contentType === undefined) {
    return undefined;
  }

  return {
    path: filePath,
    contentType,
    ...(label !== undefined ? { label } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(promptVersion !== undefined ? { promptVersion } : {}),
    ...(build !== undefined ? { build } : {}),
    ...(tokens !== undefined ? { tokens } : {}),
    ...(latencyMs !== undefined ? { latencyMs } : {})
  };
}

export function validateTestDefinition(input: unknown): ValidationResult<TestDefinition> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    addIssue(issues, "$", "invalid-type", "Test Definition must be an object");
    return { success: false, issues };
  }

  const initialIssueCount = issues.length;
  rejectUnknownFields(input, testDefinitionFields, "$", issues);

  let version: 1 | undefined;
  if (!hasOwn(input, "version")) {
    addIssue(issues, "$.version", "missing-field", "required format version is missing");
  } else if (typeof input.version !== "number" || !Number.isInteger(input.version)) {
    addIssue(issues, "$.version", "invalid-type", "format version must be an integer");
  } else if (input.version !== TEST_DEFINITION_FORMAT_VERSION) {
    addIssue(
      issues,
      "$.version",
      "unsupported-version",
      "only Test Definition format version 1 is supported"
    );
  } else {
    version = TEST_DEFINITION_FORMAT_VERSION;
  }

  const id = readRequiredNonEmptyString(input, "id", "$", issues);
  const name = readRequiredNonEmptyString(input, "name", "$", issues);
  const baseline = hasOwn(input, "baseline")
    ? parseInputDescriptor(input.baseline, "$.baseline", issues)
    : (addIssue(issues, "$.baseline", "missing-field", "required field is missing"), undefined);
  const candidate = hasOwn(input, "candidate")
    ? parseInputDescriptor(input.candidate, "$.candidate", issues)
    : (addIssue(issues, "$.candidate", "missing-field", "required field is missing"), undefined);

  let checks: readonly Check[] | undefined;
  if (!hasOwn(input, "checks")) {
    addIssue(issues, "$.checks", "missing-field", "required field is missing");
  } else if (!Array.isArray(input.checks)) {
    addIssue(issues, "$.checks", "invalid-type", "must be an array");
  } else {
    const parsedChecks: Check[] = [];
    input.checks.forEach((check, index) => {
      const parsed = parseCheck(check, `$.checks[${index}]`, issues);
      if (parsed !== undefined) {
        parsedChecks.push(parsed);
      }
    });
    checks = parsedChecks;
  }

  const description = readOptionalString(input, "description", "$", issues);
  const reviewRequired = readOptionalBoolean(input, "reviewRequired", "$", issues);

  if (
    issues.length !== initialIssueCount ||
    version === undefined ||
    id === undefined ||
    name === undefined ||
    baseline === undefined ||
    candidate === undefined ||
    checks === undefined
  ) {
    return { success: false, issues };
  }

  return {
    success: true,
    value: {
      version,
      id,
      name,
      baseline,
      candidate,
      checks,
      ...(description !== undefined ? { description } : {}),
      ...(reviewRequired !== undefined ? { reviewRequired } : {})
    }
  };
}

export function parseTestDefinition(input: unknown): TestDefinition {
  const result = validateTestDefinition(input);
  if (!result.success) {
    throw new ContractValidationError(result.issues);
  }
  return result.value;
}

export function parseTestDefinitionJson(jsonText: string): TestDefinition {
  let input: unknown;
  try {
    input = JSON.parse(jsonText) as unknown;
  } catch {
    throw new ContractValidationError([
      { path: "$", code: "invalid-json", message: "Test Definition JSON is malformed" }
    ]);
  }

  return parseTestDefinition(input);
}

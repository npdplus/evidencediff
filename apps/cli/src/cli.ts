import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import process from "node:process";

import { evaluateChecks, CheckEvaluationError } from "@npdplus/promptdiff-checks";
import {
  ContractValidationError,
  isJsonValue,
  parseTestDefinitionJson,
  type Baseline,
  type Candidate,
  type ContentType,
  type InputMetadata,
  type JsonValue,
  type TestInputDescriptor,
  type Verdict
} from "@npdplus/promptdiff-contracts";
import {
  aggregateRegressionVerdict,
  assembleEvidence,
  compareJson,
  compareText
} from "@npdplus/promptdiff-core";
import {
  renderEvidenceConsole,
  renderEvidenceJson,
  renderEvidenceMarkdown
} from "@npdplus/promptdiff-reporters";

export type CliExitCode = 0 | 1 | 2 | 3;
export type CliOutputFormat = "console" | "json" | "markdown";

export interface CliIo {
  readonly cwd?: string;
  readonly stdout?: (text: string) => void;
  readonly stderr?: (text: string) => void;
}

interface RuntimeIo {
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

interface CommonOptions {
  readonly format: CliOutputFormat;
  readonly output?: string;
  readonly force: boolean;
}

interface CompareOptions extends CommonOptions {
  readonly baseline: string;
  readonly candidate: string;
  readonly contentType: ContentType;
}

interface TestOptions extends CommonOptions {
  readonly definition: string;
}

class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

const TOOL_VERSION = "0.1.1";
const OUTPUT_FORMATS = new Set<CliOutputFormat>(["console", "json", "markdown"]);
const CONTENT_TYPES = new Set<ContentType>(["text", "json", "auto"]);

const TOP_LEVEL_HELP = `PromptDiff ${TOOL_VERSION}

Usage:
  promptdiff compare --baseline <file> --candidate <file> [options]
  promptdiff test --definition <file> [options]

Commands:
  compare  Compare local Baseline and Candidate files. Successful runs return REVIEW.
  test     Execute a local Test Definition format 1.

Run "promptdiff <command> --help" for command options.
`;

const COMPARE_HELP = `Usage:
  promptdiff compare --baseline <file> --candidate <file> [options]
  promptdiff compare <baseline> <candidate> [options]

Options:
  --baseline <file>             Baseline input path (relative to current directory).
  --candidate <file>            Candidate input path (relative to current directory).
  --content-type <type>         text, json, or auto (default: auto).
  --format <format>             console, json, or markdown (default: console).
  --output <file>               Write the selected report to this path instead of stdout.
  --force                       Allow replacing an existing output file.
  -h, --help                    Show this help.
`;

const TEST_HELP = `Usage:
  promptdiff test --definition <file> [options]
  promptdiff test <definition> [options]

Options:
  --definition <file>           Test Definition format 1 path.
  --format <format>             console, json, or markdown (default: console).
  --output <file>               Write the selected report to this path instead of stdout.
  --force                       Allow replacing an existing output file.
  -h, --help                    Show this help.

Test Definition Baseline/Candidate paths resolve relative to the definition file.
`;

function runtimeIo(io: CliIo): RuntimeIo {
  return {
    cwd: io.cwd ?? process.cwd(),
    stdout: io.stdout ?? ((text) => process.stdout.write(text)),
    stderr: io.stderr ?? ((text) => process.stderr.write(text))
  };
}

function requireValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new CliError(`${option} requires a value.`);
  }
  return value;
}

function parseFormat(value: string): CliOutputFormat {
  if (!OUTPUT_FORMATS.has(value as CliOutputFormat)) {
    throw new CliError(`--format must be one of: console, json, markdown.`);
  }
  return value as CliOutputFormat;
}

function parseContentType(value: string): ContentType {
  if (!CONTENT_TYPES.has(value as ContentType)) {
    throw new CliError(`--content-type must be one of: text, json, auto.`);
  }
  return value as ContentType;
}

function parseCommonOption(
  args: readonly string[],
  index: number,
  current: CommonOptions
): { readonly handled: boolean; readonly nextIndex: number; readonly options: CommonOptions } {
  const token = args[index];
  if (token === "--format") {
    const value = requireValue(args, index, "--format");
    return {
      handled: true,
      nextIndex: index + 2,
      options: { ...current, format: parseFormat(value) }
    };
  }
  if (token === "--output") {
    const value = requireValue(args, index, "--output");
    return {
      handled: true,
      nextIndex: index + 2,
      options: { ...current, output: value }
    };
  }
  if (token === "--force") {
    return {
      handled: true,
      nextIndex: index + 1,
      options: { ...current, force: true }
    };
  }
  return { handled: false, nextIndex: index, options: current };
}

function ensureOutputConfiguration(options: CommonOptions): void {
  if (options.force && options.output === undefined) {
    throw new CliError("--force requires --output.");
  }
}

function parseCompareOptions(args: readonly string[]): CompareOptions | "help" {
  let baseline: string | undefined;
  let candidate: string | undefined;
  let contentType: ContentType = "auto";
  let common: CommonOptions = { format: "console", force: false };
  const positionals: string[] = [];

  for (let index = 0; index < args.length; ) {
    const token = args[index]!;
    if (token === "-h" || token === "--help") {
      return "help";
    }

    const commonResult = parseCommonOption(args, index, common);
    if (commonResult.handled) {
      common = commonResult.options;
      index = commonResult.nextIndex;
      continue;
    }

    if (token === "--baseline") {
      if (baseline !== undefined) {
        throw new CliError("--baseline may be provided only once.");
      }
      baseline = requireValue(args, index, "--baseline");
      index += 2;
      continue;
    }
    if (token === "--candidate") {
      if (candidate !== undefined) {
        throw new CliError("--candidate may be provided only once.");
      }
      candidate = requireValue(args, index, "--candidate");
      index += 2;
      continue;
    }
    if (token === "--content-type") {
      contentType = parseContentType(requireValue(args, index, "--content-type"));
      index += 2;
      continue;
    }
    if (token.startsWith("-")) {
      throw new CliError(`Unknown compare option: ${token}.`);
    }
    positionals.push(token);
    index += 1;
  }

  if ((baseline !== undefined || candidate !== undefined) && positionals.length > 0) {
    throw new CliError("Do not mix named and positional compare inputs.");
  }
  if (positionals.length > 2) {
    throw new CliError("compare accepts exactly two positional input paths.");
  }

  baseline ??= positionals[0];
  candidate ??= positionals[1];
  if (baseline === undefined || candidate === undefined) {
    throw new CliError("compare requires Baseline and Candidate input paths.");
  }

  ensureOutputConfiguration(common);
  return { ...common, baseline, candidate, contentType };
}

function parseTestOptions(args: readonly string[]): TestOptions | "help" {
  let definition: string | undefined;
  let common: CommonOptions = { format: "console", force: false };
  const positionals: string[] = [];

  for (let index = 0; index < args.length; ) {
    const token = args[index]!;
    if (token === "-h" || token === "--help") {
      return "help";
    }

    const commonResult = parseCommonOption(args, index, common);
    if (commonResult.handled) {
      common = commonResult.options;
      index = commonResult.nextIndex;
      continue;
    }

    if (token === "--definition") {
      if (definition !== undefined) {
        throw new CliError("--definition may be provided only once.");
      }
      definition = requireValue(args, index, "--definition");
      index += 2;
      continue;
    }
    if (token.startsWith("-")) {
      throw new CliError(`Unknown test option: ${token}.`);
    }
    positionals.push(token);
    index += 1;
  }

  if (definition !== undefined && positionals.length > 0) {
    throw new CliError("Do not mix named and positional Test Definition paths.");
  }
  if (positionals.length > 1) {
    throw new CliError("test accepts exactly one positional Test Definition path.");
  }

  definition ??= positionals[0];
  if (definition === undefined) {
    throw new CliError("test requires a Test Definition path.");
  }

  ensureOutputConfiguration(common);
  return { ...common, definition };
}

async function readUtf8File(
  absolutePath: string,
  label: string,
  displayPath: string
): Promise<string> {
  try {
    return await readFile(absolutePath, "utf8");
  } catch {
    throw new CliError(`Cannot read ${label}: ${displayPath}.`);
  }
}

function parseJsonInput(text: string, displayPath: string): JsonValue {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new CliError(`Input declared as JSON is malformed: ${displayPath}.`);
  }
  if (!isJsonValue(value)) {
    throw new CliError(`Input is not a supported JSON value: ${displayPath}.`);
  }
  return value;
}

function autoInput(text: string):
  | { readonly contentType: "text"; readonly value: string }
  | {
      readonly contentType: "json";
      readonly value: JsonValue;
    } {
  try {
    const value = JSON.parse(text) as unknown;
    if (isJsonValue(value)) {
      return { contentType: "json", value };
    }
  } catch {
    // Auto detection falls back to exact text when the file is not valid JSON.
  }
  return { contentType: "text", value: text };
}

function metadata(descriptor: TestInputDescriptor): InputMetadata {
  return {
    ...(descriptor.model !== undefined ? { model: descriptor.model } : {}),
    ...(descriptor.promptVersion !== undefined ? { promptVersion: descriptor.promptVersion } : {}),
    ...(descriptor.build !== undefined ? { build: descriptor.build } : {}),
    ...(descriptor.tokens !== undefined ? { tokens: descriptor.tokens } : {}),
    ...(descriptor.latencyMs !== undefined ? { latencyMs: descriptor.latencyMs } : {})
  };
}

async function loadInput(
  descriptor: TestInputDescriptor,
  baseDirectory: string,
  role: "baseline"
): Promise<Baseline>;
async function loadInput(
  descriptor: TestInputDescriptor,
  baseDirectory: string,
  role: "candidate"
): Promise<Candidate>;
async function loadInput(
  descriptor: TestInputDescriptor,
  baseDirectory: string,
  role: "baseline" | "candidate"
): Promise<Baseline | Candidate> {
  const absolutePath = resolve(baseDirectory, descriptor.path);
  const text = await readUtf8File(absolutePath, `${role} input`, descriptor.path);
  const resolvedContent =
    descriptor.contentType === "text"
      ? ({ contentType: "text", value: text } as const)
      : descriptor.contentType === "json"
        ? ({ contentType: "json", value: parseJsonInput(text, descriptor.path) } as const)
        : autoInput(text);

  return {
    role,
    path: descriptor.path,
    ...(descriptor.label !== undefined ? { label: descriptor.label } : {}),
    ...metadata(descriptor),
    ...resolvedContent
  } as Baseline | Candidate;
}

function compareInputs(baseline: Baseline, candidate: Candidate) {
  if (baseline.contentType !== candidate.contentType) {
    throw new CliError(
      `Baseline resolved as ${baseline.contentType} but Candidate resolved as ${candidate.contentType}; use an explicit matching content type.`
    );
  }
  return baseline.contentType === "text" && candidate.contentType === "text"
    ? compareText(baseline.value, candidate.value)
    : baseline.contentType === "json" && candidate.contentType === "json"
      ? compareJson(baseline.value, candidate.value)
      : [];
}

function exitCodeForVerdict(verdict: Verdict): CliExitCode {
  switch (verdict) {
    case "PASS":
      return 0;
    case "FAIL":
      return 1;
    case "REVIEW":
      return 3;
  }
}

function renderEvidence(
  format: CliOutputFormat,
  evidence: Parameters<typeof renderEvidenceJson>[0]
): string {
  switch (format) {
    case "console":
      return renderEvidenceConsole(evidence);
    case "json":
      return renderEvidenceJson(evidence);
    case "markdown":
      return renderEvidenceMarkdown(evidence);
  }
}

function normalizeComparablePath(path: string): string {
  return process.platform === "win32" ? path.toLowerCase() : path;
}

async function canonicalPath(path: string): Promise<string> {
  try {
    return normalizeComparablePath(await realpath(path));
  } catch {
    try {
      const canonicalParent = await realpath(dirname(path));
      return normalizeComparablePath(resolve(canonicalParent, basename(path)));
    } catch {
      return normalizeComparablePath(resolve(path));
    }
  }
}

async function sameExistingFile(left: string, right: string): Promise<boolean> {
  try {
    const [leftStats, rightStats] = await Promise.all([stat(left), stat(right)]);
    return leftStats.dev === rightStats.dev && leftStats.ino === rightStats.ino;
  } catch {
    return false;
  }
}

async function collidesWithProtectedPath(
  outputPath: string,
  protectedPaths: readonly string[]
): Promise<boolean> {
  const canonicalOutput = await canonicalPath(outputPath);
  for (const protectedPath of protectedPaths) {
    if (canonicalOutput === (await canonicalPath(protectedPath))) {
      return true;
    }
    if (await sameExistingFile(outputPath, protectedPath)) {
      return true;
    }
  }
  return false;
}

async function emitReport(
  report: string,
  options: CommonOptions,
  io: RuntimeIo,
  protectedPaths: readonly string[]
): Promise<void> {
  if (options.output === undefined) {
    io.stdout(report);
    return;
  }

  const outputPath = resolve(io.cwd, options.output);
  if (await collidesWithProtectedPath(outputPath, protectedPaths)) {
    throw new CliError("Output path must not overwrite an input or Test Definition file.");
  }

  try {
    await writeFile(outputPath, report, { encoding: "utf8", flag: options.force ? "w" : "wx" });
  } catch (error) {
    if (
      !options.force &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new CliError(`Output already exists: ${options.output}. Use --force to replace it.`);
    }
    throw new CliError(`Cannot write output file: ${options.output}.`);
  }
}

async function runCompare(options: CompareOptions, io: RuntimeIo): Promise<CliExitCode> {
  const baselineDescriptor: TestInputDescriptor = {
    path: options.baseline,
    contentType: options.contentType
  };
  const candidateDescriptor: TestInputDescriptor = {
    path: options.candidate,
    contentType: options.contentType
  };
  const baseline = await loadInput(baselineDescriptor, io.cwd, "baseline");
  const candidate = await loadInput(candidateDescriptor, io.cwd, "candidate");
  const differences = compareInputs(baseline, candidate);
  const regressionVerdict = aggregateRegressionVerdict([]);
  const evidence = assembleEvidence({
    toolVersion: TOOL_VERSION,
    baseline,
    candidate,
    differences,
    checkResults: [],
    regressionVerdict
  });
  const report = renderEvidence(options.format, evidence);

  await emitReport(report, options, io, [
    resolve(io.cwd, options.baseline),
    resolve(io.cwd, options.candidate)
  ]);
  return exitCodeForVerdict(evidence.verdict);
}

async function runTest(options: TestOptions, io: RuntimeIo): Promise<CliExitCode> {
  const definitionPath = resolve(io.cwd, options.definition);
  const definitionText = await readUtf8File(definitionPath, "Test Definition", options.definition);
  const definition = parseTestDefinitionJson(definitionText);
  const definitionDirectory = dirname(definitionPath);
  const baseline = await loadInput(definition.baseline, definitionDirectory, "baseline");
  const candidate = await loadInput(definition.candidate, definitionDirectory, "candidate");
  const differences = compareInputs(baseline, candidate);
  const checkResults = evaluateChecks(definition.checks, baseline, candidate);
  const regressionVerdict = aggregateRegressionVerdict(checkResults, {
    reviewRequired: definition.reviewRequired === true,
    baselineMetrics: definition.baseline,
    candidateMetrics: definition.candidate
  });
  const evidence = assembleEvidence({
    toolVersion: TOOL_VERSION,
    test: {
      id: definition.id,
      name: definition.name,
      ...(definition.description !== undefined ? { description: definition.description } : {})
    },
    baseline,
    candidate,
    differences,
    checkResults,
    regressionVerdict
  });
  const report = renderEvidence(options.format, evidence);

  await emitReport(report, options, io, [
    definitionPath,
    resolve(definitionDirectory, definition.baseline.path),
    resolve(definitionDirectory, definition.candidate.path)
  ]);
  return exitCodeForVerdict(evidence.verdict);
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof CliError || error instanceof ContractValidationError) {
    return error.message;
  }
  if (error instanceof CheckEvaluationError) {
    return `Check evaluation error: ${error.message}`;
  }
  return "Unexpected runtime failure.";
}

export async function runCli(
  args: readonly string[],
  ioOverrides: CliIo = {}
): Promise<CliExitCode> {
  const io = runtimeIo(ioOverrides);
  try {
    const command = args[0];
    if (command === undefined || command === "help" || command === "-h" || command === "--help") {
      io.stdout(TOP_LEVEL_HELP);
      return 0;
    }

    if (command === "compare") {
      const options = parseCompareOptions(args.slice(1));
      if (options === "help") {
        io.stdout(COMPARE_HELP);
        return 0;
      }
      return await runCompare(options, io);
    }

    if (command === "test") {
      const options = parseTestOptions(args.slice(1));
      if (options === "help") {
        io.stdout(TEST_HELP);
        return 0;
      }
      return await runTest(options, io);
    }

    throw new CliError(`Unknown command: ${command}. Use --help for usage.`);
  } catch (error) {
    io.stderr(`PromptDiff error: ${safeErrorMessage(error)}\n`);
    return 2;
  }
}

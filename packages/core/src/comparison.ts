import type {
  JsonDifference,
  JsonObject,
  JsonPointer,
  JsonValue,
  TextDifference
} from "@npdplus/evidencediff-contracts";

function commonPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function commonSuffixLength(left: string, right: string, prefixLength: number): number {
  const limit = Math.min(left.length, right.length) - prefixLength;
  let count = 0;
  while (count < limit && left[left.length - 1 - count] === right[right.length - 1 - count]) {
    count += 1;
  }
  return count;
}

export function compareText(baseline: string, candidate: string): readonly TextDifference[] {
  if (baseline === candidate) {
    return [];
  }

  const prefixLength = commonPrefixLength(baseline, candidate);
  const suffixLength = commonSuffixLength(baseline, candidate, prefixLength);
  const baselineMiddle = baseline.slice(prefixLength, baseline.length - suffixLength);
  const candidateMiddle = candidate.slice(prefixLength, candidate.length - suffixLength);

  const kind =
    baselineMiddle.length === 0 ? "inserted" : candidateMiddle.length === 0 ? "removed" : "changed";

  return [{ domain: "text", kind, baseline, candidate }];
}

function jsonType(value: JsonValue): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value === "object" ? "object" : typeof value;
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonEqual(left: JsonValue, right: JsonValue): boolean {
  const leftType = jsonType(left);
  if (leftType !== jsonType(right)) {
    return false;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((value, index) => jsonEqual(value, right[index]!))
    );
  }

  if (isJsonObject(left) && isJsonObject(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] && jsonEqual(left[key] as JsonValue, right[key] as JsonValue)
      )
    );
  }

  return Object.is(left, right);
}

function escapeJsonPointerToken(token: string): string {
  return token.replaceAll("~", "~0").replaceAll("/", "~1");
}

function childPointer(parent: JsonPointer, key: string): JsonPointer {
  return `${parent}/${escapeJsonPointerToken(key)}` as JsonPointer;
}

function pushJsonDifference(differences: JsonDifference[], difference: JsonDifference): void {
  differences.push(difference);
}

function compareJsonAt(
  baseline: JsonValue,
  candidate: JsonValue,
  path: JsonPointer,
  differences: JsonDifference[]
): void {
  const baselineType = jsonType(baseline);
  const candidateType = jsonType(candidate);

  if (baselineType !== candidateType) {
    pushJsonDifference(differences, {
      domain: "json",
      kind: "type-changed",
      path,
      baseline,
      candidate,
      baselineType,
      candidateType
    });
    return;
  }

  if (Array.isArray(baseline) && Array.isArray(candidate)) {
    if (!jsonEqual(baseline, candidate)) {
      pushJsonDifference(differences, {
        domain: "json",
        kind: "array-changed",
        path,
        baseline,
        candidate,
        baselineType: "array",
        candidateType: "array"
      });
    }
    return;
  }

  if (isJsonObject(baseline) && isJsonObject(candidate)) {
    const keys = [...new Set([...Object.keys(baseline), ...Object.keys(candidate)])].sort();
    for (const key of keys) {
      const nextPath = childPointer(path, key);
      const baselineHasKey = Object.prototype.hasOwnProperty.call(baseline, key);
      const candidateHasKey = Object.prototype.hasOwnProperty.call(candidate, key);

      if (!baselineHasKey) {
        const candidateValue = candidate[key] as JsonValue;
        pushJsonDifference(differences, {
          domain: "json",
          kind: "added",
          path: nextPath,
          candidate: candidateValue,
          candidateType: jsonType(candidateValue)
        });
        continue;
      }

      if (!candidateHasKey) {
        const baselineValue = baseline[key] as JsonValue;
        pushJsonDifference(differences, {
          domain: "json",
          kind: "removed",
          path: nextPath,
          baseline: baselineValue,
          baselineType: jsonType(baselineValue)
        });
        continue;
      }

      compareJsonAt(baseline[key] as JsonValue, candidate[key] as JsonValue, nextPath, differences);
    }
    return;
  }

  if (!Object.is(baseline, candidate)) {
    pushJsonDifference(differences, {
      domain: "json",
      kind: "value-changed",
      path,
      baseline,
      candidate,
      baselineType,
      candidateType
    });
  }
}

export function compareJson(baseline: JsonValue, candidate: JsonValue): readonly JsonDifference[] {
  if (jsonEqual(baseline, candidate)) {
    return [];
  }

  const differences: JsonDifference[] = [];
  compareJsonAt(baseline, candidate, "" as JsonPointer, differences);
  return differences;
}

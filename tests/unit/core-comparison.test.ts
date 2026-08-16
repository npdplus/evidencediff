import { describe, expect, it } from "vitest";

import { isJsonPointer, type JsonDifference } from "../../packages/contracts/src/index.js";
import { compareJson, compareText } from "../../packages/core/src/index.js";

describe("P03 text comparison", () => {
  it("returns no difference for identical empty or non-empty text", () => {
    expect(compareText("", "")).toEqual([]);
    expect(compareText("same", "same")).toEqual([]);
  });

  it("classifies a contiguous insertion", () => {
    expect(compareText("hello world", "hello brave world")).toEqual([
      {
        domain: "text",
        kind: "inserted",
        baseline: "hello world",
        candidate: "hello brave world"
      }
    ]);
  });

  it("classifies a contiguous removal", () => {
    expect(compareText("hello brave world", "hello world")).toEqual([
      {
        domain: "text",
        kind: "removed",
        baseline: "hello brave world",
        candidate: "hello world"
      }
    ]);
  });

  it("classifies replacement content as changed", () => {
    expect(compareText("status: draft", "status: ready")[0]?.kind).toBe("changed");
  });

  it("does not normalize whitespace or newlines", () => {
    expect(compareText("alpha beta", "alpha  beta")[0]?.kind).toBe("inserted");
    expect(compareText("alpha\nbeta", "alpha\r\nbeta")).not.toEqual([]);
  });

  it("compares Unicode exactly", () => {
    expect(compareText("สวัสดี", "สวัสดีครับ")[0]?.kind).toBe("inserted");
    expect(compareText("café", "cafe")[0]?.kind).toBe("changed");
  });

  it("is deterministic across repeated runs", () => {
    const expected = compareText("before", "after");
    for (let index = 0; index < 20; index += 1) {
      expect(compareText("before", "after")).toEqual(expected);
    }
  });
});

describe("P03 JSON structural comparison", () => {
  it("returns no difference for equivalent primitives and objects with different key order", () => {
    expect(compareJson(7, 7)).toEqual([]);
    expect(compareJson({ b: 2, a: 1 }, { a: 1, b: 2 })).toEqual([]);
  });

  it("reports added and removed fields", () => {
    expect(compareJson({ a: 1 }, { a: 1, b: 2 })).toEqual([
      {
        domain: "json",
        kind: "added",
        path: "/b",
        candidate: 2,
        candidateType: "number"
      }
    ]);
    expect(compareJson({ a: 1, b: 2 }, { a: 1 })).toEqual([
      {
        domain: "json",
        kind: "removed",
        path: "/b",
        baseline: 2,
        baselineType: "number"
      }
    ]);
  });

  it("reports same-type primitive value changes", () => {
    expect(compareJson({ score: 1 }, { score: 2 })).toEqual([
      {
        domain: "json",
        kind: "value-changed",
        path: "/score",
        baseline: 1,
        candidate: 2,
        baselineType: "number",
        candidateType: "number"
      }
    ]);
  });

  it("reports type changes including root-level changes", () => {
    expect(compareJson("1", 1)).toEqual([
      {
        domain: "json",
        kind: "type-changed",
        path: "",
        baseline: "1",
        candidate: 1,
        baselineType: "string",
        candidateType: "number"
      }
    ]);
  });

  it("keeps missing distinct from explicit null", () => {
    expect(compareJson({}, { value: null })).toEqual([
      {
        domain: "json",
        kind: "added",
        path: "/value",
        candidate: null,
        candidateType: "null"
      }
    ]);
  });

  it("walks nested objects and produces escaped RFC 6901 paths", () => {
    const differences = compareJson(
      { customer: { "a/b": { "m~n": 1 } } },
      { customer: { "a/b": { "m~n": 2 } } }
    );

    expect(differences).toEqual([
      {
        domain: "json",
        kind: "value-changed",
        path: "/customer/a~1b/m~0n",
        baseline: 1,
        candidate: 2,
        baselineType: "number",
        candidateType: "number"
      }
    ]);
    for (const difference of differences) {
      expect(isJsonPointer(difference.path)).toBe(true);
    }
  });

  it("treats array order as significant", () => {
    expect(compareJson([1, 2, 3], [3, 2, 1])).toEqual([
      {
        domain: "json",
        kind: "array-changed",
        path: "",
        baseline: [1, 2, 3],
        candidate: [3, 2, 1],
        baselineType: "array",
        candidateType: "array"
      }
    ]);
  });

  it("treats array content and length changes atomically at the array path", () => {
    expect(compareJson({ items: [1, 2] }, { items: [1, 2, 3] })[0]).toMatchObject({
      domain: "json",
      kind: "array-changed",
      path: "/items"
    });
    expect(compareJson({ items: [[1], [2]] }, { items: [[1], [3]] })[0]).toMatchObject({
      kind: "array-changed",
      path: "/items"
    });
  });

  it("detects object changes inside arrays without sorting the array", () => {
    expect(compareJson([{ id: 1, state: "old" }], [{ id: 1, state: "new" }])[0]).toMatchObject({
      kind: "array-changed",
      path: ""
    });
  });

  it("orders object differences deterministically by sorted JSON Pointer traversal", () => {
    const baseline = { z: 0, nested: { beta: 2, alpha: 1 }, a: true };
    const candidate = { a: false, nested: { alpha: 9, beta: 8 }, z: 1 };
    const differences: readonly JsonDifference[] = compareJson(baseline, candidate);

    expect(differences.map((difference) => difference.path)).toEqual([
      "/a",
      "/nested/alpha",
      "/nested/beta",
      "/z"
    ]);
  });

  it("is deterministic even when equivalent object insertion order differs between runs", () => {
    const baseline = { b: { y: 1, x: 2 }, a: 0 };
    const candidateA = { a: 1, b: { x: 3, y: 4 } };
    const candidateB = { b: { y: 4, x: 3 }, a: 1 };

    expect(compareJson(baseline, candidateA)).toEqual(compareJson(baseline, candidateB));
  });
});

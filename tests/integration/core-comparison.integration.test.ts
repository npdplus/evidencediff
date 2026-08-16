import { describe, expect, it } from "vitest";

import { isJsonPointer, type Difference } from "../../packages/contracts/src/index.js";
import { compareJson, compareText } from "../../packages/core/src/index.js";

describe("P03 core comparison integration", () => {
  it("returns frozen Difference contracts through the core public entry point", () => {
    const differences: readonly Difference[] = [
      ...compareText("accepted", "candidate"),
      ...compareJson(
        { profile: { active: true }, roles: ["reader", "writer"] },
        { profile: { active: false }, roles: ["writer", "reader"] }
      )
    ];

    expect(differences.map((difference) => difference.domain)).toEqual(["text", "json", "json"]);
    const jsonDifferences = differences.filter((difference) => difference.domain === "json");
    expect(jsonDifferences.map((difference) => difference.path)).toEqual([
      "/profile/active",
      "/roles"
    ]);
    expect(jsonDifferences.every((difference) => isJsonPointer(difference.path))).toBe(true);
  });

  it("keeps Difference neutral and does not expose later-phase verdict or regression behavior", () => {
    const difference = compareJson({ status: "draft" }, { status: "ready" })[0];

    expect(difference).toMatchObject({ domain: "json", kind: "value-changed", path: "/status" });
    expect(difference).not.toHaveProperty("verdict");
    expect(difference).not.toHaveProperty("regression");
    expect(difference).not.toHaveProperty("checkResult");
  });
});

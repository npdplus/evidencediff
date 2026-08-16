import { describe, expect, it } from "vitest";

describe("P01 repository foundation", () => {
  it("loads every workspace source entry point without product behavior", async () => {
    const modules = await Promise.all([
      import("../../apps/cli/src/index.js"),
      import("../../packages/contracts/src/index.js"),
      import("../../packages/core/src/index.js"),
      import("../../packages/checks/src/index.js"),
      import("../../packages/reporters/src/index.js")
    ]);

    expect(modules).toHaveLength(5);
  });
});

import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

function workspaceSource(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      "@npdplus/promptdiff-checks": workspaceSource("./packages/checks/src/index.ts"),
      "@npdplus/promptdiff-contracts": workspaceSource("./packages/contracts/src/index.ts"),
      "@npdplus/promptdiff-core": workspaceSource("./packages/core/src/index.ts"),
      "@npdplus/promptdiff-reporters": workspaceSource("./packages/reporters/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: false
  }
});

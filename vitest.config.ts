import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

function workspaceSource(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      "@npdplus/evidencediff-checks": workspaceSource("./packages/checks/src/index.ts"),
      "@npdplus/evidencediff-contracts": workspaceSource("./packages/contracts/src/index.ts"),
      "@npdplus/evidencediff-core": workspaceSource("./packages/core/src/index.ts"),
      "@npdplus/evidencediff-reporters": workspaceSource("./packages/reporters/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: false
  }
});

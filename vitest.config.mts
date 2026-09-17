import path from "node:path";
import { defineConfig } from "vitest/config";

// .mts, not .ts: the package isn't ESM, so a .ts config gets loaded as CJS and
// vitest's own ESM-only dependencies fail to require().
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});

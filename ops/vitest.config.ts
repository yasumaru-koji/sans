import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["lib/**/*.test.ts"], env: { OPS_DB_PATH: ":memory:" } },
});

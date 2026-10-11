import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/snap-cap/",
  plugins: [react()],
  test: { environment: "node", setupFiles: ["tests/setup.ts"] },
  build: { target: "es2022" },
});

import { defineConfig } from "vitest/config";
import path from "path";

// Until component tests existed, every test lived in src/lib and imported its
// subject relatively, so vitest never needed to know about the "@/" alias that
// tsconfig.json defines and the app uses everywhere. A component importing
// "@/lib/readiness" does need it.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    // The app is on React 18 with the automatic JSX runtime (next/babel), so
    // test files don't import React explicitly either.
    jsx: "automatic",
  },
});

import path from "path";

import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  // Svelte 5 runes require the vite-plugin-svelte preprocessor; without
  // it `.svelte.ts` files crash on `$state is not defined` at test time.
  // The plugin is already a dev dep via sveltedraw-app's vite config —
  // we just wire it into the vitest pipeline here.
  plugins: [svelte()],
  resolve: {
    alias: [
      {
        find: /^@sveltedraw\/common$/,
        replacement: path.resolve(__dirname, "./packages/common/src/index.ts"),
      },
      {
        find: /^@sveltedraw\/common\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/common/src/$1"),
      },
      {
        find: /^@sveltedraw\/element$/,
        replacement: path.resolve(__dirname, "./packages/element/src/index.ts"),
      },
      {
        find: /^@sveltedraw\/element\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/element/src/$1"),
      },
      {
        find: /^@sveltedraw\/excalidraw$/,
        replacement: path.resolve(__dirname, "./packages/excalidraw/index.tsx"),
      },
      {
        find: /^@sveltedraw\/engine\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/excalidraw/$1"),
      },
      {
        find: /^@sveltedraw\/math$/,
        replacement: path.resolve(__dirname, "./packages/math/src/index.ts"),
      },
      {
        find: /^@sveltedraw\/math\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/math/src/$1"),
      },
      {
        find: /^@sveltedraw\/utils$/,
        replacement: path.resolve(__dirname, "./packages/utils/src/index.ts"),
      },
      {
        find: /^@sveltedraw\/utils\/(.*?)/,
        replacement: path.resolve(__dirname, "./packages/utils/src/$1"),
      },
    ],
  },
  //@ts-ignore
  test: {
    // Since hooks are running in stack in v2, which means all hooks run serially whereas
    // we need to run them in parallel
    sequence: {
      hooks: "parallel",
    },
    setupFiles: ["./setupTests.ts"],
    globals: true,
    environment: "jsdom",
    exclude: [".claude/**", "node_modules/**"],
    coverage: {
      reporter: ["text", "json-summary", "json", "html", "lcovonly"],
      // Since v2, it ignores empty lines by default and we need to disable it as it affects the coverage
      // Additionally the thresholds also needs to be updated slightly as a result of this change
      ignoreEmptyLines: false,
      thresholds: {
        lines: 60,
        branches: 70,
        functions: 63,
        statements: 60,
      },
    },
  },
});

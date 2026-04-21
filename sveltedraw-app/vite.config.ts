import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const resolve = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 3001,
    open: true,
  },
  resolve: {
    alias: [
      { find: /^@excalidraw\/excalidraw$/, replacement: resolve('../packages/excalidraw/index.tsx') },
      { find: /^@excalidraw\/excalidraw\/(.*)/, replacement: resolve('../packages/excalidraw/$1') },
      { find: /^@excalidraw\/common$/, replacement: resolve('../packages/common/src/index.ts') },
      { find: /^@excalidraw\/common\/(.*)/, replacement: resolve('../packages/common/src/$1') },
      { find: /^@excalidraw\/element$/, replacement: resolve('../packages/element/src/index.ts') },
      { find: /^@excalidraw\/element\/(.*)/, replacement: resolve('../packages/element/src/$1') },
      { find: /^@excalidraw\/math$/, replacement: resolve('../packages/math/src/index.ts') },
      { find: /^@excalidraw\/math\/(.*)/, replacement: resolve('../packages/math/src/$1') },
      { find: /^@excalidraw\/utils$/, replacement: resolve('../packages/utils/src/index.ts') },
      { find: /^@sveltedraw\/excalidraw$/, replacement: resolve('../packages/excalidraw-svelte/src/index.ts') },
    ],
  },
  build: {
    target: 'esnext',
  },
});

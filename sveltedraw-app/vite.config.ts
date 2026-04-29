import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';

const resolve = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  // Svelte's `each_key_duplicate` / `each_key_volatile` / many other
  // runtime diagnostics are gated on `process.env.NODE_ENV` being a
  // non-"prod"-prefixed string (see esm-env's dev-fallback.js). Vite does
  // not define this for the browser by default, so in dev the browser
  // sees `undefined` and Svelte falls through to the terse prod error
  // message (just the URL, no key / index context). Forcing the define
  // restores the detailed messages that tell you *which* key collided.
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
  plugins: [
    svelte(),
    // Service-worker + install manifest. Caching rules tuned for the
    // Sveltedraw asset shape (fonts, locales, chunk names).
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: process.env.VITE_APP_ENABLE_PWA === 'true',
      },
      workbox: {
        globIgnores: [
          'fonts.css',
          '**/locales/**',
          'service-worker.js',
          '**/*.chunk-*.js',
        ],
        runtimeCaching: [
          {
            urlPattern: /.+\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90d
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /fonts\.css$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 50 },
            },
          },
          {
            urlPattern: /locales\/[^/]+\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'locales',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30d
              },
            },
          },
          {
            urlPattern: /\.chunk-.+\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'chunk',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 ** 2, // 3MB — our bundles
        // are larger than original's React equivalents.
      },
      manifest: {
        short_name: 'Sveltedraw',
        name: 'Sveltedraw',
        description:
          'Svelte port of Sveltedraw — a whiteboard tool for sketching hand-drawn diagrams.',
        icons: [],
        start_url: '/',
        id: 'sveltedraw',
        display: 'standalone',
        theme_color: '#121212',
        background_color: '#ffffff',
      },
    }),
  ],
  server: {
    port: 3001,
    open: true,
  },
  resolve: {
    // bits-ui's package.json `exports` only declares `svelte` + `types`
    // conditions (no `default`/`import`). Older vite resolvers fail to pick a
    // condition without this hint.
    conditions: ['svelte', 'browser', 'module', 'import', 'default'],
    alias: [
      // Engine is consumed via subpath imports only (no bare entry);
      // editor is consumed via the bare entry @sveltedraw/editor.
      { find: /^@sveltedraw\/engine\/(.*)/, replacement: resolve('../packages/engine/$1') },
      { find: /^@sveltedraw\/common$/, replacement: resolve('../packages/common/src/index.ts') },
      { find: /^@sveltedraw\/common\/(.*)/, replacement: resolve('../packages/common/src/$1') },
      { find: /^@sveltedraw\/element$/, replacement: resolve('../packages/element/src/index.ts') },
      { find: /^@sveltedraw\/element\/(.*)/, replacement: resolve('../packages/element/src/$1') },
      { find: /^@sveltedraw\/math$/, replacement: resolve('../packages/math/src/index.ts') },
      { find: /^@sveltedraw\/math\/(.*)/, replacement: resolve('../packages/math/src/$1') },
      { find: /^@sveltedraw\/utils$/, replacement: resolve('../packages/utils/src/index.ts') },
      { find: /^@sveltedraw\/utils\/(.*)/, replacement: resolve('../packages/utils/src/$1') },
      { find: /^@sveltedraw\/editor$/, replacement: resolve('../packages/editor/src/index.ts') },
    ],
  },
  build: {
    target: 'esnext',
    // Chunk size budget: the warning limit at default 500 KB was
    // designed for typical SPAs. Sveltedraw has a ~900 KB main
    // bundle even after splitting because of the canvas rendering
    // stack (roughjs + perfect-freehand + element ops). Raising to
    // 800 KB suppresses the noise on chunks that are already as
    // small as they can be.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Source-generated font subset worker — already its own
          // chunk via Sveltedraw's fonts pipeline, keep as-is.
          if (id.includes('subset-shared') || id.includes('subset-worker')) {
            return undefined;
          }

          if (id.includes('node_modules')) {
            // Canvas rendering libs — paired with the scene engine.
            if (
              id.includes('roughjs') ||
              id.includes('perfect-freehand') ||
              id.includes('points-on-curve') ||
              id.includes('canvas-roundrect-polyfill') ||
              id.includes('path-data-parser')
            ) {
              return 'canvas-libs';
            }
            // UI primitives
            if (id.includes('bits-ui') || id.includes('@melt-ui')) {
              return 'bits-ui';
            }
            // Mermaid + codemirror: future TTDDialog, lazy-loadable.
            if (id.includes('@excalidraw/mermaid-to-excalidraw')) {
              return 'mermaid';
            }
            if (id.includes('@codemirror') || id.includes('@lezer')) {
              return 'codemirror';
            }
            // Small standalone libs
            if (
              id.includes('nanoid') ||
              id.includes('pako') ||
              id.includes('fractional-indexing') ||
              id.includes('browser-fs-access') ||
              id.includes('clsx') ||
              id.includes('fuzzy')
            ) {
              return 'vendor-small';
            }
            // Image libs (large)
            if (id.includes('image-blob-reduce') || id.includes('pica')) {
              return 'image-libs';
            }
            // Everything else in node_modules: generic vendor.
            return 'vendor';
          }

          // Split the Sveltedraw engine (scene + renderer + data +
          // fonts) into its own chunk so the Svelte app code can be
          // updated without busting the engine cache.
          if (
            id.includes('/packages/engine/scene/') ||
            id.includes('/packages/engine/renderer/') ||
            id.includes('/packages/engine/data/') ||
            id.includes('/packages/engine/fonts/') ||
            id.includes('/packages/engine/clipboard.ts') ||
            id.includes('/packages/engine/appState.ts') ||
            id.includes('/packages/engine/types.ts') ||
            id.includes('/packages/element/') ||
            id.includes('/packages/common/') ||
            id.includes('/packages/math/') ||
            id.includes('/packages/utils/')
          ) {
            return 'sveltedraw-engine';
          }
        },
      },
    },
  },
});

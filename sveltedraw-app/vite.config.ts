import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';

const resolve = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  plugins: [
    svelte(),
    // Service-worker + install manifest. Lifted from upstream's
    // excalidraw-app/vite.config.mts; the caching rules are tuned for
    // Excalidraw's asset shape (fonts, locales, chunk names).
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
        // are larger than upstream's React equivalents.
      },
      manifest: {
        short_name: 'Sveltedraw',
        name: 'Sveltedraw',
        description:
          'Svelte port of Excalidraw — a whiteboard tool for sketching hand-drawn diagrams.',
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
      { find: /^@excalidraw\/excalidraw$/, replacement: resolve('../packages/excalidraw/index.tsx') },
      { find: /^@excalidraw\/excalidraw\/(.*)/, replacement: resolve('../packages/excalidraw/$1') },
      { find: /^@excalidraw\/common$/, replacement: resolve('../packages/common/src/index.ts') },
      { find: /^@excalidraw\/common\/(.*)/, replacement: resolve('../packages/common/src/$1') },
      { find: /^@excalidraw\/element$/, replacement: resolve('../packages/element/src/index.ts') },
      { find: /^@excalidraw\/element\/(.*)/, replacement: resolve('../packages/element/src/$1') },
      { find: /^@excalidraw\/math$/, replacement: resolve('../packages/math/src/index.ts') },
      { find: /^@excalidraw\/math\/(.*)/, replacement: resolve('../packages/math/src/$1') },
      { find: /^@excalidraw\/utils$/, replacement: resolve('../packages/utils/src/index.ts') },
      { find: /^@excalidraw\/utils\/(.*)/, replacement: resolve('../packages/utils/src/$1') },
      { find: /^@sveltedraw\/excalidraw$/, replacement: resolve('../packages/excalidraw-svelte/src/index.ts') },
    ],
  },
  build: {
    target: 'esnext',
  },
});

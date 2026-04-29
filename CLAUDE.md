# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

**Sveltedraw** is a Svelte 5 virtual whiteboard editor. The repo is a yarn workspace monorepo: a Vite app (`sveltedraw-app/`) loads the editor (`packages/editor/`), which in turn consumes a headless drawing engine (`packages/engine/`) plus shared packages (`packages/{common, element, math, utils}/`).

## Layout

- **`sveltedraw-app/`** — Vite + Svelte 5 application (the thing you run). Entry `src/App.svelte` routes by URL hash to `Showcase` or the editor app.
- **`packages/editor/`** — Svelte editor component, panels, dialogs, and feature modules: `engine/`, `state/`, `components/`, `icons/`, plus feature dirs (`alignment/`, `autolayout/`, `collab/`, `connectors/`, `export/`, `history/`, `layers/`, `library/`, `measurements/`, `presentation/`, `snap/`, `templates/`, `texteditor/`).
- **`packages/engine/`** — headless drawing engine (scene, renderer, data, fonts, clipboard, appState, types). Subpath imports only — no bare entry point. Example: `@sveltedraw/engine/scene/Renderer`.
- **`packages/{common, element, math, utils}/`** — shared engine packages, imported via `@sveltedraw/<name>` aliases (see `vite.config.ts` and `vitest.config.mts`).

## Commands

All commands run from the repo root unless noted.

```bash
yarn start              # Dev server (Vite, port 3001, opens browser)
yarn build              # Production build of sveltedraw-app
yarn preview            # Preview the built app
yarn smoke              # Puppeteer smoke test that the app mounts

yarn check:svelte       # svelte-check (Svelte + TS diagnostics) — preferred for .svelte files
yarn test:typecheck     # tsc across the monorepo
yarn test:app           # vitest (jsdom)
yarn test:app path/to/file.test.ts          # single file
yarn test:app -t "name pattern"             # single test by name
yarn test:update        # vitest --update --watch=false (snapshot regen, run before commits)
yarn test:all           # typecheck + prettier check + vitest

yarn test:puppeteer            # Full puppeteer test runner (4 workers)
yarn test:puppeteer:fast       # Fast subset

yarn fix                # prettier --write
```

Engine packages have their own ESM builds (`yarn build:packages`), but the app consumes them via Vite aliases — you almost never need to rebuild them during dev.

## Architecture notes

- **Aliases are the source of truth for imports.** `vite.config.ts` and `vitest.config.mts` declare matching alias sets. If you add a new top-level path, mirror it in both.
- **Two `App.svelte` files exist** and they are different: `sveltedraw-app/src/App.svelte` is the app shell (hash router); `packages/editor/src/App.svelte` is the editor itself. Don't confuse them.
- **Manual chunking** in `vite.config.ts` splits `sveltedraw-engine` (scene/renderer/data/fonts + element/common/math/utils) from app code so the engine cache survives app changes. When moving files between those boundaries, recheck the `manualChunks` predicate.
- **Svelte 5 runes** (`$state`, `$derived`, `$effect`) are in use throughout. See `feedback_svelte5_derived_tracking.md` in memory: `$derived` tracking can drop across function-call boundaries — access reactive proxies inline, not via helper functions.
- **bits-ui** is the UI primitive library. Vite needs explicit `conditions: ['svelte', 'browser', 'module', 'import', 'default']` because bits-ui's `exports` field omits `default`/`import`.

## Conventions

- Snapshot tests: run `yarn test:update` before committing test changes.
- Prettier config lives in `.prettierrc.json`; `yarn fix` is the canonical formatter. CI runs `prettier --list-different` via `yarn test:other`.
- Node ≥ 18, Yarn 1.22 (classic, via `packageManager` field). Workspaces, not pnpm.

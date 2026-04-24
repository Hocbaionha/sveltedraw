# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

**Sveltedraw** is a Svelte 5 port of Excalidraw. It is a fork: the upstream React `excalidraw-app/` was deleted in Phase 9 and replaced by `sveltedraw-app/` + `packages/excalidraw-svelte/`. The original `packages/excalidraw/` still exists but is now a **headless engine** (scene, renderer, data, fonts, clipboard, appState, types) consumed via subpath imports — there is no longer a bare `@excalidraw/excalidraw` entry. React is not a runtime dependency.

The port runs in phases (currently past Phase 16 — see `MEMORY.md` and the various `*-PLAN.md` / `PHASE-*.md` notes at the repo root for status).

## Layout

- **`sveltedraw-app/`** — Vite + Svelte 5 application (the thing you run). Entry `src/App.svelte` routes by URL hash to `Showcase` or `SveltedrawApp`.
- **`packages/excalidraw-svelte/`** — Svelte port of the editor UI. Published surface in `src/index.ts`; subdirs `engine/`, `state/`, `components/`, `icons/`, plus feature dirs (`alignment/`, `autolayout/`, `connectors/`, `export/`, `history/`, `layers/`, `library/`, `measurements/`, `presentation/`, `snap/`, `templates/`, `texteditor/`).
- **`packages/excalidraw/`** — headless engine (was the React package). Only subpath imports work — e.g. `@excalidraw/excalidraw/scene/Renderer`. Do not add a barrel re-export.
- **`packages/{common,element,math,utils}/`** — shared engine packages, imported via `@excalidraw/<name>` aliases (see `vite.config.ts` and `vitest.config.mts`).

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
- **Two `App.svelte` files exist** and they are different: `sveltedraw-app/src/App.svelte` is the app shell (hash router); `packages/excalidraw-svelte/src/App.svelte` is the editor itself. Don't confuse them.
- **Manual chunking** in `vite.config.ts` splits `excalidraw-engine` (scene/renderer/data/fonts + element/common/math/utils) from app code so the engine cache survives app changes. When moving files between those boundaries, recheck the `manualChunks` predicate.
- **Svelte 5 runes** (`$state`, `$derived`, `$effect`) are in use throughout. See `feedback_svelte5_derived_tracking.md` in memory: `$derived` tracking can drop across function-call boundaries — access reactive proxies inline, not via helper functions.
- **bits-ui** is the UI primitive library. Vite needs explicit `conditions: ['svelte', 'browser', 'module', 'import', 'default']` because bits-ui's `exports` field omits `default`/`import`.

## Conventions

- Snapshot tests: run `yarn test:update` before committing test changes.
- Prettier config comes from `@excalidraw/prettier-config`; `yarn fix` is the canonical formatter. CI runs `prettier --list-different` via `yarn test:other`.
- Node ≥ 18, Yarn 1.22 (classic, via `packageManager` field). Workspaces, not pnpm.
- The repo root is littered with `test-*.js`, `*-PLAN.md`, `*-STATUS.md`, screenshots, and log files from prior phase work. They are scratch/handoff artifacts — don't treat their presence as a convention to follow when adding new files.

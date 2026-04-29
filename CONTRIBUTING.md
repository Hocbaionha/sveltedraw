# Contributing

Sveltedraw is a Svelte 5 port of Excalidraw. The drawing engine and
file format come from upstream; the UI, collaboration layer, and
Svelte-side architecture are this fork's contributions.

## Setup

```bash
yarn install
yarn start    # dev server on :3001
```

Node ≥ 18, Yarn 1.22 (classic, declared via `packageManager`). pnpm is
not supported — the engine packages ship workspace-relative ESM that
yarn workspaces resolve in place via Vite aliases.

## Before opening a PR

- `yarn check:svelte` — Svelte + TypeScript diagnostics.
- `yarn test:typecheck` — `tsc` across the monorepo.
- `yarn test:app` — vitest (jsdom).
- `yarn fix` — Prettier (project config; CI gates on `--list-different`).
- For honest-tests under `sveltedraw-app/scripts/honest-tests/`, run
  the relevant script after changes that touch its surface area.

## Code style

- See `CLAUDE.md` for the working conventions (Svelte 5 runes, alias
  rules, manual-chunk boundaries, comment policy).
- Prefer editing existing files over creating new ones.
- Keep upstream-derived code (`packages/{excalidraw,common,element,math,utils}/`)
  minimally diverged from Excalidraw to preserve future merge paths.

## Upstream attribution

When porting a React component to Svelte, retain a top-of-file comment
identifying the upstream source path. Example:

```svelte
// Port of packages/excalidraw/components/Dialog.tsx
```

This makes upstream regressions traceable and keeps the merge-back path
open if a feature changes upstream.

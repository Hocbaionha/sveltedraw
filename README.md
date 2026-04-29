<h1 align="center">Sveltedraw</h1>

<p align="center">
  An open-source virtual hand-drawn whiteboard, built on Svelte 5.
</p>

<p align="center">
  <a href="https://github.com/Hocbaionha/sveltedraw/blob/master/LICENSE">
    <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  </a>
</p>

---

## What this is

Sveltedraw is a virtual whiteboard editor — an infinite canvas with
hand-drawn-style shapes, text, freehand strokes, arrows, and frames.
The editor UI is built natively in Svelte 5; a headless drawing engine
handles canvas rendering, scene graph, and file format under the hood.

Collaborative editing over Y.js + WebSocket is supported.

## Getting started

```bash
yarn install     # node ≥ 18, yarn 1.22 (classic, via "packageManager")
yarn start       # dev server on port 3001
yarn build       # production build of sveltedraw-app/
yarn smoke       # puppeteer smoke test that the app mounts
```

## Layout

- `sveltedraw-app/` — Vite + Svelte 5 application (the thing you run).
- `packages/editor/` — the Svelte editor: panels, dialogs, and feature
  modules (alignment, autolayout, connectors, collab, export, history,
  layers, library, presentation, snap, templates, texteditor, …).
- `packages/engine/` — headless drawing engine (scene, renderer, data,
  fonts, clipboard). Subpath imports only.
- `packages/{common, element, math, utils}/` — shared engine packages,
  imported via `@sveltedraw/<name>` aliases.

## Testing

```bash
yarn check:svelte         # svelte-check (Svelte + TS diagnostics)
yarn test:typecheck       # tsc across the monorepo
yarn test:app             # vitest (jsdom)
yarn test:puppeteer       # full puppeteer suite (4 workers)
yarn test:puppeteer:fast  # fast subset
```

Honest-tests live under `sveltedraw-app/scripts/honest-tests/` and
cover end-to-end paths the unit tests cannot (multi-tab collaboration,
PNG metadata round-trip, presentation slicing, …).

## License

MIT.

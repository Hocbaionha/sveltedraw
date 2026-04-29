<h1 align="center">Sveltedraw</h1>

<p align="center">
  An open-source virtual hand-drawn style whiteboard. Svelte 5 port of
  the Excalidraw editor.
</p>

<p align="center">
  <a href="https://github.com/Hocbaionha/sveltedraw/blob/master/LICENSE">
    <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  </a>
</p>

---

## What this is

Sveltedraw is a fork of [Excalidraw](https://github.com/excalidraw/excalidraw)
that replaces the React UI with a Svelte 5 application. The editor
component, state stores, panels, dialogs, presentation mode, library, and
collaboration layer are all native Svelte. The original React editor
shell (`excalidraw-app/`) has been deleted; React is no longer a runtime
dependency.

The drawing engine itself — scene graph, renderer, element math, fonts,
clipboard, file format — is preserved as a headless engine under
`packages/excalidraw/` and consumed by the Svelte UI through subpath
imports.

## Status

Past Phase 17 — collaborative editing over Y.js + WebSocket is in. See
`MEMORY.md` for the running progress log.

## Getting started

```bash
yarn install     # node ≥ 18, yarn 1.22 (classic, via "packageManager")
yarn start       # dev server on port 3001
yarn build       # production build of sveltedraw-app/
yarn smoke       # puppeteer smoke test that the app mounts
```

## Layout

- `sveltedraw-app/` — Vite + Svelte 5 application (the thing you run).
- `packages/excalidraw-svelte/` — the editor component, panels, and all
  feature modules (alignment, autolayout, connectors, export, history,
  layers, library, presentation, snap, templates, texteditor, …).
- `packages/excalidraw/` — headless engine (scene, renderer, data,
  fonts). Subpath imports only; the bare entry point is gone.
- `packages/{common,element,math,utils}/` — shared engine packages,
  imported via `@excalidraw/<name>` aliases.

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

## Credits

Sveltedraw is a fork of [Excalidraw](https://github.com/excalidraw/excalidraw).
The drawing engine, file format, and rendering pipeline come from the
upstream project. The Svelte UI, collaboration layer, and the
re-architected packaging are this fork's contributions.

## License

MIT — same as upstream.

# @sveltedraw/engine

Sveltedraw headless drawing engine. Contains the scene graph, canvas
renderer, font loader, file format codec, clipboard, and shared
appState — everything React-free that was originally part of upstream
Excalidraw's `@excalidraw/excalidraw` package.

The Svelte editor (`@sveltedraw/excalidraw`) consumes this engine
through subpath imports such as `@sveltedraw/engine/scene/Renderer`
and `@sveltedraw/engine/data`. There is no bare entry point — UI
components, actions, and hooks were removed in Phase 9 when the
React shell was deleted.

Forked from upstream Excalidraw and adapted for the Svelte port.
Workspace-internal — not published to npm.

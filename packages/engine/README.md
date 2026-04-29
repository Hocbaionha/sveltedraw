# @sveltedraw/engine

Sveltedraw headless drawing engine. Contains the scene graph, canvas
renderer, font loader, file format codec, clipboard, and shared
appState — the React-free runtime the editor depends on.

The Svelte editor (`@sveltedraw/editor`) consumes this engine through
subpath imports such as `@sveltedraw/engine/scene/Renderer` and
`@sveltedraw/engine/data`. There is no bare entry point.

Workspace-internal package; not published to npm.

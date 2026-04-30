# Plugin system

The Sveltedraw editor exposes an Open/Closed extension surface through
the `PluginRegistry`. New features ship by dropping a plugin file in
`packages/editor/src/plugins/builtin/<name>/` (or by passing an external
plugin through the editor's `plugins` prop) without modifying
`App.svelte`, `UtilityBar`, `MainMenu`, or any other built-in component.

## Anatomy of a plugin

Every plugin is a tiny object:

```ts
import type { SveltedrawPlugin, SveltedrawPluginContext } from "@sveltedraw/editor";

export const myPlugin: SveltedrawPlugin = {
  id: "scope/my-plugin",
  install(ctx: SveltedrawPluginContext): () => void {
    const removeButton = ctx.addToolbarItem({ /* … */ });
    return () => removeButton();
  },
};
```

The `install` callback returns a cleanup function that the registry
runs on uninstall. Every `add*` and `provideStore` call also returns
its own per-item cleanup; the registry tracks them so a plugin author
who forgets to wire one into the cleanup still gets it released on
uninstall.

## Surfaces available through `ctx`

| Surface | API | Lands at |
|---|---|---|
| Toolbar button | `ctx.addToolbarItem(item)` | `<UtilityBar>`, grouped by `item.group` |
| Side panel | `ctx.addSidePanel(panel)` | App.svelte panel slot |
| Canvas overlay | `ctx.addCanvasOverlay(overlay)` | Above the three canvas layers, sorted by `zIndex` |
| Main menu item | `ctx.addMainMenuItem(item)` | Burger menu, after built-ins |
| Publish a store | `ctx.provideStore(KEY, store)` | Symbol-keyed registry |
| Read a store | `ctx.getStore<T>(KEY)` | Registry → Svelte context fallback |
| Editor API | `ctx.api` | Full `SveltedrawAPI` (scene, appState, history, export, …) |
| Tunnels | `ctx.tunnels` | per-instance `TunnelsContext` for slot mounts |
| Subscriptions | `ctx.onSceneChange / onSelectionChange / onToolChange` | proxies to `api.on…` |

## Built-in plugins ship from this directory

`packages/editor/src/plugins/builtin/<name>/`. App.svelte imports the
aggregated `builtinPlugins` array and prepends it to the host's
`plugins` prop. To disable a built-in, the host passes a filtered list:

```svelte
<SveltedrawApp
  plugins={[
    ...builtinPlugins.filter((p) => p.id !== "builtin/help"),
    myCustomPlugin,
  ]}
/>
```

## Migration pattern: inline feature → plugin

The existing built-ins (recent-files, settings, help, templates) follow
the same shape and can be used as templates for new extractions:

1. Create `plugins/builtin/<name>/`:
   - `state.svelte.ts` — `createState()` returning a `$state` object
   - `PanelHost.svelte` — module-level `bindPanelHost(b)` shim that
     mounts the existing component when `state.open === true`. This
     lets the registry's `addSidePanel(panel.component)` contract stay
     parameter-less while plugin code still closes over its state.
   - `Icon.svelte` — inline SVG (don't depend on the editor's icon
     registry)
   - `index.ts` — `install()` wiring all of the above
2. Strip from App.svelte: state declarations, helper functions, render
   block (`{#if showFoo}<FooPanel/>{/if}`), import.
3. Strip from UtilityBar.svelte: `onOpenFoo` prop + the hardcoded
   `<button>` that calls it.
4. Hotkey delegation: replace the inline `showFoo = true` in the
   keydown handler with
   `pluginRegistry.getStore<FooStore>(FOO_STORE_KEY)?.open()`.
5. Add to `plugins/builtin/index.ts` `builtinPlugins` array.
6. Re-export from `packages/editor/src/index.ts` so hosts can disable
   the plugin or import its store key for direct access.

## Verification

Each plugin extraction must keep these green:
- `node ./node_modules/svelte-check/bin/svelte-check --tsconfig ./sveltedraw-app/tsconfig.json` — baseline 20/23/6
- `yarn smoke` (regular smoke) — 90 PASS / 33 FAIL baseline
- The plugin-specific CDP smoke under `sveltedraw-app/scripts/<name>-smoke.mjs`

## What's not yet extracted

The following features still live inline in App.svelte. Their inline
dependencies on hot-path code (pointer handlers, drag math, scene
mutations) make extraction risky without further refactor:

- Layer / History / Library / ShapeLibrary panels
- Alignment / Measurement / AutoLayout / Grid panels
- Connector tool (intersects pointer handler)
- Laser pointer (RAF loop + pointer-move integration)
- ExportPanel (depends on heavy `handleExport`)
- PresentationMode (probe-tested heavily; high regression risk)

Migrating these is "Tier 3" work — see the OCP discussion in the project
memory for the cost/benefit analysis. Tier 1+2 prove the registry
infrastructure is sound; Tier 3 is the ongoing migration pass.

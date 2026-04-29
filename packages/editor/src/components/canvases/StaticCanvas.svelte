<script lang="ts" module>
  //
  // Original renderer types (RoughCanvas, RenderableElementsMap,
  // StaticCanvasRenderConfig, StaticCanvasAppState) are taken structurally
  // (`unknown`/opaque refs). The concrete `renderStaticScene` is injected via
  // a `render` callback so this component stays renderer-agnostic.

  export type StaticCanvasArgs<Config, State> = {
    canvas: HTMLCanvasElement;
    scale: number;
    appState: State;
    renderConfig: Config;
  };
</script>

<script
  lang="ts"
  generics="Config, State extends { width: number; height: number }"
>
  import { untrack } from "svelte";

  let {
    canvas,
    scale,
    appState,
    renderConfig,
    render,
  }: {
    canvas: HTMLCanvasElement;
    scale: number;
    appState: State;
    renderConfig: Config;
    /** Injected renderer — Phase 6 wires `renderStaticScene` from the engine.
     * Called via `untrack(...)` so re-creating the arrow on every parent
     * render doesn't itself cause a re-render; only appState/renderConfig/
     * scale/canvas changes drive redraws. */
    render: (args: StaticCanvasArgs<Config, State>) => void;
  } = $props();

  let wrapperEl: HTMLDivElement | null = $state(null);
  let isMounted = false;

  // Size the canvas element to appState.width/height (CSS + backing store).
  $effect(() => {
    canvas.style.width = `${appState.width}px`;
    canvas.style.height = `${appState.height}px`;
    canvas.width = appState.width * scale;
    canvas.height = appState.height * scale;
  });

  // Mount canvas into wrapper and run the renderer on every change.
  $effect(() => {
    // Track the reactive deps explicitly so changing `render` (identity-only)
    // doesn't retrigger; only real data changes do.
    const w = wrapperEl;
    const c = canvas;
    const s = scale;
    const state = appState;
    const cfg = renderConfig;
    if (!w) return;
    untrack(() => {
      if (!isMounted) {
        isMounted = true;
        w.replaceChildren(c);
        c.classList.add("sveltedraw__canvas", "static");
      }
      render({ canvas: c, scale: s, appState: state, renderConfig: cfg });
    });
  });
</script>

<div class="sveltedraw__canvas-wrapper" bind:this={wrapperEl}></div>

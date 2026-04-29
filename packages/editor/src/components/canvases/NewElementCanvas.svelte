<script lang="ts" module>
  export type NewElementCanvasArgs<Config, State> = {
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
    appState,
    scale,
    renderConfig,
    render,
  }: {
    appState: State;
    scale: number;
    renderConfig: Config;
    /** Injected renderer — Phase 6 wires `renderNewElementScene`. Called via
     * `untrack(...)` so re-creating the arrow on every parent render doesn't
     * itself trigger a redraw. */
    render: (args: NewElementCanvasArgs<Config, State>) => void;
  } = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);

  $effect(() => {
    const c = canvasEl;
    const s = scale;
    const state = appState;
    const cfg = renderConfig;
    if (!c) return;
    untrack(() =>
      render({ canvas: c, scale: s, appState: state, renderConfig: cfg }),
    );
  });
</script>

<canvas
  class="sveltedraw__canvas"
  style:width={`${appState.width}px`}
  style:height={`${appState.height}px`}
  width={appState.width * scale}
  height={appState.height * scale}
  bind:this={canvasEl}
></canvas>

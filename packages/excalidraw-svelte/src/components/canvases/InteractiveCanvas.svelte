<script lang="ts" module>
  // Port of packages/excalidraw/components/canvases/InteractiveCanvas.tsx
  //
  // Contract:
  //  - Collaborator-cursor render config (remotePointerViewportCoords /
  //    remotePointerButton / remoteSelectedElementIds / remotePointerUsernames
  //    / remotePointerUserStates) is assembled by the caller (uses upstream
  //    types).
  //  - The AnimationController.start(INTERACTIVE_SCENE_ANIMATION_KEY, ...)
  //    loop is owned by the caller. The caller receives the canvas element
  //    via `handleCanvasRef` and starts/stops the animation loop itself
  //    (typically in App.svelte onMount) — cleaner than a per-render callback
  //    prop since the animation lifecycle is coarser.
  //  - Event handlers forwarded raw (pointerdown/up/move/cancel/doubleclick/
  //    contextmenu/touchmove/click).

  export type InteractiveCanvasAppStateLike = {
    width: number;
    height: number;
    viewModeEnabled: boolean;
    activeTool: { type: string };
  };
</script>

<script lang="ts" generics="State extends InteractiveCanvasAppStateLike">
  import { untrack } from "svelte";
  // @ts-ignore upstream
  import { CURSOR_TYPE } from "@sveltedraw/common";

  let {
    appState,
    scale,
    handleCanvasRef,
    oncontextmenu,
    onclick,
    onpointermove,
    onpointerup,
    onpointercancel,
    ontouchmove,
    onpointerdown,
    ondblclick,
    label = "Drawing canvas",
  }: {
    appState: State;
    scale: number;
    /** Called with the canvas element when mounted (Phase 6 stores it for
     * the `renderInteractiveScene` loop + pointer hit-testing). */
    handleCanvasRef: (canvas: HTMLCanvasElement | null) => void;
    oncontextmenu: (event: MouseEvent) => void;
    onclick: (event: MouseEvent) => void;
    onpointermove: (event: PointerEvent) => void;
    onpointerup: (event: PointerEvent) => void;
    onpointercancel: (event: PointerEvent) => void;
    ontouchmove: (event: TouchEvent) => void;
    onpointerdown: (event: PointerEvent) => void;
    ondblclick: (event: MouseEvent) => void;
    label?: string;
  } = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  // Fire `handleCanvasRef` only when the canvas element identity changes
  // (mount/unmount), NOT when the callback prop is replaced with a new
  // inline arrow. `untrack` wraps the callback reference so it isn't a dep.
  $effect(() => {
    const el = canvasEl;
    untrack(() => handleCanvasRef(el));
  });

  const cursor = $derived(
    appState.viewModeEnabled && appState.activeTool.type !== "laser"
      ? CURSOR_TYPE.GRAB
      : CURSOR_TYPE.AUTO,
  );
</script>

<canvas
  bind:this={canvasEl}
  class="sveltedraw__canvas interactive"
  style:width={`${appState.width}px`}
  style:height={`${appState.height}px`}
  style:cursor={cursor}
  width={appState.width * scale}
  height={appState.height * scale}
  {oncontextmenu}
  {onclick}
  {onpointermove}
  {onpointerup}
  {onpointercancel}
  {ontouchmove}
  {onpointerdown}
  ondblclick={appState.viewModeEnabled ? undefined : ondblclick}
>
  {label}
</canvas>

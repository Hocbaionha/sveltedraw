<script lang="ts" module>
  // Phase 6 batches 1 + 2 + 3 — App.svelte shell.
  //
  // Batch 1: state contexts (EDITOR_STORE_KEY / APP_STORE_KEY /
  //   EDITOR_INTERFACE_KEY / TUNNELS_KEY / EXCAL_ID_KEY), canvas refs,
  //   LayerUI mount. No renderer.
  // Batch 2: Scene + Renderer + roughjs construction; static-scene render
  //   wiring (empty Scene paints background + grid); ResizeObserver on the
  //   container; fullscreen-change listener.
  // Batch 3: Interactive-scene AnimationController loop; NewElementCanvas
  //   render wiring; minimal AppClassProperties façade for the interactive
  //   renderer (grep'd 4 touched fields; others unused).
  //
  // What is still intentionally NOT here:
  //  - Event wiring (pointerdown/move/up, keydown/keyup, wheel, touch,
  //    clipboard, drag-and-drop) → batch 4.
  //  - Scene-mutation nonce wiring (Renderer repaints via appState deps only
  //    so far; batch 4 adds a sceneNonce $state bumped on every mutation).
  //  - syncActionResult / actionManager / history integration → batch 5.
  //  - ExcalidrawImperativeAPI (`onExcalidrawAPI` callback) → batch 6.
  //  - textWysiwyg.ts port → batch 7.

  // @ts-ignore — upstream, resolved via Vite alias; tsconfig path mapping
  // only exists in the excalidraw-svelte package, not sveltedraw-app.
  import type { EditorInterface } from "@excalidraw/common";
  import type { LayerUIAppStateLike } from "./components/LayerUI.svelte";

  /**
   * Minimal AppState shape needed by LayerUI + canvas wrappers.
   * Upstream `AppState` has ~80 fields; the runtime value comes from
   * `getDefaultAppState()` (full shape) so passing it to upstream helpers
   * remains structurally sound.
   */
  export type ShellAppState = LayerUIAppStateLike & {
    width: number;
    height: number;
    activeTool: { type: string };
    [key: string]: unknown;
  };
</script>

<script lang="ts">
  import { setContext, untrack, onMount } from "svelte";
  // @ts-ignore — upstream, resolved via Vite alias
  import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
  // @ts-ignore — upstream
  import { Scene } from "@excalidraw/element";
  // @ts-ignore — upstream
  import { Renderer } from "@excalidraw/excalidraw/scene/Renderer";
  // @ts-ignore — upstream
  import { renderStaticScene } from "@excalidraw/excalidraw/renderer/staticScene";
  // @ts-ignore — upstream
  import { renderNewElementScene } from "@excalidraw/excalidraw/renderer/renderNewElementScene";
  // @ts-ignore — upstream
  import { renderInteractiveScene } from "@excalidraw/excalidraw/renderer/interactiveScene";
  // @ts-ignore — upstream
  import { AnimationController } from "@excalidraw/excalidraw/renderer/animation";
  // Inline to avoid pulling @excalidraw/excalidraw/components/canvases/InteractiveCanvas.tsx
  // (which imports from "react"). Upstream value confirmed identical.
  const INTERACTIVE_SCENE_ANIMATION_KEY = "animateInteractiveScene";
  // @ts-ignore — upstream
  import rough from "roughjs/bin/rough";
  // @ts-ignore — upstream, resolved via Vite alias
  // prettier-ignore
  import { getFormFactor, createUserAgentDescriptor, MQ_RIGHT_SIDEBAR_MIN_WIDTH, supportsResizeObserver, POINTER_EVENTS, randomId, viewportCoordsToSceneCoords, DEFAULT_ELEMENT_PROPS, DEFAULT_FONT_FAMILY } from "@excalidraw/common";
  // @ts-ignore — upstream
  import { newElement, newLinearElement, newArrowElement, newFreeDrawElement, hitElementItself, duplicateElements, deepCopyElement } from "@excalidraw/element";
  // @ts-ignore — upstream, resolved via Vite alias
  // prettier-ignore
  import { DEFAULT_COLLISION_THRESHOLD, ELEMENT_TRANSLATE_AMOUNT, ELEMENT_SHIFT_TRANSLATE_AMOUNT, ZOOM_STEP } from "@excalidraw/common";
  // @ts-ignore — upstream
  import { getStateForZoom } from "@excalidraw/excalidraw/scene/zoom";
  // @ts-ignore — upstream
  import { getNormalizedZoom } from "@excalidraw/excalidraw/scene/normalize";
  // @ts-ignore — upstream
  import { pointFrom } from "@excalidraw/math";

  import {
    EDITOR_STORE_KEY,
    APP_STORE_KEY,
    EDITOR_INTERFACE_KEY,
    EXCAL_ID_KEY,
    createEditorStore,
    createAppStore,
    createTunnelsContext,
    TUNNELS_KEY,
  } from "./state/index.js";

  import LayerUI from "./components/LayerUI.svelte";
  import StaticCanvas from "./components/canvases/StaticCanvas.svelte";
  import InteractiveCanvas from "./components/canvases/InteractiveCanvas.svelte";
  import NewElementCanvas from "./components/canvases/NewElementCanvas.svelte";

  let {
    viewModeEnabled = false,
    zenModeEnabled = false,
    gridModeEnabled = false,
    objectsSnapModeEnabled = false,
    theme,
    name,
  }: {
    viewModeEnabled?: boolean;
    zenModeEnabled?: boolean;
    gridModeEnabled?: boolean;
    objectsSnapModeEnabled?: boolean;
    theme?: "light" | "dark";
    name?: string;
  } = $props();

  // ── AppState ───────────────────────────────────────────────────────────
  const initial = untrack(() => ({
    ...getDefaultAppState(),
    theme: theme ?? "light",
    exportWithDarkMode: (theme ?? "light") === "dark",
    isLoading: false,
    viewModeEnabled,
    zenModeEnabled,
    objectsSnapModeEnabled,
    gridModeEnabled,
    name: name ?? "Untitled",
    width: typeof window !== "undefined" ? window.innerWidth : 800,
    height: typeof window !== "undefined" ? window.innerHeight : 600,
    offsetTop: 0,
    offsetLeft: 0,
  }));

  const appState = $state<ShellAppState>(initial as ShellAppState);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const patchAppState = (patch: Partial<ShellAppState>) => {
    for (const [k, v] of Object.entries(patch)) {
      (appState as Record<string, unknown>)[k] = v;
    }
  };

  // ── Editor interface ─────────────────────────────────────────────────
  const uaDesc = createUserAgentDescriptor(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  );
  type MutableEditorInterface = {
    -readonly [K in keyof EditorInterface]: EditorInterface[K];
  };
  const makeEditorInterface = (
    w: number,
    h: number,
  ): MutableEditorInterface => ({
    formFactor: getFormFactor(w, h),
    desktopUIMode: "full",
    userAgent: uaDesc,
    isTouchScreen: typeof window !== "undefined" && "ontouchstart" in window,
    canFitSidebar: w > MQ_RIGHT_SIDEBAR_MIN_WIDTH,
    isLandscape: w > h,
  });

  const editorInterface = $state<MutableEditorInterface>(
    makeEditorInterface(appState.width, appState.height),
  );
  $effect(() => {
    const next = makeEditorInterface(appState.width, appState.height);
    editorInterface.formFactor = next.formFactor;
    editorInterface.canFitSidebar = next.canFitSidebar;
    editorInterface.isLandscape = next.isLandscape;
  });

  // ── Stores + contexts ──────────────────────────────────────────────────
  const editorStore = createEditorStore();
  const appStore = createAppStore();
  const tunnels = createTunnelsContext();

  setContext(EDITOR_STORE_KEY, editorStore);
  setContext(APP_STORE_KEY, appStore);
  setContext(EDITOR_INTERFACE_KEY, editorInterface as EditorInterface);
  setContext(TUNNELS_KEY, tunnels);
  // Use upstream `randomId` (nanoid in prod, deterministic in test) for parity
  // with the React side — `App.tsx` does `this.id = nanoid()`.
  setContext(EXCAL_ID_KEY, randomId());

  // ── Canvas refs ────────────────────────────────────────────────────────
  const staticCanvas =
    typeof document !== "undefined"
      ? document.createElement("canvas")
      : (null as unknown as HTMLCanvasElement);

  let interactiveCanvasEl: HTMLCanvasElement | null = null;
  // Set by the InteractiveCanvas wrapper once the <canvas> mounts. We start
  // the AnimationController here (not on mount above) because the canvas
  // element is created inside the wrapper — its ref only exists post-mount.
  const handleInteractiveCanvasRef = (el: HTMLCanvasElement | null) => {
    interactiveCanvasEl = el;
    if (el) startInteractiveAnimation();
  };

  // ── Container ref ─────────────────────────────────────────────────────
  let containerEl: HTMLDivElement | null = $state(null);

  // ── Scene + Renderer + RoughCanvas ───────────────────────────────────
  // Constructed on mount (need DOM access for rough.canvas()). Kept in
  // non-reactive locals because the renderer reads them by reference.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scene: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let renderer: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rc: any = null;

  // Bumped after construction so the static-render $effect can trigger its
  // first paint once the Scene/Renderer are ready.
  let sceneReady = $state(0);

  // Static render callback — assembles StaticSceneRenderConfig per frame and
  // calls renderStaticScene. An empty Scene renders background + grid only.
  //
  // IMPORTANT (batch 4 gotcha): `Renderer.getRenderableElements` is wrapped
  // with upstream `memoize` (`Renderer.ts:26`). Memoize keys on argument
  // IDENTITY. Mutating nested state (`appState.zoom.value = 2`) keeps the
  // same object ref → memoize hit → canvas won't repaint. Use replace-style
  // mutations for any object-valued AppState field touched by this function
  // (`zoom`, `gridSize`, `gridStep` etc.) — e.g. `appState.zoom = { ...appState.zoom, value: 2 }`.
  const staticRender = () => {
    if (!renderer || !scene || !rc) return;

    // `newElementId` is used by the Renderer to bust its memoized cache on
    // first render of a freshly-created element. In batch 2 we have no
    // `newElement` yet (no pointer wiring), so always `undefined`.
    const { elementsMap, visibleElements } = renderer.getRenderableElements({
      zoom: appState.zoom,
      offsetLeft: appState.offsetLeft,
      offsetTop: appState.offsetTop,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      height: appState.height,
      width: appState.width,
      editingTextElement: appState.editingTextElement,
      newElementId: undefined,
      sceneNonce: scene.getSceneNonce(),
    });

    // Upstream `StaticSceneRenderConfig` pins exact AppState shape; our
    // `ShellAppState` is structurally a superset but TypeScript can't verify
    // the 20+ individual fields match without dragging the full AppState
    // type in (which pulls React types). Runtime value is sound since the
    // initial state came from `getDefaultAppState()`.
    renderStaticScene(
      {
        canvas: staticCanvas,
        rc,
        elementsMap,
        allElementsMap: scene.getNonDeletedElementsMap(),
        visibleElements,
        scale,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        appState: appState as any,
        renderConfig: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          canvasBackgroundColor: appState.viewBackgroundColor as any,
          imageCache: new Map(),
          renderGrid: !!appState.gridModeEnabled,
          isExporting: false,
          embedsValidationStatus: new Map(),
          elementsPendingErasure: new Set(),
          pendingFlowchartNodes: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          theme: appState.theme as any,
        },
      },
      /* throttle */ false,
    );
  };

  // Device pixel ratio for canvas backing store. React App.tsx recomputes DPR
  // inside `onResize` (window.resize fires on DPR change, e.g. moving the
  // window to a different-DPI monitor). We mirror that by holding DPR in a
  // $state and refreshing it from `measure()`.
  let dpr = $state(
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  );
  const scale = $derived(dpr);

  // Shared StaticCanvasRenderConfig builder — the static renderer and the
  // new-element renderer both want the same `renderConfig` shape (the
  // NewElementSceneRenderConfig literally reuses StaticCanvasRenderConfig).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeStaticRenderConfig = (): any => ({
    canvasBackgroundColor: appState.viewBackgroundColor,
    imageCache: new Map(),
    renderGrid: !!appState.gridModeEnabled,
    isExporting: false,
    embedsValidationStatus: new Map(),
    elementsPendingErasure: new Set(),
    pendingFlowchartNodes: null,
    theme: appState.theme,
  });

  // NewElementCanvas render callback. Args from the wrapper give us the
  // internal <canvas> element + scale. We supply scene + elementsMap +
  // allElementsMap + newElement + rc. NewElementSceneRenderConfig does NOT
  // require `app: AppClassProperties` (unlike interactive scene), so this
  // wires cleanly without a façade.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newElementRender = (args: any) => {
    if (!renderer || !scene || !rc) return;
    const { elementsMap } = renderer.getRenderableElements({
      zoom: appState.zoom,
      offsetLeft: appState.offsetLeft,
      offsetTop: appState.offsetTop,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      height: appState.height,
      width: appState.width,
      editingTextElement: appState.editingTextElement,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newElementId: (appState.newElement as any)?.id,
      sceneNonce: scene.getSceneNonce(),
    });
    renderNewElementScene(
      {
        canvas: args.canvas,
        scale: args.scale,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newElement: appState.newElement as any,
        elementsMap,
        allElementsMap: scene.getNonDeletedElementsMap(),
        rc,
        renderConfig: makeStaticRenderConfig(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        appState: appState as any,
      },
      /* throttle */ false,
    );
  };

  // Minimal AppClassProperties façade consumed by renderInteractiveScene.
  // Grep of interactiveScene.ts shows only 4 `app.*` touches:
  //   app.state.bindMode, app.bindModeHandler, app.lastPointerMoveCoords{.x,.y}
  // Those each default to a no-op-safe value for batch 3 (no event wiring
  // yet). Batch 4 will replace this with a real App.svelte-backed view once
  // pointer/keyboard wiring lands.
  const appFacade = {
    get state() {
      return appState;
    },
    bindModeHandler: null,
    lastPointerMoveCoords: null,
    lastViewportPosition: { x: 0, y: 0 },
  };

  // Interactive scene AnimationController loop. Starts once the canvas ref
  // is delivered by the InteractiveCanvas wrapper. The callback runs on
  // each RAF tick, reads CURRENT appState + scene (closed-over), and feeds
  // renderInteractiveScene.
  function startInteractiveAnimation() {
    if (AnimationController.running(INTERACTIVE_SCENE_ANIMATION_KEY)) return;
    AnimationController.start(
      INTERACTIVE_SCENE_ANIMATION_KEY,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ deltaTime, state }: any) => {
        // Test-only liveness signal: smoke scripts read this to verify the
        // animation loop actually ticks (vs "registered but not running").
        // DEV-only — stripped from production builds.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((import.meta as any).env?.DEV) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__sveltedrawInteractiveTicks =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((window as any).__sveltedrawInteractiveTicks ?? 0) + 1;
        }

        if (!renderer || !scene || !interactiveCanvasEl) {
          // Keep animation alive until scene is ready; returning a truthy
          // state re-enqueues this key for the next tick.
          return state ?? { bindingHighlight: undefined };
        }
        const { elementsMap, visibleElements } =
          renderer.getRenderableElements({
            zoom: appState.zoom,
            offsetLeft: appState.offsetLeft,
            offsetTop: appState.offsetTop,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            height: appState.height,
            width: appState.width,
            editingTextElement: appState.editingTextElement,
            newElementId: undefined,
            sceneNonce: scene.getSceneNonce(),
          });

        // Build selectedElements list for this tick (batch 6 wires).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const selectedIds = (appState as any).selectedElementIds ?? {};
        const selectedElements: unknown[] = [];
        for (const el of visibleElements) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (selectedIds[(el as any).id]) selectedElements.push(el);
        }

        const result = renderInteractiveScene({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          app: appFacade as any,
          canvas: interactiveCanvasEl,
          elementsMap,
          visibleElements,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          selectedElements: selectedElements as any,
          allElementsMap: scene.getNonDeletedElementsMap(),
          scale,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          appState: appState as any,
          renderConfig: {
            remotePointerViewportCoords: new Map(),
            remotePointerButton: new Map(),
            remoteSelectedElementIds: new Map(),
            remotePointerUsernames: new Map(),
            remotePointerUserStates: new Map(),
            selectionColor: "#6965db",
            lastViewportPosition: { x: 0, y: 0 },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editorInterface: editorInterface as any,
          callback: () => {
            // batch 5 wires renderInteractiveSceneCallback for scrollbars
            // + scrolledOutside state updates.
          },
          animationState: state,
          deltaTime,
        });

        // Keep the loop alive regardless of whether any animation state is
        // active (returning `undefined` stops the key). For batch 3 we run
        // every tick to keep parity with React; batch 4+ can short-circuit
        // when no selection/hover changes are pending.
        return result.animationState ?? { bindingHighlight: undefined };
      },
    );
  }

  // Parent-owned static-render driver. We pass a no-op `render` prop to the
  // StaticCanvas wrapper and run renderStaticScene here as a top-level
  // $effect instead. Rationale: the wrapper's internal $effect tracks only
  // {canvas, scale, appState, renderConfig} by design (it's generic), but
  // we need to react to Scene mutations too (via `scene.getSceneNonce()`)
  // plus `sceneReady` flipping on mount. Doing it here gives us a single
  // source of truth for "when to paint."
  $effect(() => {
    // reactive deps (read explicitly so Svelte tracks them all)
    void sceneReady;
    void scale;
    void appState.width;
    void appState.height;
    void appState.zoom;
    void appState.scrollX;
    void appState.scrollY;
    void appState.offsetLeft;
    void appState.offsetTop;
    void appState.theme;
    void appState.viewBackgroundColor;
    void appState.gridModeEnabled;
    staticRender();
  });

  // NewElementCanvas repaint: the wrapper's internal $effect tracks only
  // its direct props (canvas/scale/appState/renderConfig). We force it to
  // re-fire on newElement changes by including `newElement` identity in
  // the `appState` prop literal we pass — Svelte batches the $state reads
  // into the derived shape, so a fresh object-identity on newElement busts
  // the wrapper's memo via the appState prop's reference changing.
  //
  // No explicit $effect needed here; the reactive chain is:
  //   user drag → appState.newElement = {...} (fresh identity)
  //     → template re-runs (reads newElement)
  //     → NewElementCanvas gets fresh appState prop literal
  //     → its $effect fires
  //     → calls our `newElementRender` which reads appState.newElement.

  // ── onMount: construct Scene + Renderer + RoughCanvas ────────────────
  onMount(() => {
    scene = new Scene();
    renderer = new Renderer(scene);
    rc = rough.canvas(staticCanvas);

    // Attempt to hydrate from localStorage BEFORE seeding history so the
    // initial history floor captures the restored state, not "empty".
    tryLoad();
    sceneReady++; // triggers the first static paint

    // Seed history with the CURRENT state (empty or restored).
    // IMPORTANT: pushHistory schedules a save. When loaded from localStorage
    // this save is a no-op overwrite (same bytes), not a problem; the
    // alternative (conditional push based on tryLoad result) would leave a
    // loaded session WITHOUT an undo floor.
    pushHistory();

    // Test-only probe: smoke scripts read `window.__sveltedrawProbe` to
    // inspect live scene + appState. DEV-only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((import.meta as any).env?.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__sveltedrawProbe = { appState, scene };
    }

    // ── ResizeObserver on container (replaces window-resize from batch 1) ─
    // Window resize is kept as a fallback for browsers without RO support
    // (none in practice; `supportsResizeObserver` is true everywhere modern).
    const measure = () => {
      if (!containerEl) return;
      const rect = containerEl.getBoundingClientRect();
      appState.width = rect.width || window.innerWidth;
      appState.height = rect.height || window.innerHeight;
      appState.offsetLeft = rect.left;
      appState.offsetTop = rect.top;
      // DPR can change without a resize (rare — e.g. OS-level zoom toggle);
      // we still read it here because window.resize does fire on DPI changes
      // when the window moves between monitors.
      dpr = window.devicePixelRatio || 1;
    };

    // Fullscreen change — React App.tsx clears activeEmbeddable when
    // fullscreen exits while an embeddable was active. Parity port.
    const onFullscreenChange = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const active = (appState as any).activeEmbeddable;
      if (!document.fullscreenElement && active?.state === "active") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).activeEmbeddable = null;
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);

    // Keydown listener on the container (it's focusable — tabindex=0 set
    // on the container div, matching React's AppRenderHelpers.tsx). Using
    // addEventListener on the element (not window) so multiple editors on
    // one page don't eat each other's keyboard input.
    containerEl?.addEventListener("keydown", onContainerKeyDown);
    const onContainerKeyUp = (event: KeyboardEvent) => {
      if (event.key === " " || event.code === "Space") {
        spaceHeld = false;
      }
    };
    containerEl?.addEventListener("keyup", onContainerKeyUp);

    // Wheel listener — must be non-passive so we can preventDefault on
    // Ctrl+wheel (browser would otherwise page-zoom the page itself).
    // Svelte's `onwheel` prop attaches passively by default, so we go
    // through addEventListener.
    containerEl?.addEventListener("wheel", onContainerWheel, { passive: false });
    // Auto-focus the container on mount so hotkeys work without requiring
    // the user to click first. Matches upstream UX.
    containerEl?.focus({ preventScroll: true });

    let ro: ResizeObserver | null = null;
    if (supportsResizeObserver && containerEl) {
      ro = new ResizeObserver(() => measure());
      ro.observe(containerEl);
    }
    window.addEventListener("resize", measure);
    measure();

    // Flush any pending save on page unload so nothing is lost.
    const onBeforeUnload = () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        saveNow();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      containerEl?.removeEventListener("keydown", onContainerKeyDown);
      containerEl?.removeEventListener("keyup", onContainerKeyUp);
      containerEl?.removeEventListener("wheel", onContainerWheel);
      // Flush the pending save synchronously on unmount too.
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        saveNow();
      }
      AnimationController.cancel(INTERACTIVE_SCENE_ANIMATION_KEY);
      renderer?.destroy?.();
    };
  });

  // ── Batch 4: interaction handlers (Svelte-native port) ───────────────
  //
  // Rationale: upstream `engine/` modules (keyboardOps/pointerEventOps/…) are
  // React-coupled (flushSync, jotai atoms from .tsx files, actions system).
  // Reusing them requires a parallel shadow-monorepo of shims. We port each
  // tool's lifecycle fresh as Svelte-idiomatic code instead — bounded cost
  // per tool, no React baggage in the Svelte bundle.
  //
  // Batch 4 scope: ONE tool (rectangle), end-to-end. Keydown → tool switch,
  // pointerdown → create newElement, pointermove → extend, pointerup → commit.
  // Subsequent batches copy-paste for other shapes and add selection/drag.

  // Map keyboard keys to tool types. Approximates upstream `findShapeByKey`
  // (packages/excalidraw/components/shapes.tsx). Numeric keys are the
  // primary hotkeys; letter aliases match upstream where applicable.
  const TOOL_HOTKEYS: Record<string, string> = {
    "1": "selection",
    "2": "rectangle",
    r: "rectangle",
    R: "rectangle",
    "3": "diamond",
    "4": "ellipse",
    o: "ellipse",
    O: "ellipse",
    "5": "arrow",
    a: "arrow",
    A: "arrow",
    "6": "line",
    l: "line",
    L: "line",
    "7": "freedraw",
    p: "freedraw",
    P: "freedraw",
    x: "freedraw",
    X: "freedraw",
  };

  const setActiveTool = (type: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).activeTool = {
      type,
      customType: null,
      locked: false,
      fromSelection: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastActiveTool: (appState as any).activeTool ?? null,
    };
  };

  // ── Persistence (localStorage) ───────────────────────────────────────
  //
  // Bare-minimum PoC persistence: JSON.stringify scene elements + a small
  // AppState subset (zoom, scroll, viewBackgroundColor, theme, tool,
  // selectedElementIds) into a single localStorage key. Debounced saves
  // (~500ms) so rapid mutations don't thrash storage.
  //
  // Schema versioning: SAVE_KEY includes `:v1`. Bump if the shape changes.
  //
  // Not ported from upstream:
  //   - `restoreAppState` / `restoreElements` (defensive migration chains
  //     for multi-year-old saved data). Our PoC is new; just read/write
  //     the current shape.
  //   - LocalData IndexedDB store (images + library). Out-of-scope here.

  const SAVE_KEY = "sveltedraw:scene:v1";
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const pickPersistedAppState = () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zoom: (appState as any).zoom,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scrollX: (appState as any).scrollX,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scrollY: (appState as any).scrollY,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    viewBackgroundColor: (appState as any).viewBackgroundColor,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    theme: (appState as any).theme,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeTool: (appState as any).activeTool,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedElementIds: (appState as any).selectedElementIds,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gridModeEnabled: (appState as any).gridModeEnabled,
  });

  const saveNow = () => {
    if (!scene || typeof localStorage === "undefined") return;
    try {
      const payload = {
        v: 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        elements: scene.getElementsIncludingDeleted() as any[],
        appState: pickPersistedAppState(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (err) {
      // Quota exceeded / private-mode Safari / disabled storage.
      // Log and move on — loss of persistence is better than a crash.
      console.warn("sveltedraw: save failed", err);
    }
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  };

  const tryLoad = (): boolean => {
    if (!scene || typeof localStorage === "undefined") return false;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.elements)) return false;
      scene.replaceAllElements(parsed.elements, { skipValidation: true });
      // Shallow-merge appState subset. Any missing field falls back to
      // whatever we already have (e.g. width/height come from the live
      // container measure, not the saved snapshot).
      for (const [k, v] of Object.entries(parsed.appState ?? {})) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any)[k] = v;
      }
      return true;
    } catch (err) {
      console.warn("sveltedraw: load failed", err);
      return false;
    }
  };

  // ── History (undo/redo) ──────────────────────────────────────────────
  //
  // Snapshot-based, not delta-based. Upstream's History class is tightly
  // coupled to Store / StoreSnapshot / CaptureUpdateAction; porting that
  // machinery is out-of-scope for a PoC. Snapshots hold a deep clone of
  // every element + a copy of selectedElementIds. Memory cost is O(entry-
  // count × scene-size), acceptable for dozens of edits on small scenes.
  //
  // INVARIANT: `history[historyIndex]` always equals the CURRENT scene state.
  // - Push an initial snapshot on mount (empty scene → history=[empty]).
  // - After ANY durable mutation, call `pushHistory()` to record the NEW state.
  //   This truncates the redo tail (history.length = historyIndex + 1 + new).
  // - `undo()`: if index > 0, dec, apply history[index].
  // - `redo()`: if index < length-1, inc, apply history[index].
  //
  // For gestures (drag, in-progress draw), don't record mid-flight frames:
  // wait until pointerup/commit then push ONE entry. `discardHistoryIfUnchanged`
  // is no longer needed with this model — we simply don't push on no-op.
  type HistorySnapshot = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[];
    selectedElementIds: Record<string, true>;
  };
  const history: HistorySnapshot[] = [];
  let historyIndex = -1;

  const captureSnapshot = (): HistorySnapshot => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const els = scene?.getElementsIncludingDeleted() ?? [];
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elements: els.map((el: any) => deepCopyElement(el)),
      selectedElementIds: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((appState as any).selectedElementIds ?? {}),
      },
    };
  };

  // Push the CURRENT state as the new head (call AFTER a mutation).
  // Truncates the redo tail — any future states past the current index are
  // discarded (standard undo behavior when you edit after undoing).
  // Also schedules a save — pushHistory is the single source of truth for
  // "durable scene change happened".
  const pushHistory = () => {
    const snap = captureSnapshot();
    history.length = historyIndex + 1;
    history.push(snap);
    historyIndex = history.length - 1;
    scheduleSave();
  };

  const applySnapshot = (snap: HistorySnapshot) => {
    if (!scene) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cloned = snap.elements.map((el: any) => deepCopyElement(el));
    scene.replaceAllElements(cloned, { skipValidation: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = { ...snap.selectedElementIds };
    bumpSceneRepaint();
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    historyIndex--;
    applySnapshot(history[historyIndex]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    applySnapshot(history[historyIndex]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getSelectedElements = (): any[] => {
    if (!scene) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectedIds = (appState as any).selectedElementIds ?? {};
    return scene
      .getNonDeletedElements()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((el: any) => selectedIds[el.id]);
  };

  const deleteSelected = () => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    const selectedSet = new Set(selected.map((el) => el.id));
    const remaining = scene
      .getElementsIncludingDeleted()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((el: any) => !selectedSet.has(el.id));
    scene.replaceAllElements(remaining, { skipValidation: true });
    clearSelection();
    pushHistory();
    bumpSceneRepaint();
  };

  const selectAll = () => {
    if (!scene) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next: Record<string, true> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(el as any).locked) next[(el as any).id] = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = next;
    bumpSceneRepaint();
  };

  const duplicateSelected = () => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length === 0) return;

    // `duplicateElements({type: "in-place", idsOfElementsToDuplicate})` —
    // upstream utility handles fractional indices + group id rewriting +
    // bound-element reconciliation. We offset the duplicates slightly so
    // they don't land exactly on top of the originals.
    const elements = scene.getElementsIncludingDeleted();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idsMap = new Map<string, any>(selected.map((el) => [el.id, el]));
    const { elementsWithDuplicates, origIdToDuplicateId } = duplicateElements({
      type: "in-place",
      elements,
      idsOfElementsToDuplicate: idsMap,
      appState: { editingGroupId: null, selectedGroupIds: {} },
      overrides: () => ({ x: 0, y: 0 }), // placeholder; we offset below
    });

    // Offset duplicates by (+10, +10) for visual distinction.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const duplicateIds = new Set<string>(origIdToDuplicateId.values() as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shifted = elementsWithDuplicates.map((el: any) =>
      duplicateIds.has(el.id) ? { ...el, x: el.x + 10, y: el.y + 10 } : el,
    );
    scene.replaceAllElements(shifted, { skipValidation: true });

    // Select the duplicates.
    const nextSel: Record<string, true> = {};
    for (const id of duplicateIds) nextSel[id] = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = nextSel;
    pushHistory();
    bumpSceneRepaint();
  };

  const clearCanvas = () => {
    if (!scene) return;
    scene.replaceAllElements([], { skipValidation: true });
    clearSelection();
    pushHistory();
    bumpSceneRepaint();
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    for (const el of selected) {
      scene.mutateElement(
        el,
        { x: el.x + dx, y: el.y + dy },
        { informMutation: false, isDragging: false },
      );
    }
    // One history entry per nudge keypress. Real editors often coalesce
    // consecutive nudges into a single entry if released within ~500ms;
    // keep it simple for now — user can undo multiple times.
    pushHistory();
    bumpSceneRepaint();
  };

  // ── Zoom + pan ───────────────────────────────────────────────────────
  //
  // Viewport state: `zoom: {value}` (1 = 100%), `scrollX`, `scrollY`.
  // Semantics mirror upstream `getStateForZoom` so scene coords stay stable
  // under the cursor when zooming. Pan just increments scrollX/scrollY by
  // (dx/zoom.value).

  const applyZoom = (nextZoomRaw: number, viewportX: number, viewportY: number) => {
    const nextZoom = getNormalizedZoom(nextZoomRaw);
    const next = getStateForZoom(
      { viewportX, viewportY, nextZoom },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appState as any,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).zoom = next.zoom;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).scrollX = next.scrollX;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).scrollY = next.scrollY;
    scheduleSave(); // viewport state is persisted but not history-tracked
  };

  // Zoom around the container center (used by Ctrl+= / Ctrl+- / Ctrl+0).
  const zoomCentered = (nextZoom: number) => {
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    applyZoom(nextZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const resetZoom = () => zoomCentered(1);

  // Wheel handler. Svelte 5 lets us attach via `onwheel` prop on the
  // canvas; upstream uses a non-passive addEventListener on the container
  // div (because they need preventDefault to stop the browser from
  // navigating/scrolling). Matching that: attach manually in onMount so
  // we can pass `{passive: false}`.
  const onContainerWheel = (event: WheelEvent) => {
    // Don't hijack wheel inside inputs/textarea.
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }
    event.preventDefault();

    // Ctrl/Cmd + wheel → zoom. Also triggered by trackpad pinch on most
    // browsers (reported as ctrlKey even without ctrl pressed).
    if (event.ctrlKey || event.metaKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentZoom = (appState.zoom as any).value;
      // Natural scroll: up (deltaY < 0) zooms in, down zooms out.
      const sign = event.deltaY < 0 ? 1 : -1;
      // Exponential step for smooth pinch/scroll; matches upstream feel.
      const factor = Math.exp((sign * Math.min(Math.abs(event.deltaY), 50)) / 100);
      applyZoom(currentZoom * factor, event.clientX, event.clientY);
      return;
    }

    // Plain wheel: pan. deltaMode=0 (pixels) on most devices; deltaMode=1
    // (lines) on Firefox — multiply by ~16 to approximate.
    const mult = event.deltaMode === 1 ? 16 : 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomV = (appState.zoom as any).value;
    // Shift swaps X/Y panning direction (horizontal scroll convenience).
    if (event.shiftKey && event.deltaX === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).scrollX -= (event.deltaY * mult) / zoomV;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).scrollX -= (event.deltaX * mult) / zoomV;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).scrollY -= (event.deltaY * mult) / zoomV;
    }
    scheduleSave();
  };

  // ── Space-drag / middle-mouse pan ────────────────────────────────────
  let isPanning = false;
  let panStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  let spaceHeld = false;

  const startPan = (clientX: number, clientY: number) => {
    isPanning = true;
    panStart = {
      x: clientX,
      y: clientY,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scrollX: (appState as any).scrollX,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scrollY: (appState as any).scrollY,
    };
  };
  const updatePan = (clientX: number, clientY: number) => {
    if (!panStart) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomV = (appState.zoom as any).value;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).scrollX = panStart.scrollX + (clientX - panStart.x) / zoomV;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).scrollY = panStart.scrollY + (clientY - panStart.y) / zoomV;
  };
  const endPan = () => {
    isPanning = false;
    panStart = null;
    scheduleSave();
  };

  // Defensive wrappers — setPointerCapture throws `NotFoundError` when the
  // pointer session doesn't exist (e.g. synthetic PointerEvents dispatched
  // in tests don't create real pointer sessions). Real browser events are
  // fine, but silently swallow errors so no-op smoke dispatches don't
  // break the interactive loop.
  const tryCapture = (target: HTMLElement | null, pointerId: number) => {
    try {
      target?.setPointerCapture?.(pointerId);
    } catch {
      /* pointer session not active — fine */
    }
  };
  const tryRelease = (target: HTMLElement | null, pointerId: number) => {
    try {
      target?.releasePointerCapture?.(pointerId);
    } catch {
      /* pointer session already gone */
    }
  };

  const onContainerKeyDown = (event: KeyboardEvent) => {
    // Ignore while typing in inputs / textareas / contenteditable.
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    const mod = event.ctrlKey || event.metaKey;

    // ── Ctrl/Cmd + (Shift) shortcuts ──────────────────────────────────
    if (mod && !event.altKey) {
      // Clear canvas: Ctrl+Shift+Delete (or Backspace). Destructive but
      // undoable via Ctrl+Z since `clearCanvas` pushes history.
      if (
        event.shiftKey &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        clearCanvas();
        event.preventDefault();
        return;
      }

      // Undo: Ctrl/Cmd + Z
      // Redo: Ctrl/Cmd + Shift + Z (primary) OR Ctrl + Y (Windows alt)
      if ((event.key === "z" || event.key === "Z") && !event.shiftKey) {
        undo();
        event.preventDefault();
        return;
      }
      if (
        ((event.key === "z" || event.key === "Z") && event.shiftKey) ||
        ((event.key === "y" || event.key === "Y") && !event.shiftKey)
      ) {
        redo();
        event.preventDefault();
        return;
      }

      if (!event.shiftKey) {
        if (event.key === "a" || event.key === "A") {
          selectAll();
          event.preventDefault();
          return;
        }
        if (event.key === "d" || event.key === "D") {
          duplicateSelected();
          event.preventDefault();
          return;
        }
        // Zoom controls: Ctrl+0 / Ctrl+= (+) / Ctrl+- (−). The "+" char on
        // many layouts requires Shift, but browsers fire the "=" key without
        // shift for Ctrl+=, so check both. `NumpadAdd` and `NumpadSubtract`
        // for numeric-pad parity.
        if (event.key === "0") {
          resetZoom();
          event.preventDefault();
          return;
        }
        if (event.key === "=" || event.key === "+") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          zoomCentered((appState.zoom as any).value + ZOOM_STEP);
          event.preventDefault();
          return;
        }
        if (event.key === "-") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          zoomCentered((appState.zoom as any).value - ZOOM_STEP);
          event.preventDefault();
          return;
        }
      }
    }

    // ── Space → temporary pan mode ────────────────────────────────────
    // Pressing space toggles a "grab" cursor and makes pointerdown pan
    // instead of doing its tool-specific action.
    if (event.key === " " || event.code === "Space") {
      if (!spaceHeld) {
        spaceHeld = true;
      }
      event.preventDefault();
      return;
    }

    // ── Delete / Backspace ────────────────────────────────────────────
    if (event.key === "Delete" || event.key === "Backspace") {
      if (getSelectedElements().length > 0) {
        deleteSelected();
        event.preventDefault();
      }
      return;
    }

    // ── Arrow-key nudge (only when selection exists) ──────────────────
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowDown"
    ) {
      if (getSelectedElements().length === 0) return;
      const step = event.shiftKey
        ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
        : ELEMENT_TRANSLATE_AMOUNT;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      nudgeSelected(dx, dy);
      event.preventDefault();
      return;
    }

    // Escape → clear in-progress element + selection + back to selection tool.
    if (event.key === "Escape") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).newElement = null;
      clearSelection();
      setActiveTool("selection");
      bumpSceneRepaint();
      return;
    }

    const nextTool = TOOL_HOTKEYS[event.key];
    if (nextTool) {
      setActiveTool(nextTool);
      event.preventDefault();
    }
  };

  // Scene-nonce bump — forces the static-render $effect to repaint even
  // when no appState field changed (e.g. after scene.replaceAllElements).
  // The $effect tracks sceneReady; we reuse it as a generic "something
  // scene-level happened" ticker.
  const bumpSceneRepaint = () => {
    sceneReady++;
  };

  // Build the AppState slice needed by `viewportCoordsToSceneCoords`.
  // Separate function to keep the conversion site compact.
  const toSceneCoords = (clientX: number, clientY: number) => {
    return viewportCoordsToSceneCoords(
      { clientX, clientY },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        zoom: appState.zoom as any,
        offsetLeft: appState.offsetLeft as number,
        offsetTop: appState.offsetTop as number,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scrollX: appState.scrollX as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scrollY: appState.scrollY as any,
      },
    );
  };

  // Drag state for the in-progress element (rectangle tool) OR for the
  // currently-dragged selection (selection tool).
  let dragStart: { x: number; y: number } | null = null;
  // For selection drag: snapshot of each selected element's x/y at
  // pointerdown time so pointermove can compute absolute positions without
  // accumulating floating-point error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dragOrigins: Array<{ id: string; x: number; y: number; el: any }> = [];

  // Hit-test helper: returns topmost (last-drawn) element at scene coords,
  // or null if empty. Iterates scene elements in reverse document order so
  // the highest-z element wins. Threshold allows a small slop (~10px in
  // scene units) so stroke edges are clickable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hitTestAt = (sceneX: number, sceneY: number): any | null => {
    if (!scene) return null;
    const elements = scene.getNonDeletedElements();
    const elementsMap = scene.getNonDeletedElementsMap();
    // @excalidraw/math's pointFrom returns `GlobalPoint | LocalPoint`
    // (branded types). hitElementItself expects GlobalPoint. Cast is safe —
    // scene coords ARE global coords by definition.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const point = pointFrom(sceneX, sceneY) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const threshold = DEFAULT_COLLISION_THRESHOLD / (appState.zoom as any).value;
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.locked) continue;
      if (
        hitElementItself({
          point,
          element: el,
          threshold,
          elementsMap,
          // Selection click: interior must count even when the element has
          // a transparent background. Without this, only the stroke outline
          // is clickable, which is surprising UX.
          overrideShouldTestInside: true,
        })
      ) {
        return el;
      }
    }
    return null;
  };

  const clearSelection = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = {};
  };

  const selectOnly = (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = { [id]: true };
  };

  const onInteractivePointerDown = (event: PointerEvent) => {
    // ── Pan gesture (middle mouse OR space held OR left+Alt via upstream)
    //    takes precedence over any tool's pointerdown. ────────────────
    if (event.button === 1 || spaceHeld) {
      startPan(event.clientX, event.clientY);
      tryCapture(event.currentTarget as HTMLElement | null, event.pointerId);
      event.preventDefault();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tool = (appState.activeTool as any)?.type;
    const { x, y } = toSceneCoords(event.clientX, event.clientY);

    // ── Selection tool: hit-test, update selection, maybe start drag ──
    if (tool === "selection") {
      const hit = hitTestAt(x, y);
      if (!hit) {
        clearSelection();
        dragStart = null;
        dragOrigins = [];
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sel = (appState as any).selectedElementIds ?? {};
      if (!sel[hit.id]) {
        // Clicking unselected element replaces selection (shift-click for
        // additive selection lands in a later batch).
        selectOnly(hit.id);
      }

      // Snapshot every currently-selected element's origin for the drag.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectedIds = Object.keys((appState as any).selectedElementIds);
      const map = scene.getNonDeletedElementsMap();
      dragOrigins = selectedIds
        .map((id: string) => {
          const el = map.get(id);
          return el ? { id, x: el.x, y: el.y, el } : null;
        })
        .filter(Boolean) as typeof dragOrigins;
      dragStart = { x, y };
      // History recorded on pointerup IF element positions actually changed
      // (see finalize branch). Recording on pointerdown would store the
      // pre-drag state; we want the post-drag state per the invariant.
      tryCapture(event.currentTarget as HTMLElement | null, event.pointerId);
      return;
    }

    // ── Shape tools: create a newElement of the requested type ──
    const drawingTools = new Set([
      "rectangle",
      "diamond",
      "ellipse",
      "line",
      "arrow",
      "freedraw",
    ]);
    if (drawingTools.has(tool)) {
      dragStart = { x, y };
      dragOrigins = [];

      const baseOpts = {
        x,
        y,
        width: 1,
        height: 1,
        strokeColor: DEFAULT_ELEMENT_PROPS.strokeColor,
        backgroundColor: DEFAULT_ELEMENT_PROPS.backgroundColor,
        fillStyle: DEFAULT_ELEMENT_PROPS.fillStyle,
        strokeWidth: DEFAULT_ELEMENT_PROPS.strokeWidth,
        strokeStyle: DEFAULT_ELEMENT_PROPS.strokeStyle,
        roughness: DEFAULT_ELEMENT_PROPS.roughness,
        opacity: DEFAULT_ELEMENT_PROPS.opacity,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let el: any;
      if (tool === "line") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        el = newLinearElement({ ...baseOpts, type: "line", points: [[0, 0]] } as any);
      } else if (tool === "arrow") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        el = newArrowElement({ ...baseOpts, type: "arrow", points: [[0, 0]], endArrowhead: "arrow" } as any);
      } else if (tool === "freedraw") {
        el = newFreeDrawElement({
          ...baseOpts,
          type: "freedraw",
          simulatePressure: true,
          points: [[0, 0]],
          pressures: [0.5],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      } else {
        // rectangle, diamond, ellipse — generic factory.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        el = newElement({ ...baseOpts, type: tool } as any);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).newElement = el;
      tryCapture(event.currentTarget as HTMLElement | null, event.pointerId);
      return;
    }
  };

  const onInteractivePointerMove = (event: PointerEvent) => {
    if (isPanning) {
      updatePan(event.clientX, event.clientY);
      return;
    }
    if (!dragStart) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = (appState as any).newElement;

    const { x, y } = toSceneCoords(event.clientX, event.clientY);

    // ── Drag selected elements ──
    if (dragOrigins.length > 0 && scene) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      for (const origin of dragOrigins) {
        // scene.mutateElement applies the update AND bumps scene nonce via
        // triggerUpdate() — but the static-render $effect doesn't track
        // sceneNonce directly, so we bumpSceneRepaint() ourselves after
        // all mutations to force a repaint in one batch.
        scene.mutateElement(
          origin.el,
          { x: origin.x + dx, y: origin.y + dy },
          { informMutation: false, isDragging: true },
        );
      }
      bumpSceneRepaint();
      return;
    }

    // ── Extending the in-progress newElement (drawing tool) ──
    if (cur) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;

      if (cur.type === "line" || cur.type === "arrow") {
        // Linear elements: x/y stays at drag-start; update points[1] to
        // (dx, dy) so the second vertex tracks the cursor. `points` are
        // LOCAL coords relative to element's x/y.
        const nextPoints = [
          [0, 0],
          [dx, dy],
        ];
        // width/height must equal the points' bounding box; upstream render
        // uses them for dirty-rect. Approximate with abs(dx)/abs(dy), min 1.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).newElement = {
          ...cur,
          points: nextPoints,
          width: Math.abs(dx) || 1,
          height: Math.abs(dy) || 1,
          version: (cur.version ?? 1) + 1,
        };
      } else if (cur.type === "freedraw") {
        // Freedraw: append one point per move event. Points are local
        // (relative to element origin). Keep pressures in lock-step.
        const nextPoints = [...cur.points, [dx, dy]];
        const nextPressures = [...(cur.pressures ?? []), 0.5];
        // Track bbox for width/height so dirty-rect culls correctly.
        let minX = 0, minY = 0, maxX = 0, maxY = 0;
        for (const [px, py] of nextPoints) {
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).newElement = {
          ...cur,
          points: nextPoints,
          pressures: nextPressures,
          width: Math.max(1, maxX - minX),
          height: Math.max(1, maxY - minY),
          version: (cur.version ?? 1) + 1,
        };
      } else {
        // Generic bbox shapes (rectangle, diamond, ellipse).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).newElement = {
          ...cur,
          x: dx < 0 ? dragStart.x + dx : dragStart.x,
          y: dy < 0 ? dragStart.y + dy : dragStart.y,
          width: Math.abs(dx) || 1,
          height: Math.abs(dy) || 1,
          version: (cur.version ?? 1) + 1,
        };
      }
    }
  };

  const onInteractivePointerUp = (event: PointerEvent) => {
    if (isPanning) {
      endPan();
      tryRelease(event.currentTarget as HTMLElement | null, event.pointerId);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = (appState as any).newElement;

    // ── Finalize selection drag ──
    if (dragOrigins.length > 0) {
      // Check if ANY element actually moved. No-move click shouldn't push
      // a history entry (otherwise "click to select" would pollute the
      // undo stack).
      let moved = false;
      for (const origin of dragOrigins) {
        if (origin.el.x !== origin.x || origin.el.y !== origin.y) {
          moved = true;
          break;
        }
      }
      dragOrigins = [];
      dragStart = null;
      if (moved) pushHistory();
      bumpSceneRepaint();
      tryRelease(event.currentTarget as HTMLElement | null, event.pointerId);
      return;
    }

    // ── Finalize in-progress newElement ──
    if (cur) {
      // Per-type commit threshold:
      // - bbox shapes: width & height > 1px
      // - line/arrow: at least a small total distance to avoid 0-length
      // - freedraw: at least 2 points (start + one move)
      let meaningful = false;
      if (cur.type === "line" || cur.type === "arrow") {
        const [, [dx = 0, dy = 0] = []] = cur.points;
        meaningful = Math.hypot(dx, dy) > 2;
      } else if (cur.type === "freedraw") {
        meaningful = (cur.points?.length ?? 0) >= 2;
      } else {
        meaningful = cur.width > 1 && cur.height > 1;
      }
      let committed = false;
      if (meaningful && scene) {
        const existing = scene.getElementsIncludingDeleted();
        // skipValidation: fractional-index validator throws for fresh
        // elements; syncInvalidIndices inside replaceAllElements repairs.
        scene.replaceAllElements([...existing, cur], { skipValidation: true });
        committed = true;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).newElement = null;
      dragStart = null;
      if (committed) pushHistory();
      bumpSceneRepaint();
    }

    tryRelease(event.currentTarget as HTMLElement | null, event.pointerId);
  };

  // No-op passthroughs for events we don't handle yet.
  const noop = () => {};
  const noopRender = () => {};

  const onScrollBackToContent = () => {
    /* batch 5: dispatch actionFinalize / scrollToContent */
  };
  const onToastClose = () => {
    appState.toast = null;
  };

  // Container class composition — parity with React AppRenderHelpers.tsx:674.
  // `excalidraw--view-mode` also flips true for the element-link dialog per
  // upstream logic (dialog makes the canvas non-editable).
  const containerClass = $derived(
    [
      "excalidraw",
      "excalidraw-container",
      "notranslate",
      appState.viewModeEnabled ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState.openDialog as any)?.name === "elementLinkSelector"
        ? "excalidraw--view-mode"
        : "",
      editorInterface.formFactor === "phone" ? "excalidraw--mobile" : "",
    ]
      .filter(Boolean)
      .join(" "),
  );

  // `--ui-pointerEvents` mirrors React: disabled while dragging so UI chrome
  // doesn't eat pointer events mid-gesture. Batch 3 keeps it always enabled
  // since there's no pointer wiring yet.
  const uiPointerEvents = $derived(POINTER_EVENTS.enabled);
</script>

<!-- Container is focusable by design — global keyboard listeners live here.
     Same pattern as upstream React's `AppRenderHelpers.tsx:688` (`tabIndex=0`). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class={containerClass}
  bind:this={containerEl}
  translate="no"
  tabindex="0"
  data-prevent-outside-click
  style="--ui-pointerEvents: {uiPointerEvents}; --right-sidebar-width: 302px;"
>
  <LayerUI
    appState={appState as unknown as LayerUIAppStateLike}
    {onScrollBackToContent}
    {onToastClose}
  />

  <div class="excalidraw-textEditorContainer"></div>
  <div class="excalidraw-contextMenuContainer"></div>
  <div class="excalidraw-eye-dropper-container"></div>

  <StaticCanvas
    canvas={staticCanvas}
    {scale}
    appState={{ width: appState.width, height: appState.height }}
    renderConfig={undefined}
    render={noopRender}
  />

  <InteractiveCanvas
    appState={{
      width: appState.width,
      height: appState.height,
      viewModeEnabled: appState.viewModeEnabled,
      activeTool: appState.activeTool,
    }}
    {scale}
    handleCanvasRef={handleInteractiveCanvasRef}
    oncontextmenu={noop}
    onclick={noop}
    onpointermove={onInteractivePointerMove}
    onpointerup={onInteractivePointerUp}
    onpointercancel={onInteractivePointerUp}
    ontouchmove={noop}
    onpointerdown={onInteractivePointerDown}
    ondblclick={noop}
  />

  <NewElementCanvas
    {scale}
    appState={{
      width: appState.width,
      height: appState.height,
      // Expose newElement identity to the wrapper's effect tracking; the
      // wrapper's $effect reads `appState` (object identity), so including
      // newElement here busts its memo when newElement changes. The field
      // is unused downstream — only the identity change matters.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _newElement: (appState as any).newElement,
    }}
    renderConfig={undefined}
    render={newElementRender}
  />
</div>

<style>
  .excalidraw-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>

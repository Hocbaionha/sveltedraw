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
  import { newElement, newLinearElement, newArrowElement, newFreeDrawElement, newTextElement, newImageElement, hitElementItself, duplicateElements, deepCopyElement } from "@excalidraw/element";
  // @ts-ignore — upstream
  import { DEFAULT_FONT_SIZE, getFontFamilyString } from "@excalidraw/common";
  // @ts-ignore — upstream, resolved via Vite alias
  import { exportToBlob, exportToSvg } from "@excalidraw/utils/export";
  // @ts-ignore — upstream, resolved via Vite alias
  // prettier-ignore
  import { DEFAULT_COLLISION_THRESHOLD, ELEMENT_TRANSLATE_AMOUNT, ELEMENT_SHIFT_TRANSLATE_AMOUNT, ZOOM_STEP, STROKE_WIDTH, COLOR_PALETTE } from "@excalidraw/common";
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          imageCache: imageCacheMap as any,
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
    // Persistent imageCache — populated by insertImageFromBlob. Renderer
    // reads HTMLImage per FileId; if missing (e.g. after reload before
    // re-paste), element draws as a placeholder per upstream behavior.
    imageCache: imageCacheMap,
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

    // Rehydrate image binaries from IndexedDB after the scene has been
    // loaded. Fire-and-forget (bumpSceneRepaint inside triggers repaints
    // as each image loads).
    rehydrateImagesFromIdb();

    // Test-only probe: smoke scripts read `window.__sveltedrawProbe` to
    // inspect live scene + appState + call export helpers directly
    // (avoids having to intercept blob downloads in headless Chrome).
    // DEV-only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((import.meta as any).env?.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__sveltedrawProbe = {
        appState,
        scene,
        exportAsPng,
        exportAsSvg,
      };
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

    // Image paste + drop listeners. Paste goes on document because
    // ClipboardEvent doesn't fire on non-focused divs in all browsers.
    // Drop is on the container to restrict to the editor surface.
    document.addEventListener("paste", onContainerPaste);
    containerEl?.addEventListener("dragover", onContainerDragOver);
    containerEl?.addEventListener("drop", onContainerDrop);
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
      document.removeEventListener("paste", onContainerPaste);
      containerEl?.removeEventListener("dragover", onContainerDragOver);
      containerEl?.removeEventListener("drop", onContainerDrop);
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
    "8": "text",
    t: "text",
    T: "text",
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

  // ── Export ───────────────────────────────────────────────────────────
  //
  // Thin wrappers over upstream `@excalidraw/utils/export`. Those helpers
  // call `restoreAppState` + `restoreElements` defensively, so we can pass
  // our $state proxy cast to any — they migrate/normalize what they need.
  //
  // Download via anchor.click() with a blob URL. Revoke the URL after a
  // tick so Chrome finishes the download before GC.

  const triggerDownload = (blobOrUrl: Blob | string, filename: string) => {
    const url =
      typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (typeof blobOrUrl !== "string") {
      // Revoke after the browser has consumed the URL. setTimeout is the
      // simplest portable tick for this.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const buildExportOpts = () => {
    if (!scene) return null;
    return {
      elements: scene.getNonDeletedElements(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appState: appState as any,
      files: {},
    };
  };

  const exportAsPng = async (): Promise<Blob | null> => {
    const opts = buildExportOpts();
    if (!opts) return null;
    const blob = await exportToBlob({
      ...opts,
      mimeType: "image/png",
    });
    return blob;
  };

  const downloadPng = async () => {
    const blob = await exportAsPng();
    if (!blob) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (appState as any).name || "sveltedraw";
    triggerDownload(blob, `${name}.png`);
  };

  const exportAsSvg = async (): Promise<SVGSVGElement | null> => {
    const opts = buildExportOpts();
    if (!opts) return null;
    // Font inlining enabled — with `EXCALIDRAW_ASSET_PATH = location.origin`
    // (set in main.ts), Excalifont woff2 loads from the Vite dev server
    // and the Patrick Hand fallback is bundled in /public/fonts/. Exported
    // SVG embeds the font bytes as base64 so VN text renders correctly
    // when the file is opened in external viewers.
    const svg = await exportToSvg(opts);
    return svg;
  };

  const downloadSvg = async () => {
    const svg = await exportAsSvg();
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    // Prefix with XML + DOCTYPE so the SVG opens standalone in browsers
    // and graphics apps that are strict about preambles.
    const prelude =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n';
    const blob = new Blob([prelude + source], { type: "image/svg+xml" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (appState as any).name || "sveltedraw";
    triggerDownload(blob, `${name}.svg`);
  };

  // ── IndexedDB for image binaries ─────────────────────────────────────
  //
  // localStorage has a ~5-10MB quota and stores strings — fine for the
  // scene JSON but punitive for image dataURLs. IndexedDB has a much
  // larger quota (often 50%+ of free disk) and handles blobs natively.
  //
  // Schema: one object store "files", keyed by FileId, value = {
  //   id, mimeType, dataURL, created
  // }. We lazy-open the DB on first use, cache the connection.
  //
  // Pipeline:
  // - insertImageFromBlob → ALSO writes to IndexedDB.
  // - On mount, after scene is loaded from localStorage, walk through
  //   image elements + for each missing fileId, fetch from IndexedDB
  //   and repopulate imageCacheMap + binaryFiles.
  const IDB_NAME = "sveltedraw";
  const IDB_STORE = "files";
  const IDB_VERSION = 1;

  const openIdb = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idbPut = async (record: any) => {
    try {
      const db = await openIdb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn("sveltedraw: idb put failed", err);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idbGet = async (id: string): Promise<any | null> => {
    try {
      const db = await openIdb();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(id);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  };

  // Walk the scene's image elements and pull binaries from IndexedDB
  // into imageCacheMap + binaryFiles. Called on mount after tryLoad().
  const rehydrateImagesFromIdb = async () => {
    if (!scene) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageEls = scene.getNonDeletedElements().filter((el: any) => el.type === "image" && el.fileId) as any[];
    if (imageEls.length === 0) return;
    for (const el of imageEls) {
      if (imageCacheMap.has(el.fileId)) continue;
      const record = await idbGet(el.fileId);
      if (!record?.dataURL) continue;
      try {
        const img = await loadImage(record.dataURL);
        imageCacheMap.set(el.fileId, { image: img, mimeType: record.mimeType });
        binaryFiles[el.fileId] = record;
      } catch {
        /* broken dataURL — skip */
      }
    }
    bumpSceneRepaint();
  };

  // ── Image paste / drop ───────────────────────────────────────────────
  //
  // Two entry points:
  // - Clipboard paste (Ctrl/Cmd+V or right-click paste) of an image blob
  // - Drag-drop of an image file onto the container
  //
  // Both convert the blob to a dataURL, store it in `binaryFiles` by a
  // freshly-generated FileId, load an HTMLImage into `imageCacheMap` for
  // the renderer, and insert a newImageElement at a sensible scene
  // position (center of viewport, or drop location for drop).
  //
  // Upstream has a much richer pipeline (async progressive load, image
  // metadata stripping, IndexedDB persistence). PoC skips persistence
  // of the binary blob itself — the element survives reload but the
  // image shows as a placeholder until re-pasted. Real persistence
  // requires writing dataURL into localStorage or IndexedDB; deferred
  // (localStorage has size quota issues with large images; the saved
  // JSON would bloat quickly).

  // FileId → {image, mimeType}. Persistent across renders so the static
  // renderer's $effect sees a stable Map and doesn't rebuild per frame.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageCacheMap = new Map<string, { image: HTMLImageElement; mimeType: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const binaryFiles: Record<string, any> = {};

  const blobToDataURL = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  const loadImage = (dataURL: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = dataURL;
    });

  // Insert an image at scene coords. If sceneX/Y omitted, center of viewport.
  const insertImageFromBlob = async (
    blob: Blob,
    sceneX?: number,
    sceneY?: number,
  ) => {
    if (!scene) return;
    const dataURL = await blobToDataURL(blob);
    const img = await loadImage(dataURL);

    const fileId = randomId();
    const mimeType = blob.type || "image/png";
    imageCacheMap.set(fileId, { image: img, mimeType });
    const record = {
      id: fileId,
      mimeType,
      dataURL,
      created: Date.now(),
    };
    binaryFiles[fileId] = record;
    // Persist binary to IndexedDB so reload restores the image bytes.
    // Fire-and-forget; failures (quota, private mode) log and move on.
    idbPut(record);

    // Scale down if large — fit within 600px max side at 100% zoom.
    const MAX_SIDE = 600;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (Math.max(w, h) > MAX_SIDE) {
      const k = MAX_SIDE / Math.max(w, h);
      w *= k;
      h *= k;
    }

    // Default position: scene-viewport center.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomV = (appState.zoom as any).value || 1;
    const cx =
      sceneX ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState.width / 2 / zoomV - ((appState as any).scrollX ?? 0));
    const cy =
      sceneY ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState.height / 2 / zoomV - ((appState as any).scrollY ?? 0));

    const el = newImageElement({
      type: "image",
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      fileId,
      status: "saved",
      strokeColor: DEFAULT_ELEMENT_PROPS.strokeColor,
      backgroundColor: DEFAULT_ELEMENT_PROPS.backgroundColor,
      fillStyle: DEFAULT_ELEMENT_PROPS.fillStyle,
      strokeWidth: DEFAULT_ELEMENT_PROPS.strokeWidth,
      strokeStyle: DEFAULT_ELEMENT_PROPS.strokeStyle,
      roughness: DEFAULT_ELEMENT_PROPS.roughness,
      opacity: DEFAULT_ELEMENT_PROPS.opacity,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const existing = scene.getElementsIncludingDeleted();
    scene.replaceAllElements([...existing, el], { skipValidation: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = { [el.id]: true };
    pushHistory();
    bumpSceneRepaint();
  };

  const onContainerPaste = async (event: ClipboardEvent) => {
    // Ignore paste inside the text editor.
    if (textEditor) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (blob) {
          event.preventDefault();
          await insertImageFromBlob(blob);
          return;
        }
      }
    }
    // Not an image paste — let browser handle.
  };

  const onContainerDragOver = (event: DragEvent) => {
    // Must preventDefault or the drop event won't fire.
    if (event.dataTransfer && Array.from(event.dataTransfer.items).some(
      (it) => it.kind === "file",
    )) {
      event.preventDefault();
    }
  };

  const onContainerDrop = async (event: DragEvent) => {
    if (!event.dataTransfer) return;
    const files = Array.from(event.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length === 0) return;
    event.preventDefault();
    const { x, y } = toSceneCoords(event.clientX, event.clientY);
    for (const file of files) {
      await insertImageFromBlob(file, x, y);
    }
  };

  // ── Style editor ────────────────────────────────────────────────────
  //
  // Changes `strokeColor` / `backgroundColor` / `strokeWidth` / `opacity`
  // on either the current selection (all of them) or `currentItem*`
  // (defaults for next-drawn). Single pushHistory per style click.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyStyle = (patch: Record<string, any>) => {
    const selected = getSelectedElements();
    if (selected.length > 0 && scene) {
      for (const el of selected) {
        scene.mutateElement(el, patch, {
          informMutation: false,
          isDragging: false,
        });
      }
      pushHistory();
      bumpSceneRepaint();
    } else {
      // No selection → update currentItem* defaults. Map the raw style
      // key to its currentItem* counterpart per upstream convention.
      const currentItemKeyMap: Record<string, string> = {
        strokeColor: "currentItemStrokeColor",
        backgroundColor: "currentItemBackgroundColor",
        strokeWidth: "currentItemStrokeWidth",
        fillStyle: "currentItemFillStyle",
        opacity: "currentItemOpacity",
        roughness: "currentItemRoughness",
      };
      for (const [k, v] of Object.entries(patch)) {
        const targetKey = currentItemKeyMap[k] ?? k;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any)[targetKey] = v;
      }
      scheduleSave();
    }
  };

  // Style panel palette. Excerpts of upstream's default palettes —
  // enough for a usable style picker without rebuilding the full 5×3
  // color picker UI. Future batch can swap in the ported ColorPicker
  // component for the full experience.
  type StylePreset = { name: string; value: string };
  const STROKE_PRESETS: StylePreset[] = [
    { name: "black", value: COLOR_PALETTE.black },
    { name: "red", value: COLOR_PALETTE.red[3] },
    { name: "green", value: COLOR_PALETTE.green[3] },
    { name: "blue", value: COLOR_PALETTE.blue[3] },
    { name: "orange", value: COLOR_PALETTE.orange[3] },
  ];
  const BG_PRESETS: StylePreset[] = [
    { name: "transparent", value: COLOR_PALETTE.transparent },
    { name: "red", value: COLOR_PALETTE.red[1] },
    { name: "green", value: COLOR_PALETTE.green[1] },
    { name: "blue", value: COLOR_PALETTE.blue[1] },
    { name: "yellow", value: COLOR_PALETTE.yellow[1] },
  ];
  const STROKE_WIDTHS = [
    { name: "thin", value: STROKE_WIDTH.thin },
    { name: "bold", value: STROKE_WIDTH.bold },
    { name: "extrabold", value: STROKE_WIDTH.extraBold },
  ];
  const OPACITY_PRESETS = [25, 50, 75, 100];

  // What to display in the panel — reflects either the last-selected
  // element's style or the currentItem* defaults when no selection.
  const panelStyle = $derived.by(() => {
    const selected = getSelectedElements();
    if (selected.length > 0) {
      const el = selected[selected.length - 1];
      return {
        strokeColor: el.strokeColor,
        backgroundColor: el.backgroundColor,
        strokeWidth: el.strokeWidth,
        opacity: el.opacity,
      };
    }
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      strokeColor: (appState as any).currentItemStrokeColor,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      backgroundColor: (appState as any).currentItemBackgroundColor,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      strokeWidth: (appState as any).currentItemStrokeWidth,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      opacity: (appState as any).currentItemOpacity,
    };
  });

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

      // Export shortcuts.
      //   Ctrl/Cmd + S       → download PNG
      //   Ctrl/Cmd + Shift+S → download SVG
      // Both block the browser's "Save Page" prompt.
      if (event.key === "s" || event.key === "S") {
        if (event.shiftKey) {
          downloadSvg();
        } else {
          downloadPng();
        }
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

  // ── Resize state ──────────────────────────────────────────────────
  // When pointerdown lands on a transform handle of a selected element,
  // we record the handle direction + the element's bbox at that moment.
  // Subsequent pointermoves compute fresh bbox from cursor delta.
  //
  // For rotated elements (angle !== 0), we ALSO record the world-coord
  // anchor (the handle-opposite corner/edge-midpoint that stays fixed
  // during resize) + the element's angle. The resize math transforms
  // cursor into the element's LOCAL frame (rotated by -angle around
  // anchor) before computing new width/height, then rotates the new
  // bbox back into world space so the anchor stays put.
  type HandleDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
  let resizeGesture:
    | {
        dir: HandleDir;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        el: any;
        origX: number;
        origY: number;
        origW: number;
        origH: number;
        origAngle: number;
        // World-coord anchor (corner opposite the dragged handle).
        anchorX: number;
        anchorY: number;
      }
    | null = null;

  // Rotate (x, y) around (cx, cy) by angle radians. Pure helper.
  const rotPt = (
    x: number,
    y: number,
    cx: number,
    cy: number,
    angle: number,
  ): { x: number; y: number } => {
    const dx = x - cx;
    const dy = y - cy;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
  };

  // Local-frame (unrotated) position of the anchor for a given handle.
  // Coordinates: (0, 0) is element top-left, (w, h) is bottom-right.
  const anchorLocal = (
    dir: HandleDir,
    w: number,
    h: number,
  ): { x: number; y: number } => {
    switch (dir) {
      case "nw": return { x: w, y: h };
      case "ne": return { x: 0, y: h };
      case "se": return { x: 0, y: 0 };
      case "sw": return { x: w, y: 0 };
      case "n":  return { x: w / 2, y: h };
      case "e":  return { x: 0, y: h / 2 };
      case "s":  return { x: w / 2, y: 0 };
      case "w":  return { x: w, y: h / 2 };
    }
  };

  // ── Endpoint-drag state (linear elements) ─────────────────────────
  let endpointGesture:
    | {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        el: any;
        pointIndex: number;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        origPoints: any[];
        origX: number;
        origY: number;
      }
    | null = null;

  // ── Rotation state ────────────────────────────────────────────────
  // rotation handle hit → start a rotate gesture tracking the initial
  // cursor-angle-from-center; each move computes the delta and sets
  // element.angle. Shift held = snap to 15° steps (matches Excalidraw).
  let rotateGesture:
    | {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        el: any;
        cx: number;
        cy: number;
        origAngle: number;
        startCursorAngle: number;
      }
    | null = null;

  // Rotation handle position in scene coords for a given element.
  // Matches upstream: top-center, offset above by ROTATION_RESIZE_HANDLE_GAP /
  // zoom. Applies the element's rotation around its center so the handle
  // rotates with it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getRotationHandlePos = (el: any): { x: number; y: number } => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomV = (appState.zoom as any).value || 1;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    // Unrotated handle position (top-center above bbox).
    const ROT_GAP = 16; // matches upstream ROTATION_RESIZE_HANDLE_GAP
    const localX = cx;
    const localY = el.y - ROT_GAP / zoomV;
    // Rotate around element center by `el.angle` (radians).
    const angle = el.angle || 0;
    const dx = localX - cx;
    const dy = localY - cy;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  };

  // Hit-test a click against transform handles of any currently-selected
  // element. Returns {kind, el, dir?} where kind is "resize" or "rotate".
  // Tolerance scales inversely with zoom so handles stay clickable at small
  // zoom levels (their visual size is ~8px).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type HandleHit =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { kind: "resize"; dir: HandleDir; el: any }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { kind: "rotate"; el: any }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { kind: "endpoint"; el: any; pointIndex: number };

  const hitResizeHandle = (sceneX: number, sceneY: number): HandleHit | null => {
    if (!scene) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectedIds = (appState as any).selectedElementIds ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomV = (appState.zoom as any).value || 1;
    const tol = 8 / zoomV;
    const rotTol = 10 / zoomV; // rotation handle is slightly more forgiving

    // ── Linear endpoint editor (line / arrow only) ─────────────────
    // For each selected linear element, test the cursor against each
    // `points[i]` mapped to scene coords (el.x + point, el.y + point).
    // Returns a pseudo-handle with kind "endpoint" + point index.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (!selectedIds[el.id]) continue;
      if (el.type !== "line" && el.type !== "arrow") continue;
      const pts = el.points ?? [];
      for (let i = 0; i < pts.length; i++) {
        const [lx, ly] = pts[i];
        const px = el.x + lx;
        const py = el.y + ly;
        if (Math.abs(sceneX - px) <= tol && Math.abs(sceneY - py) <= tol) {
          return { kind: "endpoint", el, pointIndex: i };
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (!selectedIds[el.id]) continue;
      if (el.type === "line" || el.type === "arrow" || el.type === "freedraw")
        continue;

      // Rotation handle first — it sits above the bbox so it's visually
      // on top of the N edge handle but not overlapping unless very small.
      const rot = getRotationHandlePos(el);
      if (
        Math.abs(sceneX - rot.x) <= rotTol &&
        Math.abs(sceneY - rot.y) <= rotTol
      ) {
        return { kind: "rotate", el };
      }

      // Resize handles work on ROTATED elements too. Compute each handle's
      // world position by rotating its local position around the element
      // center by el.angle.
      const { x, y, width: w, height: h } = el;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const angle = el.angle || 0;

      // 4 corners + 4 edges in local unrotated frame.
      const handles: Array<[HandleDir, number, number]> = [
        ["nw", x, y],
        ["ne", x + w, y],
        ["se", x + w, y + h],
        ["sw", x, y + h],
        ["n", cx, y],
        ["e", x + w, cy],
        ["s", cx, y + h],
        ["w", x, cy],
      ];
      for (const [dir, lx, ly] of handles) {
        const p = angle === 0 ? { x: lx, y: ly } : rotPt(lx, ly, cx, cy, angle);
        if (Math.abs(sceneX - p.x) <= tol && Math.abs(sceneY - p.y) <= tol) {
          return { kind: "resize", dir, el };
        }
      }
    }
    return null;
  };

  // Apply resize given handle direction + scene-coord cursor.
  //
  // The anchor (corner/edge-midpoint opposite the dragged handle) must
  // stay FIXED in world space throughout the drag. That determines
  // (el.x, el.y) once we know the new width/height, because:
  //
  //   anchorWorld = centerWorld + Rot(angle) · (anchorLocal - centerLocal)
  //
  // where centerLocal = (w/2, h/2) in the element's unrotated local frame.
  // Solve for centerWorld, then el.{x,y} = centerWorld - (newW/2, newH/2).
  //
  // For width/height themselves: map cursor into the element's local frame
  // (rotate around anchor by -angle), extract the dragged-axis components,
  // clamp to 1px min.
  const applyResize = (sceneX: number, sceneY: number) => {
    if (!resizeGesture || !scene) return;
    const { dir, el, origW, origH, origAngle, anchorX, anchorY } = resizeGesture;

    // Cursor in anchor-local frame. Unrotated: straight translation.
    // Rotated: undo the rotation around the anchor.
    let lx: number, ly: number;
    if (origAngle === 0) {
      lx = sceneX - anchorX;
      ly = sceneY - anchorY;
    } else {
      const c = Math.cos(-origAngle);
      const s = Math.sin(-origAngle);
      const dx = sceneX - anchorX;
      const dy = sceneY - anchorY;
      lx = dx * c - dy * s;
      ly = dx * s + dy * c;
    }

    // New width/height in local frame.
    // e* handles: width tracks cursor.x; w* handles: width tracks -cursor.x.
    // n/s edge handles preserve width; e/w edge handles preserve height.
    let newW = origW;
    let newH = origH;
    if (dir.includes("e")) newW = lx;
    else if (dir.includes("w")) newW = -lx;
    if (dir.includes("s")) newH = ly;
    else if (dir.includes("n")) newH = -ly;

    // Flip-prevention + min size.
    if (newW < 1) newW = 1;
    if (newH < 1) newH = 1;

    // centerWorld from fixed anchor. Use the NEW anchorLocal (same dir,
    // new width/height) to get the offset between anchor and center in
    // the element's local frame, then rotate by origAngle and subtract.
    const aln = anchorLocal(dir, newW, newH);
    const offLx = aln.x - newW / 2;
    const offLy = aln.y - newH / 2;
    let centerX: number, centerY: number;
    if (origAngle === 0) {
      centerX = anchorX - offLx;
      centerY = anchorY - offLy;
    } else {
      const c = Math.cos(origAngle);
      const s = Math.sin(origAngle);
      centerX = anchorX - (offLx * c - offLy * s);
      centerY = anchorY - (offLx * s + offLy * c);
    }

    scene.mutateElement(
      el,
      {
        x: centerX - newW / 2,
        y: centerY - newH / 2,
        width: newW,
        height: newH,
      },
      { informMutation: false, isDragging: true },
    );
    bumpSceneRepaint();
  };

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

  const toggleInSelection = (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = { ...((appState as any).selectedElementIds ?? {}) };
    if (cur[id]) {
      delete cur[id];
    } else {
      cur[id] = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = cur;
  };

  // ── Text editing (WYSIWYG) state ─────────────────────────────────
  //
  // Simple PoC: when user clicks with the text tool, open a `<textarea>`
  // positioned at the click's viewport coords. On blur/Escape, commit the
  // text to the scene via `newTextElement` (which measures dims from the
  // final string). While editing we do NOT render the in-progress text
  // on canvas — the textarea IS the preview. Upstream has a more elaborate
  // "contenteditable that ALSO paints to canvas" flow; out of PoC scope.
  //
  // Editing state lives in a $state object so the overlay re-renders.
  let textEditor: {
    sceneX: number;
    sceneY: number;
    initialValue: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Used when editing an existing text element; null for new text.
    editingElementId: string | null;
  } | null = $state(null);
  let textEditorEl: HTMLTextAreaElement | null = $state(null);

  const commitTextEditor = () => {
    if (!textEditor || !scene) return;
    const { sceneX, sceneY, editingElementId } = textEditor;
    const text = (textEditorEl?.value ?? "").replace(/\s+$/, "");
    // Close the editor first so blur handler doesn't re-enter.
    textEditor = null;

    if (!text) {
      // Empty text: if we were editing an existing text element, delete
      // it (standard Excalidraw behavior). New text with no content →
      // silent discard.
      if (editingElementId) {
        const existing = scene.getElementsIncludingDeleted();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const next = existing.filter((el: any) => el.id !== editingElementId);
        scene.replaceAllElements(next, { skipValidation: true });
        pushHistory();
        bumpSceneRepaint();
      }
      return;
    }

    if (editingElementId) {
      // Update existing text — replace rather than mutate so the Renderer
      // memoize busts. Simpler than `scene.mutateElement` which needs to
      // re-run measureText internally.
      const existing = scene.getElementsIncludingDeleted();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const next = existing.map((el: any) =>
        el.id === editingElementId
          ? newTextElement({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...(el as any),
              text,
              originalText: text,
            })
          : el,
      );
      scene.replaceAllElements(next, { skipValidation: true });
    } else {
      const el = newTextElement({
        x: sceneX,
        y: sceneY,
        text,
        originalText: text,
        fontSize: DEFAULT_FONT_SIZE,
        fontFamily: DEFAULT_FONT_FAMILY,
        strokeColor: DEFAULT_ELEMENT_PROPS.strokeColor,
        backgroundColor: DEFAULT_ELEMENT_PROPS.backgroundColor,
        fillStyle: DEFAULT_ELEMENT_PROPS.fillStyle,
        strokeWidth: DEFAULT_ELEMENT_PROPS.strokeWidth,
        strokeStyle: DEFAULT_ELEMENT_PROPS.strokeStyle,
        roughness: DEFAULT_ELEMENT_PROPS.roughness,
        opacity: DEFAULT_ELEMENT_PROPS.opacity,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const existing = scene.getElementsIncludingDeleted();
      scene.replaceAllElements([...existing, el], { skipValidation: true });
    }
    pushHistory();
    bumpSceneRepaint();
  };

  // Open the editor at given scene coords. Also used by the future
  // double-click-to-edit-existing-text flow.
  const openTextEditor = (sceneX: number, sceneY: number, opts: {
    initialValue?: string;
    editingElementId?: string | null;
  } = {}) => {
    textEditor = {
      sceneX,
      sceneY,
      initialValue: opts.initialValue ?? "",
      editingElementId: opts.editingElementId ?? null,
    };
    // Focus after Svelte commits the DOM — tick via rAF.
    requestAnimationFrame(() => {
      textEditorEl?.focus();
      textEditorEl?.select();
    });
  };

  // ── Marquee (rubber-band) state ───────────────────────────────────
  // Represented as 4 scene-coords + a shiftHeld flag (additive vs replace
  // on commit). Rendered in the DOM overlay, not the canvas, to avoid
  // touching upstream renderer configs.
  let marquee: {
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    additive: boolean;
  } | null = $state(null);

  // Marquee bbox in VIEWPORT coords (for rendering the overlay div).
  const marqueeRect = $derived.by(() => {
    if (!marquee) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomV = (appState.zoom as any).value || 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sX = (appState.scrollX as any) ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sY = (appState.scrollY as any) ?? 0;
    const oL = (appState.offsetLeft as number) ?? 0;
    const oT = (appState.offsetTop as number) ?? 0;
    const toVp = (sx: number, sy: number) => ({
      x: (sx + sX) * zoomV + oL,
      y: (sy + sY) * zoomV + oT,
    });
    const a = toVp(marquee.startX, marquee.startY);
    const b = toVp(marquee.curX, marquee.curY);
    return {
      left: Math.min(a.x, b.x),
      top: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x),
      height: Math.abs(a.y - b.y),
    };
  });

  // Commit the marquee: pick every element whose AABB intersects the
  // marquee rectangle. `additive` = shift was held at pointerdown.
  const commitMarquee = () => {
    if (!marquee || !scene) return;
    const x0 = Math.min(marquee.startX, marquee.curX);
    const y0 = Math.min(marquee.startY, marquee.curY);
    const x1 = Math.max(marquee.startX, marquee.curX);
    const y1 = Math.max(marquee.startY, marquee.curY);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base: Record<string, true> = marquee.additive
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...((appState as any).selectedElementIds ?? {}) }
      : {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (el.locked) continue;
      // AABB intersection: element's bbox vs marquee. Linear/freedraw use
      // their element x/y/width/height which approximates the bbox well
      // enough for selection purposes.
      const ex1 = el.x;
      const ey1 = el.y;
      const ex2 = el.x + el.width;
      const ey2 = el.y + el.height;
      const intersects = ex1 < x1 && ex2 > x0 && ey1 < y1 && ey2 > y0;
      if (intersects) base[el.id] = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = base;
    marquee = null;
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

    // ── Selection tool: check resize handles first, then hit-test ─────
    if (tool === "selection") {
      // Resize handle hit-test takes precedence over element hit-test
      // because handles are rendered on TOP of elements. Without this
      // check, clicking a handle near the corner of an element would
      // just start a drag on the element.
      const handleHit = hitResizeHandle(x, y);
      if (handleHit) {
        if (handleHit.kind === "rotate") {
          const cx = handleHit.el.x + handleHit.el.width / 2;
          const cy = handleHit.el.y + handleHit.el.height / 2;
          rotateGesture = {
            el: handleHit.el,
            cx,
            cy,
            origAngle: handleHit.el.angle || 0,
            startCursorAngle: Math.atan2(y - cy, x - cx),
          };
        } else if (handleHit.kind === "endpoint") {
          const el = handleHit.el;
          endpointGesture = {
            el,
            pointIndex: handleHit.pointIndex,
            origPoints: el.points.map((p: number[]) => [p[0], p[1]]),
            origX: el.x,
            origY: el.y,
          };
        } else {
          const el = handleHit.el;
          const angle = el.angle || 0;
          const ecx = el.x + el.width / 2;
          const ecy = el.y + el.height / 2;
          // Anchor (opposite-side point of the handle) in world coords.
          const aLocal = anchorLocal(handleHit.dir, el.width, el.height);
          const aWorldLocal = { x: el.x + aLocal.x, y: el.y + aLocal.y };
          const aWorld = angle === 0
            ? aWorldLocal
            : rotPt(aWorldLocal.x, aWorldLocal.y, ecx, ecy, angle);
          resizeGesture = {
            dir: handleHit.dir,
            el,
            origX: el.x,
            origY: el.y,
            origW: el.width,
            origH: el.height,
            origAngle: angle,
            anchorX: aWorld.x,
            anchorY: aWorld.y,
          };
        }
        dragStart = { x, y }; // used only as "drag active" sentinel
        tryCapture(event.currentTarget as HTMLElement | null, event.pointerId);
        event.preventDefault();
        return;
      }

      const hit = hitTestAt(x, y);
      if (!hit) {
        // ── Marquee rubber-band ──
        // Shift held → additive on commit (keeps existing selection);
        // no shift → replace (committed selection = only what marquee hit).
        marquee = {
          startX: x,
          startY: y,
          curX: x,
          curY: y,
          additive: event.shiftKey,
        };
        dragStart = { x, y };
        dragOrigins = [];
        tryCapture(event.currentTarget as HTMLElement | null, event.pointerId);
        event.preventDefault();
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sel = (appState as any).selectedElementIds ?? {};
      if (event.shiftKey) {
        // Shift-click on an element toggles its membership in the selection.
        // Doesn't start a drag — user must click-and-hold a non-shift
        // pointerdown to drag multi-selections.
        toggleInSelection(hit.id);
        dragStart = null;
        dragOrigins = [];
        event.preventDefault();
        return;
      }
      if (!sel[hit.id]) {
        // Clicking unselected element replaces selection.
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

    // ── Text tool: open the textarea overlay at click point ──
    if (tool === "text") {
      // If there's already an active editor, commit it first (user
      // clicking elsewhere = "done editing").
      if (textEditor) commitTextEditor();
      openTextEditor(x, y);
      // Auto-switch to selection after click so next click doesn't spawn
      // another editor. Matches Excalidraw UX.
      setActiveTool("selection");
      event.preventDefault();
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

    // Resize gesture takes precedence over drag/draw.
    if (resizeGesture) {
      const { x, y } = toSceneCoords(event.clientX, event.clientY);
      applyResize(x, y);
      return;
    }

    // Endpoint drag for linear elements — update points[i] to follow
    // cursor. Recompute bbox (width/height) from the new points so the
    // renderer's dirty-rect culling stays correct. Keep el.x/el.y at
    // their original value so other points stay put.
    if (endpointGesture) {
      const { x, y } = toSceneCoords(event.clientX, event.clientY);
      const { el, pointIndex, origPoints, origX, origY } = endpointGesture;
      const nextPoints = origPoints.map((p) => [p[0], p[1]]);
      nextPoints[pointIndex] = [x - origX, y - origY];
      // bbox from points relative to el.x/y (which we don't change here).
      let minX = 0, minY = 0, maxX = 0, maxY = 0;
      for (const [px, py] of nextPoints) {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
      scene.mutateElement(
        el,
        {
          points: nextPoints,
          width: Math.max(1, maxX - minX),
          height: Math.max(1, maxY - minY),
        },
        { informMutation: false, isDragging: true },
      );
      bumpSceneRepaint();
      return;
    }

    // Rotation gesture.
    if (rotateGesture) {
      const { x, y } = toSceneCoords(event.clientX, event.clientY);
      const cursorAngle = Math.atan2(y - rotateGesture.cy, x - rotateGesture.cx);
      let delta = cursorAngle - rotateGesture.startCursorAngle;
      let next = rotateGesture.origAngle + delta;
      if (event.shiftKey) {
        // Snap to 15° increments — matches upstream rotate-with-shift UX.
        const STEP = (Math.PI / 180) * 15;
        next = Math.round(next / STEP) * STEP;
      }
      // Normalize to (-π, π] to keep numbers bounded across full turns.
      while (next > Math.PI) next -= 2 * Math.PI;
      while (next <= -Math.PI) next += 2 * Math.PI;
      scene.mutateElement(
        rotateGesture.el,
        { angle: next },
        { informMutation: false, isDragging: true },
      );
      bumpSceneRepaint();
      return;
    }

    // Marquee: extend its moving corner; commit happens on pointerup.
    if (marquee) {
      const { x, y } = toSceneCoords(event.clientX, event.clientY);
      marquee = { ...marquee, curX: x, curY: y };
      return;
    }

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

    // Finalize marquee — commit selection, then clear.
    if (marquee) {
      commitMarquee();
      dragStart = null;
      bumpSceneRepaint();
      tryRelease(event.currentTarget as HTMLElement | null, event.pointerId);
      return;
    }

    // Finalize endpoint drag.
    if (endpointGesture) {
      const { el, origPoints } = endpointGesture;
      const changed =
        JSON.stringify(el.points) !== JSON.stringify(origPoints);
      endpointGesture = null;
      dragStart = null;
      if (changed) pushHistory();
      bumpSceneRepaint();
      tryRelease(event.currentTarget as HTMLElement | null, event.pointerId);
      return;
    }

    // Finalize rotate gesture.
    if (rotateGesture) {
      const changed =
        (rotateGesture.el.angle || 0) !== rotateGesture.origAngle;
      rotateGesture = null;
      dragStart = null;
      if (changed) pushHistory();
      bumpSceneRepaint();
      tryRelease(event.currentTarget as HTMLElement | null, event.pointerId);
      return;
    }

    // Finalize resize gesture.
    if (resizeGesture) {
      const changed =
        resizeGesture.el.x !== resizeGesture.origX ||
        resizeGesture.el.y !== resizeGesture.origY ||
        resizeGesture.el.width !== resizeGesture.origW ||
        resizeGesture.el.height !== resizeGesture.origH;
      resizeGesture = null;
      dragStart = null;
      if (changed) pushHistory();
      bumpSceneRepaint();
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

  // Double-click on text element → open editor for that element.
  // Double-click on empty canvas → open a new text editor at that point
  // (matches Excalidraw's UX: double-click is a quick way to add text
  // without first switching to the text tool).
  const onInteractiveDoubleClick = (event: MouseEvent) => {
    if (!scene) return;
    const { x, y } = toSceneCoords(event.clientX, event.clientY);
    const hit = hitTestAt(x, y);
    if (hit && hit.type === "text") {
      // Commit any open editor first.
      if (textEditor) commitTextEditor();
      // Remove the element from scene while editing so it doesn't render
      // under the textarea. Batch 21 simple path: keep the element in
      // scene, textarea overlays. User will see two copies briefly; fine.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = hit as any;
      openTextEditor(el.x, el.y, {
        initialValue: el.text ?? "",
        editingElementId: el.id,
      });
      event.preventDefault();
      return;
    }
    if (!hit) {
      openTextEditor(x, y);
      event.preventDefault();
    }
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

  <!-- Style panel. Shown whenever the editor is mounted; changes apply
       to the current selection OR to currentItem* defaults if none. -->
  <div class="sveltedraw-style-panel">
    <div class="sp-row">
      <div class="sp-label">Stroke</div>
      <div class="sp-swatches">
        {#each STROKE_PRESETS as c}
          <button
            type="button"
            class="sp-sw"
            class:active={panelStyle.strokeColor === c.value}
            data-preset="stroke"
            data-value={c.value}
            aria-label={`Stroke ${c.name}`}
            style="background: {c.value === 'transparent' ? '#fff' : c.value}; {c.value === 'transparent' ? 'background-image: linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%); background-size: 8px 8px;' : ''}"
            onclick={() => applyStyle({ strokeColor: c.value })}
          ></button>
        {/each}
      </div>
    </div>

    <div class="sp-row">
      <div class="sp-label">Fill</div>
      <div class="sp-swatches">
        {#each BG_PRESETS as c}
          <button
            type="button"
            class="sp-sw"
            class:active={panelStyle.backgroundColor === c.value}
            data-preset="bg"
            data-value={c.value}
            aria-label={`Background ${c.name}`}
            style="background: {c.value === 'transparent' ? '#fff' : c.value}; {c.value === 'transparent' ? 'background-image: linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%); background-size: 8px 8px;' : ''}"
            onclick={() => applyStyle({ backgroundColor: c.value })}
          ></button>
        {/each}
      </div>
    </div>

    <div class="sp-row">
      <div class="sp-label">Width</div>
      <div class="sp-swatches">
        {#each STROKE_WIDTHS as w}
          <button
            type="button"
            class="sp-width"
            class:active={panelStyle.strokeWidth === w.value}
            data-preset="width"
            data-value={w.value}
            aria-label={`Stroke width ${w.name}`}
            onclick={() => applyStyle({ strokeWidth: w.value })}
          >
            <span style="display: inline-block; width: 18px; height: {w.value}px; background: #1e1e1e; border-radius: 1px;"></span>
          </button>
        {/each}
      </div>
    </div>

    <div class="sp-row">
      <div class="sp-label">Opacity</div>
      <div class="sp-swatches">
        {#each OPACITY_PRESETS as o}
          <button
            type="button"
            class="sp-opacity"
            class:active={panelStyle.opacity === o}
            data-preset="opacity"
            data-value={o}
            aria-label={`Opacity ${o}%`}
            onclick={() => applyStyle({ opacity: o })}
          >{o}</button>
        {/each}
      </div>
    </div>
  </div>

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
    ondblclick={onInteractiveDoubleClick}
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

  <!-- Text editor overlay. A plain <textarea> that grows with its content.
       On blur OR Escape → commitTextEditor(). Ctrl+Enter also commits
       (without inserting a newline). The textarea's own keydown handler
       prevents these keys from bubbling into the container's hotkey
       routing so "Escape" doesn't also run setActiveTool("selection"). -->
  {#if textEditor}
    {@const zoomV = (appState.zoom as any).value || 1}
    <!-- Position inside the container (which is position:relative at
         the viewport offset). Scene→container coords: (sceneX + scrollX)
         * zoom, ignoring viewport offset since the container already
         lives there. -->
    {@const vpX = (textEditor.sceneX + ((appState.scrollX as any) ?? 0)) * zoomV}
    {@const vpY = (textEditor.sceneY + ((appState.scrollY as any) ?? 0)) * zoomV}
    <textarea
      bind:this={textEditorEl}
      value={textEditor.initialValue}
      class="sveltedraw-text-editor"
      style="position: absolute;
             left: {vpX}px;
             top: {vpY}px;
             min-width: 40px;
             min-height: {DEFAULT_FONT_SIZE * 1.2 * zoomV}px;
             font: {DEFAULT_FONT_SIZE * zoomV}px {getFontFamilyString({ fontFamily: DEFAULT_FONT_FAMILY })};
             background: transparent;
             border: 1px dashed #6965db;
             outline: none;
             resize: none;
             padding: 2px;
             margin: 0;
             overflow: hidden;
             white-space: pre;
             color: {(appState as any).currentItemStrokeColor || '#000'};
             z-index: 20;"
      onblur={commitTextEditor}
      onkeydown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          commitTextEditor();
          return;
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.stopPropagation();
          commitTextEditor();
          return;
        }
        // Stop other hotkeys (Ctrl+A etc.) from bubbling into the
        // container keyhandler and selecting canvas elements.
        event.stopPropagation();
      }}
      oninput={(event) => {
        // Auto-grow: match textarea box to content so the WYSIWYG preview
        // is roughly accurate. Upstream uses a hidden span for exact
        // measurement; we settle for scrollHeight/scrollWidth.
        const ta = event.currentTarget as HTMLTextAreaElement;
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
        ta.style.width = 'auto';
        ta.style.width = ta.scrollWidth + 'px';
      }}
    ></textarea>
  {/if}

  <!-- Marquee rubber-band overlay. Rendered as a DOM div (not on canvas)
       to avoid touching upstream renderer configs. Position is in VIEWPORT
       coords; marqueeRect derivation factors zoom + scroll + offset. -->
  {#if marqueeRect}
    <div
      class="sveltedraw-marquee"
      style="position: absolute;
             left: {marqueeRect.left - (appState.offsetLeft as number)}px;
             top: {marqueeRect.top - (appState.offsetTop as number)}px;
             width: {marqueeRect.width}px;
             height: {marqueeRect.height}px;
             border: 1px dashed #6965db;
             background: rgba(105, 101, 219, 0.1);
             pointer-events: none;
             z-index: 10;"
    ></div>
  {/if}
</div>

<style>
  .excalidraw-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* Style panel — floats top-left below the layer-ui menu row. Absolute
     so it stays over the canvases. Low-profile design; batch 17 ships
     functionality first, polish later. */
  .sveltedraw-style-panel {
    position: absolute;
    top: 72px;
    left: 12px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid #e1e3e8;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    user-select: none;
  }
  .sveltedraw-style-panel .sp-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sveltedraw-style-panel .sp-label {
    width: 50px;
    color: #5a5d66;
    font-weight: 500;
  }
  .sveltedraw-style-panel .sp-swatches {
    display: flex;
    gap: 4px;
  }
  .sveltedraw-style-panel .sp-sw {
    width: 22px;
    height: 22px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    padding: 0;
    cursor: pointer;
  }
  .sveltedraw-style-panel .sp-sw.active {
    border-color: #6965db;
    box-shadow: 0 0 0 1px #6965db;
  }
  .sveltedraw-style-panel .sp-width,
  .sveltedraw-style-panel .sp-opacity {
    min-width: 30px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    cursor: pointer;
    color: #1e1e1e;
  }
  .sveltedraw-style-panel .sp-width.active,
  .sveltedraw-style-panel .sp-opacity.active {
    border-color: #6965db;
    background: #eeedfa;
  }
</style>

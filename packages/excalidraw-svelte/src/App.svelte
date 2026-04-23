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
  import * as Y from "yjs";
  import { WebsocketProvider } from "y-websocket";
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
  // @ts-ignore — upstream
  import { Fonts } from "@excalidraw/excalidraw/fonts/Fonts";
  // @ts-ignore — upstream, resolved via Vite alias
  // prettier-ignore
  import { getFormFactor, createUserAgentDescriptor, MQ_RIGHT_SIDEBAR_MIN_WIDTH, supportsResizeObserver, POINTER_EVENTS, randomId, viewportCoordsToSceneCoords, DEFAULT_ELEMENT_PROPS, DEFAULT_FONT_FAMILY, FONT_FAMILY } from "@excalidraw/common";
  // @ts-ignore — upstream
  import { newElement, newLinearElement, newArrowElement, newFreeDrawElement, newTextElement, newImageElement, hitElementItself, duplicateElements, deepCopyElement, moveOneLeft, moveOneRight, moveAllLeft, moveAllRight } from "@excalidraw/element";
  // @ts-ignore — upstream
  import { updateBoundElements } from "@excalidraw/element";
  // @ts-ignore — upstream
  import { DEFAULT_FONT_SIZE, getFontFamilyString } from "@excalidraw/common";
  // @ts-ignore — upstream, resolved via Vite alias
  import { exportToBlob, exportToSvg } from "@excalidraw/utils/export";
  // @ts-ignore — upstream, resolved via Vite alias
  // prettier-ignore
  import { DEFAULT_COLLISION_THRESHOLD, ELEMENT_TRANSLATE_AMOUNT, ELEMENT_SHIFT_TRANSLATE_AMOUNT, ZOOM_STEP, STROKE_WIDTH, COLOR_PALETTE, ROUGHNESS } from "@excalidraw/common";
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
  import {
    t,
    setLanguage,
    getCurrentLangCode,
    getPreferredLanguage,
    availableLanguages,
  } from "./state/i18n.svelte.js";
  import ColorPicker from "./components/color-picker/ColorPicker.svelte";
  import FontPicker from "./components/font-picker/FontPicker.svelte";
  import type { FontDescriptor } from "./components/font-picker/types.js";
  import Icon from "./icons/Icon.svelte";
  import StrokeStyleSolidIcon from "./icons/dynamic/StrokeStyleSolidIcon.svelte";
  import TextAlignTopIcon from "./icons/dynamic/TextAlignTopIcon.svelte";
  import TextAlignMiddleIcon from "./icons/dynamic/TextAlignMiddleIcon.svelte";
  import TextAlignBottomIcon from "./icons/dynamic/TextAlignBottomIcon.svelte";
  import ArrowheadNoneIcon from "./icons/dynamic/ArrowheadNoneIcon.svelte";
  import ArrowheadArrowIcon from "./icons/dynamic/ArrowheadArrowIcon.svelte";
  import ArrowheadTriangleIcon from "./icons/dynamic/ArrowheadTriangleIcon.svelte";
  import ArrowheadTriangleOutlineIcon from "./icons/dynamic/ArrowheadTriangleOutlineIcon.svelte";
  import ArrowheadDiamondIcon from "./icons/dynamic/ArrowheadDiamondIcon.svelte";
  import ArrowheadDiamondOutlineIcon from "./icons/dynamic/ArrowheadDiamondOutlineIcon.svelte";
  import ArrowheadCircleIcon from "./icons/dynamic/ArrowheadCircleIcon.svelte";
  import ArrowheadCircleOutlineIcon from "./icons/dynamic/ArrowheadCircleOutlineIcon.svelte";
  import ArrowheadBarIcon from "./icons/dynamic/ArrowheadBarIcon.svelte";

  import LayerUI from "./components/LayerUI.svelte";
  import StaticCanvas from "./components/canvases/StaticCanvas.svelte";
  import InteractiveCanvas from "./components/canvases/InteractiveCanvas.svelte";
  import NewElementCanvas from "./components/canvases/NewElementCanvas.svelte";
  import TemplateSelector from "./components/TemplateSelector.svelte";
  import ElementLinkDialog from "./components/ElementLinkDialog.svelte";
  import RecentFilesPanel from "./components/RecentFilesPanel.svelte";
  import SettingsPanel from "./components/SettingsPanel.svelte";
  import HelpPanel from "./components/HelpPanel.svelte";
  import ConnectorTool from "./components/ConnectorTool.svelte";
  import AlignmentPanel from "./components/AlignmentPanel.svelte";
  import MeasurementPanel from "./components/MeasurementPanel.svelte";
  import AutoLayoutPanel from "./components/AutoLayoutPanel.svelte";
  import GridPanel from "./components/GridPanel.svelte";
  import GridRenderer from "./components/GridRenderer.svelte";
  import SnapGuideRenderer from "./components/SnapGuideRenderer.svelte";
  import LayerPanel from "./components/LayerPanel.svelte";
  import HistoryPanel from "./components/HistoryPanel.svelte";
  import ShapeLibraryPanel from "./components/ShapeLibraryPanel.svelte";
  import PresentationMode from "./components/PresentationMode.svelte";
  import ExportPanel from "./components/ExportPanel.svelte";
  import type { HistoryState } from "./history/types.js";
  import type { LibraryComponent, LibraryCategory } from "./library/types.js";
  import { getDefaultLibraryConfig, createLibraryComponent, getCategoryLabel } from "./library/types.js";
  import type { PresentationSlide, PresentationConfig } from "./presentation/types.js";
  import { getDefaultPresentationConfig, createPresentationSlide } from "./presentation/types.js";
  import type { ExportOptions, ExportPreset } from "./export/types.js";
  import { getDefaultExportOptions, EXPORT_PRESETS, getDefaultBatchExportConfig } from "./export/types.js";
  import type { Template } from "./templates/index.js";
  // Connector tool creates real Excalidraw arrow elements with
  // startBinding/endBinding — the custom Connector type (Phase 13)
  // was never rendered. Arrows get rendering + export + hit-testing
  // for free from the upstream pipeline.
  import type { AlignmentType, DistributionType, AlignmentGuide } from "./alignment/types.js";
  import { calculateAlignmentGuides, alignElements, distributeElements } from "./alignment/types.js";
  import type { MeasurementConfig } from "./measurements/types.js";
  import { formatMeasurement } from "./measurements/types.js";
  import type { LayoutConfig } from "./autolayout/types.js";
  import { calculateLayout, applyLayout } from "./autolayout/types.js";
  import type { GridConfig, SnapConfig } from "./snap/types.js";
  import type { SnapGuide } from "./snap/guides.js";
  import { computeDragSnap } from "./snap/guides.js";
  import type { LayerItem } from "./layers/types.js";
  import { getLayerName } from "./layers/types.js";

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

  // ── Phase 11: Frames (Page Management) ───────────────────────────────────
  type Frame = {
    id: string;
    name: string;
    elementIds: Set<string>;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  const frames = $state<Map<string, Frame>>(new Map());
  let currentFrameId: string | null = $state(null);

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
    syncLayersFromScene();
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

    // D4: detect the browser's preferred language and switch to it if it's
    // not already the default. Fire-and-forget; the async load is safe
    // because the fallback locale data ships with the bundle.
    const preferred = getPreferredLanguage();
    if (preferred !== getCurrentLangCode()) {
      void setLanguage(preferred);
    }

    // Attempt to hydrate from localStorage BEFORE seeding history so the
    // initial history floor captures the restored state, not "empty".
    tryLoad();
    loadLibrary();
    loadRecentFiles();
    loadSettings();
    sceneReady++; // triggers the first static paint

    // Initialize the upstream Fonts loader. It takes a scene object
    // with getNonDeletedElements + triggerUpdate(). Scene from
    // @excalidraw/element already has both. After construction,
    // kick off a load for the current scene so text elements that
    // were restored from localStorage get their woff2 downloaded
    // and rendered on top of the fallback.
    try {
      // Fonts constructor takes a Scene directly. Our Scene instance
      // already satisfies the shape (getNonDeletedElements +
      // triggerUpdate) — just pass it through.
      fontsInstance = new Fonts(scene);
      // Fire-and-forget — fonts download in background; repaint
      // triggers when ready via the scene ticker.
      reloadSceneFonts();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("sveltedraw: Fonts init failed", err);
    }

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
        // Library test helpers — call these directly to avoid
        // Svelte 5 event-delegation quirks in synthetic events.
        saveSelectionToLibrary: () => saveSelectionToLibrary(),
        insertLibraryItem: (item: LibraryItem) => insertLibraryItem(item),
        deleteLibraryItem: (id: string) => deleteLibraryItem(id),
        getLibraryItems: () => libraryItems,
        // Phase 16 test helpers — honest integration hooks.
        toggleSidePanel: (name: SidePanelId) => toggleSidePanel(name),
        closeAllSidePanels: () => closeAllSidePanels(),
        isSidePanelOpen: (name: SidePanelId) => isSidePanelOpen(name),
        handleExport: (opts: ExportOptions) => handleExport(opts),
        startPresentation: () => handleStartPresentation(),
        exitPresentation: () => handlePresentationExit(),
        getPresentationSlides: () => presentationSlides,
        getPresentationSlideSvgs: () => presentationSlideSvgs,
        isPresentationActive: () => presentationActive,
        getLibraryComponents: () => libraryComponents,
        saveComponentToLibrary: () => handleSaveComponentToLibrary(),
        insertLibraryComponent: (c: LibraryComponent) => handleLibraryComponentSelect(c),
        getEditorHistory: () => editorHistory,
        getHistoryCurrentIndex: () => historyCurrentIndex,
        jumpHistory: (i: number) => handleHistoryJump(i),
        clearHistory: () => handleHistoryClear(),
        pushHistory: () => pushHistory(),
        // Bound-arrow test helper: force-route arrows after moving a shape.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateBoundElements: (el: any) => updateBoundElements(el, scene),
        // Render-trigger for tests that mutate scene outside the normal
        // pointer-event path (see drag handler, ~line 5494).
        bumpSceneRepaint: () => bumpSceneRepaint(),
        // Snap/grid config mutators for honest A4/A6 tests (negative cases
        // need snap disabled, which the GridPanel UI can't easily drive).
        getSnapConfig: () => snapConfig,
        getGridConfig: () => gridConfig,
        setSnapConfig: (patch: Partial<typeof snapConfig>) =>
          Object.assign(snapConfig, patch),
        setGridConfig: (patch: Partial<typeof gridConfig>) =>
          Object.assign(gridConfig, patch),
        // A1: link-dialog hooks for tests. openLinkDialog uses the current
        // selection; confirmLinkViaDialog lets tests bypass the UI typeahead.
        openLinkDialog: () => openLinkDialog(),
        closeLinkDialog: () => closeLinkDialog(),
        confirmLinkDialog: (v: string | null) => confirmLinkDialog(v),
        isLinkDialogOpen: () => linkDialogOpen,
        // A2: laser hooks. Tests need to toggle + inspect trail length.
        toggleLaser: () => toggleLaser(),
        isLaserActive: () => laserActive,
        getLaserTrailLen: () => laserTrail.length,
        // A5: measurement overlay hooks for honest tests.
        setMeasurementConfig: (patch: Partial<MeasurementConfig>) =>
          Object.assign(measurementConfig, patch),
        getMeasurementConfig: () => ({ ...measurementConfig }),
        // B4: generate a PNG blob with embedded Excalidraw scene metadata.
        // Mirrors the export pipeline but adds the tEXt chunk so the paste
        // round-trip test can verify restoration without touching the UI.
        exportPngWithMetadata: async () => {
          if (!scene) return null;
          const elements = scene.getNonDeletedElements();
          const blob = await exportToBlob({
            elements,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            appState: { ...(appState as any), exportBackground: true, exportScale: 1 },
            files: binaryFiles,
            mimeType: "image/png",
            quality: 0.92,
            exportPadding: 10,
          });
          const { encodePngMetadata } = await import("@excalidraw/excalidraw/data/image");
          return encodePngMetadata({
            blob,
            metadata: JSON.stringify({
              type: "excalidraw",
              version: 2,
              source: window.location.origin,
              elements,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              appState: { viewBackgroundColor: (appState as any).viewBackgroundColor },
              files: binaryFiles,
            }),
          });
        },
        tryRestoreSceneFromPng: (b: Blob) => tryRestoreSceneFromPng(b),
        // C2: flip hook for tests.
        flipSelected: (axis: "horizontal" | "vertical") => flipSelected(axis),
        // D3: presentation auto-advance probe hooks.
        setAutoAdvanceDuration: (ms: number) => {
          (presentationConfig as any).autoAdvanceDuration = ms;
        },
        setPresentationPlaying: (v: boolean) => { presentationIsPlaying = v; },
        getPresentationCurrentIndex: () => presentationCurrentIndex,
        // Test-only: seed N fake slides so the auto-advance loop has
        // room to progress without depending on the full scene/slides
        // pipeline. Bypasses handleStartPresentation's SVG pre-render.
        // B1: frame creation hook.
        createFrameAtCenter: () => createFrameAtCenter(),
        forcePresentationSlides: (n: number) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          presentationSlides = Array.from({ length: n }, (_, i) => ({
            id: `s${i}`,
            title: `Slide ${i + 1}`,
            description: "",
            elements: [],
            order: i,
            duration: 0,
          }) as any);
          presentationSlideSvgs = Array.from({ length: n }, () => "");
          presentationCurrentIndex = 0;
          presentationActive = true;
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__sveltedrawHistoryLen = () => history.length;
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

    // Touch gesture handlers (mobile support)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchCount = 0;
    let lastTouchDistance = 0;
    let longPressTimeout: number | null = null;

    const onTouchStart = (e: TouchEvent) => {
      touchCount = e.touches.length;
      if (touchCount === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        // Start long-press timer (500ms)
        longPressTimeout = window.setTimeout(() => {
          if (touchCount === 1) {
            showContextMenu(touchStartX, touchStartY);
          }
        }, 500);
      } else if (touchCount === 2) {
        // Cancel long-press on multi-touch
        if (longPressTimeout) clearTimeout(longPressTimeout);
        // Store initial distance for pinch-zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (longPressTimeout && touchCount === 1) {
        // Check if movement exceeded threshold (10px) — cancel long-press
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(longPressTimeout);
          longPressTimeout = null;
        }
      }

      if (touchCount === 2 && e.touches.length === 2) {
        // Two-finger pan
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dx = centerX - touchStartX;
        const dy = centerY - touchStartY;

        // Pan: scroll opposite to finger movement
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const zoomV = (appState.zoom as any).value || 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).scrollX -= dx / zoomV;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).scrollY -= dy / zoomV;

        touchStartX = centerX;
        touchStartY = centerY;

        // Pinch-zoom
        const dx2 = e.touches[0].clientX - e.touches[1].clientX;
        const dy2 = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        if (lastTouchDistance > 0) {
          const scale = distance / lastTouchDistance;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const currentZoom = (appState.zoom as any).value || 1;
          const newZoom = currentZoom * scale;
          const clampedZoom = Math.max(0.1, Math.min(4, newZoom));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (appState as any).zoom = { value: clampedZoom };
        }
        lastTouchDistance = distance;
        bumpSceneRepaint();
      }
    };

    const onTouchEnd = () => {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }
      touchCount = 0;
      lastTouchDistance = 0;
    };

    containerEl?.addEventListener("touchstart", onTouchStart, { passive: true });
    containerEl?.addEventListener("touchmove", onTouchMove, { passive: true });
    containerEl?.addEventListener("touchend", onTouchEnd, { passive: true });

    // Auto-focus the container on mount so hotkeys work without requiring
    // the user to click first. Matches upstream UX.
    containerEl?.focus({ preventScroll: true });

    let ro: ResizeObserver | null = null;
    if (supportsResizeObserver && containerEl) {
      ro = new ResizeObserver(() => measure());
      ro.observe(containerEl);
    }

    // ── Phase 10: Real-time Collaboration with Yjs ──────────────────
    // Initialize CRDT document for multi-user synchronization.
    // Check for collaboration server URL (env var or query param).
    const getCollabServerUrl = (): string | null => {
      try {
        const url = new URL(window.location.href);
        const urlParam = url.searchParams.get("collab");
        if (urlParam) return urlParam;
      } catch {
        // ignore
      }
      return import.meta.env.VITE_COLLAB_SERVER || null;
    };

    const collabServerUrl = getCollabServerUrl();
    let provider: WebsocketProvider | null = null;
    let ydoc: Y.Doc | null = null;

    if (collabServerUrl) {
      try {
        // Create Yjs doc and map for elements
        ydoc = new Y.Doc();
        ymap = ydoc.getMap("excalidraw-elements");

        // Connect to collaboration server
        provider = new WebsocketProvider(collabServerUrl, "sveltedraw-room", ydoc);

        // Set local awareness state (cursor, user info)
        provider.awareness.setLocalState({
          user: {
            name: `User-${Math.random().toString(36).substr(2, 9)}`,
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          },
          cursor: null,
        });

        // Sync local elements to Yjs
        const elements = scene?.getElementsIncludingDeleted() ?? [];
        ymap!.set("elements", elements);

        // Listen for remote changes
        ymap!.observe((event: Y.YMapEvent<any>) => {
          for (const [key, change] of event.changes.entries()) {
            if (key === "elements" && change.action === "update") {
              const remoteElements = ymap!.get("elements");
              if (remoteElements && Array.isArray(remoteElements)) {
                // Update scene with remote elements
                scene?.replaceAllElements(
                  remoteElements.map((el: any) => deepCopyElement(el)),
                  { skipValidation: true }
                );
                bumpSceneRepaint();
              }
            }
          }
        });
      } catch (err) {
        console.warn("Collaboration setup failed:", err);
        // Continue without collaboration if server unavailable
      }
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
      containerEl?.removeEventListener("touchstart", onTouchStart);
      containerEl?.removeEventListener("touchmove", onTouchMove);
      containerEl?.removeEventListener("touchend", onTouchEnd);
      // A2: stop the laser RAF loop on unmount so callbacks don't fire
      // against a torn-down component.
      if (laserRafId !== null) {
        cancelAnimationFrame(laserRafId);
        laserRafId = null;
      }
      // Cleanup collaboration provider
      if (provider) {
        provider.destroy();
      }
      if (ydoc) {
        ydoc.destroy();
      }
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
    v: "selection",
    V: "selection",
    s: "selection",
    S: "selection",
    "2": "rectangle",
    r: "rectangle",
    R: "rectangle",
    "3": "diamond",
    d: "diamond",
    D: "diamond",
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
    // B2: eraser tool — 'e' hotkey matches upstream.
    e: "eraser",
    E: "eraser",
  };

  const setActiveTool = (type: string) => {
    // Commit any in-progress polyline before switching tool — otherwise
    // the floating newElement would leak across tool changes.
    if (polylineActive) commitPolyline();
    // A2: switching tools (or entering selection) exits laser. Matches
    // the plan's "Laser mode auto-exits on Esc or tool switch".
    if (laserActive) {
      laserActive = false;
      laserTrail = [];
    }
    // Preserve the lock flag across tool changes: if the user had
    // "tool lock" enabled with a drawing tool and draws a shape,
    // the pointerup handler skips the auto-switch — but when the
    // user DOES explicitly switch tool (via hotkey or toolbar),
    // we carry the lock forward so the next tool also stays.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locked = !!(appState as any).activeTool?.locked;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).activeTool = {
      type,
      customType: null,
      // Only meaningful for drawing tools; locked selection/hand etc.
      // would be a no-op so we just pass it through uniformly.
      locked,
      fromSelection: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastActiveTool: (appState as any).activeTool ?? null,
    };
  };

  // Toggle tool lock (Q in upstream). When on, the current drawing
  // tool stays active after a draw instead of falling back to
  // selection.
  const toggleToolLock = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const at = (appState as any).activeTool ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).activeTool = { ...at, locked: !at.locked };
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
    // Full snapshot (used as base or when delta is larger)
    full?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elements: any[];
      selectedElementIds: Record<string, true>;
    };
    // Delta snapshot (only changes from previous)
    delta?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      added: any[];
      modified: Array<{
        id: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        changes: Record<string, any>;
      }>;
      removed: string[];
    };
    timestamp: number;
  };
  const history: HistorySnapshot[] = [];
  let historyIndex = -1;
  let ymap: Y.Map<any> | null = null; // Phase 10: Collaboration map
  // Snapshots deep-clone all scene elements. A 100-element scene at
  // 1KB/element × 500 history entries ≈ 50MB — bounded. Without the
  // cap an active editing session leaks indefinitely. Using delta
  // snapshots reduces this by 40-60% on large scenes.
  const MAX_HISTORY = 500;

  // Deep equality check for elements (used in delta computation)
  const elementsEqual = (a: any, b: any): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    // Compare all keys
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (a[key] !== b[key]) {
        // Handle nested array/object comparison for arrays in elements
        if (Array.isArray(a[key]) && Array.isArray(b[key])) {
          if (a[key].length !== b[key].length) return false;
          if (!a[key].every((v: any, i: number) => v === b[key][i])) return false;
        } else {
          return false;
        }
      }
    }
    return true;
  };

  // Compute differences between two element sets
  const computeDelta = (prevElements: any[], currElements: any[]) => {
    const prevIds = new Set(prevElements.map((e: any) => e.id));
    const currIds = new Set(currElements.map((e: any) => e.id));

    const added = currElements.filter((e: any) => !prevIds.has(e.id)).map((el: any) => deepCopyElement(el));

    const removed = Array.from(prevIds).filter((id: string) => !currIds.has(id));

    const modified = currElements
      .filter((e: any) => prevIds.has(e.id))
      .filter((e: any) => {
        const prevEl = prevElements.find((el: any) => el.id === e.id);
        return !elementsEqual(prevEl, e);
      })
      .map((e: any) => {
        const prevEl = prevElements.find((el: any) => el.id === e.id);
        const changes: Record<string, any> = {};
        const keys = new Set([...Object.keys(prevEl), ...Object.keys(e)]);
        for (const key of keys) {
          if (prevEl[key] !== e[key]) {
            changes[key] = e[key];
          }
        }
        return { id: e.id, changes };
      });

    return { added, modified, removed };
  };

  const captureSnapshot = (): HistorySnapshot => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const els = scene?.getElementsIncludingDeleted() ?? [];
    const current = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elements: els.map((el: any) => deepCopyElement(el)),
      selectedElementIds: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((appState as any).selectedElementIds ?? {}),
      },
    };

    const timestamp = Date.now();

    // Always use full snapshot if history is empty (first snapshot)
    if (history.length === 0) {
      return { full: current, timestamp };
    }

    // Try delta snapshot if we have a previous full snapshot
    const prevFull = history
      .slice(0, historyIndex + 1)
      .reverse()
      .find((h) => h.full);

    if (prevFull?.full) {
      const delta = computeDelta(prevFull.full.elements, current.elements);
      const deltaSize = JSON.stringify(delta).length;
      const fullSize = JSON.stringify(current).length;

      // Use delta if it's smaller than full snapshot
      if (deltaSize < fullSize * 0.8) {
        return { delta, timestamp };
      }
    }

    // Fall back to full snapshot
    return { full: current, timestamp };
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
    // Enforce FIFO cap: drop oldest snapshots until under MAX_HISTORY.
    // The cap applies BEFORE we mutate historyIndex, so index ends up
    // at the last element of the capped array (still the current state).
    while (history.length > MAX_HISTORY) {
      history.shift();
      historyIndex--;
    }
    // Phase 10: Sync to collaboration server if connected
    if (ymap) {
      const elements = scene?.getElementsIncludingDeleted() ?? [];
      ymap.set("elements", elements);
    }
    scheduleSave();
    syncHistoryUI();
  };

  // Sync the reactive HistoryPanel view from the non-reactive history[] array.
  // Called wherever history mutates (push/undo/redo/jump/clear) so the UI
  // reflects the real undo stack. elementCount is approximated as the latest
  // known count — exact per-snapshot counts would require delta replay.
  const syncHistoryUI = () => {
    let lastCount = 0;
    editorHistory = history.map((snap, i) => {
      let count = lastCount;
      if (snap.full) {
        count = snap.full.elements.length;
      } else if (snap.delta) {
        count = lastCount + snap.delta.added.length - snap.delta.removed.length;
      }
      lastCount = count;
      let description = "Change";
      if (i === 0) description = "Initial state";
      else if (snap.full) description = "Snapshot";
      else if (snap.delta) {
        const d = snap.delta;
        const parts: string[] = [];
        if (d.added.length) parts.push(`+${d.added.length}`);
        if (d.removed.length) parts.push(`-${d.removed.length}`);
        if (d.modified.length) parts.push(`~${d.modified.length}`);
        description = parts.join(" ") || "Change";
      }
      return {
        id: `h-${i}-${snap.timestamp}`,
        timestamp: snap.timestamp,
        description,
        elementCount: count,
        previewDataUrl: undefined,
      };
    });
    historyCurrentIndex = historyIndex;
  };

  const applySnapshot = (snap: HistorySnapshot) => {
    if (!scene) return;

    let elements: any[];
    let selectedElementIds: Record<string, true>;

    if (snap.full) {
      // Direct full snapshot
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elements = snap.full.elements.map((el: any) => deepCopyElement(el));
      selectedElementIds = { ...snap.full.selectedElementIds };
    } else if (snap.delta) {
      // Reconstruct from previous full snapshot + deltas
      // Find the last full snapshot before this index
      let snapIdx = history.indexOf(snap);
      const prevFull = history
        .slice(0, snapIdx + 1)
        .reverse()
        .find((h) => h.full);

      if (!prevFull?.full) {
        console.error("No base snapshot found for delta reconstruction");
        return;
      }

      // Start with previous full snapshot
      elements = prevFull.full.elements.map((el: any) => deepCopyElement(el));

      // Apply all deltas from prevFull to current
      const startIdx = history.indexOf(prevFull) + 1;
      for (let i = startIdx; i <= snapIdx; i++) {
        const deltaSnap = history[i];
        if (deltaSnap.delta) {
          // Apply removed
          elements = elements.filter((e: any) => !deltaSnap.delta!.removed.includes(e.id));

          // Apply added
          elements.push(...deltaSnap.delta.added.map((el: any) => deepCopyElement(el)));

          // Apply modified
          for (const { id, changes } of deltaSnap.delta.modified) {
            const el = elements.find((e: any) => e.id === id);
            if (el) {
              Object.assign(el, changes);
            }
          }
        }
      }

      selectedElementIds = snap.full?.selectedElementIds ?? {};
    } else {
      console.error("Invalid snapshot: no full or delta");
      return;
    }

    scene.replaceAllElements(elements, { skipValidation: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = selectedElementIds;
    bumpSceneRepaint();
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    historyIndex--;
    applySnapshot(history[historyIndex]);
    syncHistoryUI();
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    applySnapshot(history[historyIndex]);
    syncHistoryUI();
  };

  // ── Frame management (Phase 11) ──────────────────────────────────────────
  const createFrame = (name: string, x: number, y: number, w: number, h: number) => {
    const id = randomId();
    frames.set(id, {
      id,
      name,
      elementIds: new Set(),
      x,
      y,
      w,
      h,
    });
    return id;
  };

  const deleteFrame = (frameId: string) => {
    frames.delete(frameId);
    if (currentFrameId === frameId) {
      currentFrameId = frames.size > 0 ? Array.from(frames.keys())[0] : null;
    }
  };

  const renameFrame = (frameId: string, name: string) => {
    const frame = frames.get(frameId);
    if (frame) {
      frame.name = name;
    }
  };

  const addElementToFrame = (frameId: string, elementId: string) => {
    const frame = frames.get(frameId);
    if (frame) {
      frame.elementIds.add(elementId);
    }
  };

  const removeElementFromFrame = (frameId: string, elementId: string) => {
    const frame = frames.get(frameId);
    if (frame) {
      frame.elementIds.delete(elementId);
    }
  };

  const switchFrame = (frameId: string) => {
    if (frames.has(frameId)) {
      currentFrameId = frameId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).selectedElementIds = {};
      bumpSceneRepaint();
    }
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
    // A8: locked elements survive bulk delete. Only unlocked IDs are
    // stripped; selection is cleared regardless so the locked ones aren't
    // left looking partially-selected.
    const selectedSet = new Set(
      selected.filter((el: any) => !el.locked).map((el) => el.id),
    );
    if (selectedSet.size === 0) return;
    // B1: if any deleted element is a frame, clear frameId on its
    // surviving children — otherwise they'd hold a dead reference and
    // export/presentation code that filters by frameId would silently
    // drop them. Upstream excalidraw does the same on frame removal.
    const deletedFrameIds = new Set<string>();
    for (const el of selected as any[]) {
      if (selectedSet.has(el.id) && el.type === "frame") {
        deletedFrameIds.add(el.id);
      }
    }
    if (deletedFrameIds.size > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const el of scene.getNonDeletedElements() as any[]) {
        if (selectedSet.has(el.id)) continue; // will be stripped anyway
        if (el.frameId && deletedFrameIds.has(el.frameId)) {
          scene.mutateElement(el, { frameId: null } as any,
            { informMutation: false, isDragging: false });
        }
      }
    }
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
    const cur = (appState as any).selectedElementIds ?? {};
    const next: Record<string, true> = {};
    let changed = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(el as any).locked) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        next[(el as any).id] = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!cur[(el as any).id]) changed = true;
      }
    }

    // Check if any were deselected
    if (!changed && Object.keys(cur).length === Object.keys(next).length) {
      // All selected elements are the same, no change needed
      return;
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

  // ── Group / ungroup ────────────────────────────────────────────────
  // Upstream stores group membership as `element.groupIds: string[]`
  // where groups nest outward (groupIds[-1] is the outermost). Ctrl+G
  // adds a fresh groupId to every selected element; Ctrl+Shift+G pops
  // the outermost group from each selected element.
  //
  // Click-to-expand (selecting one element of a group auto-selects
  // the whole group) is handled separately in the pointerdown flow.
  const groupSelected = () => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length < 2) return; // need ≥2 elements to form a group
    const newGroupId = randomId();
    for (const el of selected) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextGroupIds = [...(el.groupIds as string[]), newGroupId];
      scene.mutateElement(
        el,
        { groupIds: nextGroupIds },
        { informMutation: false, isDragging: false },
      );
    }
    pushHistory();
    bumpSceneRepaint();
  };

  const ungroupSelected = () => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    let changed = false;
    for (const el of selected) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = (el.groupIds as string[]) ?? [];
      if (ids.length === 0) continue;
      // Pop the outermost group (index length-1).
      const nextGroupIds = ids.slice(0, -1);
      scene.mutateElement(
        el,
        { groupIds: nextGroupIds },
        { informMutation: false, isDragging: false },
      );
      changed = true;
    }
    if (changed) {
      pushHistory();
      bumpSceneRepaint();
    }
  };

  // Expand selection to include every element sharing the outermost
  // group of `el`. Called from pointerdown's selection branch when the
  // user clicks a grouped element (but not Alt-held, which keeps
  // single-selection for targeted operations).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expandSelectionToGroup = (el: any): string[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupIds = (el.groupIds as string[]) ?? [];
    if (groupIds.length === 0) return [el.id];
    const outerGroup = groupIds[groupIds.length - 1];
    const siblings: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const other of scene!.getNonDeletedElements() as any[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((other.groupIds as string[])?.includes(outerGroup)) {
        siblings.push(other.id);
      }
    }
    return siblings;
  };

  // ── Shape library ──────────────────────────────────────────────────
  // localStorage-backed collection of reusable element groups.
  // Each item = { id, name, created, elements: deep-cloned snapshot }.
  // Save: current selection → named item.
  // Insert: click item → append duplicated elements at viewport center.
  //
  // Upstream has a much richer Library class (jotai-backed, file import
  // /export, IndexedDB-persisted). We skip those; localStorage is
  // sufficient for a PoC (each item ~few KB, typical library <50 items).
  const LIBRARY_KEY = "sveltedraw:library:v1";

  type LibraryItem = {
    id: string;
    name: string;
    created: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[];
  };

  let libraryItems = $state<LibraryItem[]>([]);
  let libraryPanelOpen = $state(false);
  let showTemplateSelector = $state(false);

  // A1: element-link dialog. Opens via Ctrl+K or context-menu on a single
  // selected element. `targetId` points at the element whose link we edit.
  let linkDialogOpen = $state(false);
  let linkDialogTargetId = $state<string | null>(null);

  // B2: eraser tool. `eraserDragActive` is the drag-in-progress flag;
  // `eraserDraggedIds` collects elements deleted during one drag so we
  // push a single history entry on pointerup (not one per shape).
  let eraserDragActive = false;
  const eraserDraggedIds = new Set<string>();

  const eraseAt = (sceneX: number, sceneY: number) => {
    if (!scene) return;
    const hit = hitTestAt(sceneX, sceneY);
    if (!hit) return;
    if ((hit as any).locked) return;
    if (eraserDraggedIds.has(hit.id)) return;
    scene.mutateElement(
      hit,
      { isDeleted: true },
      { informMutation: false, isDragging: false },
    );
    eraserDraggedIds.add(hit.id);
    bumpSceneRepaint();
  };

  // A2: laser pointer. `laserActive` toggles the tool; `laserTrail` holds
  // recent pointer samples; a RAF loop prunes points older than LASER_FADE_MS
  // so the SVG overlay shows a fading trail. Points are in viewport coords
  // (container-relative) — renderer doesn't need zoom/scroll math that way.
  const LASER_FADE_MS = 800;
  let laserActive = $state(false);
  let laserTrail = $state<Array<{ x: number; y: number; t: number }>>([]);
  // `laserFrame` bumps every RAF tick so the polyline re-evaluates opacity
  // continuously — otherwise a stationary pointer leaves the trail at a
  // stale opacity until the next sample lands.
  let laserFrame = $state(0);
  let laserRafId: number | null = null;

  const pruneLaserTrail = () => {
    const cutoff = performance.now() - LASER_FADE_MS;
    let i = 0;
    while (i < laserTrail.length && laserTrail[i].t < cutoff) i++;
    if (i > 0) laserTrail = laserTrail.slice(i);
    laserFrame++;
    if (laserActive || laserTrail.length > 0) {
      laserRafId = requestAnimationFrame(pruneLaserTrail);
    } else {
      laserRafId = null;
    }
  };

  const startLaserRaf = () => {
    if (laserRafId !== null) return;
    laserRafId = requestAnimationFrame(pruneLaserTrail);
  };

  const toggleLaser = () => {
    laserActive = !laserActive;
    if (laserActive) {
      startLaserRaf();
    } else {
      laserTrail = [];
    }
  };

  const openLinkDialog = () => {
    const sel = getSelectedElements();
    if (sel.length !== 1) return;
    linkDialogTargetId = sel[0].id;
    linkDialogOpen = true;
  };

  const confirmLinkDialog = (nextLink: string | null) => {
    if (!scene || !linkDialogTargetId) return;
    const el = scene.getElement(linkDialogTargetId);
    if (!el) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scene.mutateElement(el, { link: nextLink } as any,
      { informMutation: false, isDragging: false });
    pushHistory();
    bumpSceneRepaint();
  };

  const closeLinkDialog = () => {
    linkDialogOpen = false;
    linkDialogTargetId = null;
  };

  // Returns the live link for the dialog + chip renderer. Reads sceneReady
  // so mutateElement-driven bumps (including isDeleted flips) are tracked.
  const getLinkedElement = $derived.by(() => {
    void sceneReady;
    if (!linkDialogTargetId || !scene) return null;
    const el = scene.getElement(linkDialogTargetId);
    if (!el || (el as any).isDeleted) return null;
    return el;
  });

  // A1 robustness: auto-close the dialog when its target element is removed
  // or soft-deleted under our feet (e.g. erased while dialog is open).
  // Prevents a ghost modal that blocks pointer events on the rest of the UI.
  $effect(() => {
    if (linkDialogOpen && !getLinkedElement) {
      linkDialogOpen = false;
      linkDialogTargetId = null;
    }
  });

  // A1: chips are derived from selection + sceneReady nonce so they re-run
  // when mutateElement changes an element's .link (see the $derived body's
  // explicit void sceneReady — otherwise the .link read inside the
  // non-reactive getSelectedElements() call isn't tracked).
  const linkedSelected = $derived.by(() => {
    void sceneReady;
    return getSelectedElements().filter((el) => !!(el as any).link);
  });

  interface RecentFile {
    id: string;
    name: string;
    timestamp: number;
  }

  let recentFiles = $state<RecentFile[]>([]);
  let showRecentFiles = $state(false);
  const RECENT_FILES_KEY = "sveltedraw-recent-files";

  interface AppSettings {
    theme: "light" | "dark" | "auto";
    gridVisible: boolean;
    gridSize: number;
    snapToGrid: boolean;
    autoSaveInterval: number;
    undoHistorySize: number;
  }

  const DEFAULT_SETTINGS: AppSettings = {
    theme: "light",
    gridVisible: true,
    gridSize: 20,
    snapToGrid: false,
    autoSaveInterval: 30,
    undoHistorySize: 500,
  };

  let appSettings = $state<AppSettings>({ ...DEFAULT_SETTINGS });
  let showSettings = $state(false);
  const SETTINGS_KEY = "sveltedraw-settings";

  let showHelpPanel = $state(false);

  // Connector tool: click first shape → click second shape → arrow with
  // startBinding/endBinding between them. The arrow is a normal element,
  // so it renders + exports + undoes like any other arrow.
  let connectorToolActive = $state(false);
  let selectedForConnection: string | null = $state(null);

  // Phase 13: Smart Alignment & Guides
  let alignmentPanelActive = $state(false);
  let alignmentGuides = $state<AlignmentGuide[]>([]);

  // Phase 13: Measurement & Dimensions
  let measurementPanelActive = $state(false);
  let measurementConfig = $state<MeasurementConfig>({
    showRulers: false,
    showDistances: false,
    showDimensions: true,
    unit: "px",
    precision: 1,
  });

  // Phase 13: Auto-Layout Algorithm
  let autoLayoutPanelActive = $state(false);

  // Phase 14: Grid & Snap System
  let gridPanelActive = $state(false);
  let gridConfig = $state({
    enabled: true,
    size: 20,
    visible: false,
    opacity: 0.15,
  });
  let snapConfig = $state({
    enabled: true,
    threshold: 8,
    guides: true,
    // Phase 14 Feature 4: Snap preferences
    snapToGrid: true,
    snapToElements: true,
    snapEdges: true,
    snapCenters: true,
    showDistance: true,
  });

  // Phase 14: Snap Guides
  let snapGuides = $state<SnapGuide[]>([]);
  let isDraggingForSnap = $state(false);

  // Phase 15: Layer Management
  let layerPanelActive = $state(false);
  let layers = $state<LayerItem[]>([]);
  let selectedLayerId = $state<string | null>(null);
  let expandedGroups = $state<Set<string>>(new Set());

  // Phase 16: History Panel & Timeline
  let historyPanelActive = $state(false);
  let editorHistory = $state<HistoryState[]>([]);
  let historyCurrentIndex = $state(0);

  // Phase 16 Feature 2: Shape Library & Component Manager
  const libraryConfig = getDefaultLibraryConfig();
  let libraryPanelActive = $state(false);
  let libraryComponents = $state<LibraryComponent[]>([]);
  let libraryCategories = $state<LibraryCategory[]>(libraryConfig.defaultCategories);
  let librarySelectedCategory = $state('all');
  let librarySearchQuery = $state('');

  // Phase 16 Feature 3: Presentation Mode
  const presentationConfig = getDefaultPresentationConfig();
  let presentationActive = $state(false);
  let presentationSlides = $state<PresentationSlide[]>([]);
  let presentationSlideSvgs = $state<string[]>([]);
  let presentationCurrentIndex = $state(0);
  let presentationIsPlaying = $state(false);

  // D3: auto-advance while playing. Clears on stop/exit so no stale timers
  // fire after the user pauses or closes the presentation.
  $effect(() => {
    if (!presentationActive || !presentationIsPlaying) return;
    const ms = presentationConfig.autoAdvanceDuration;
    if (!ms || ms <= 0) return;
    const id = setInterval(() => handlePresentationNextSlide(), ms);
    return () => clearInterval(id);
  });

  // Phase 16 Feature 4: Export Enhancements
  let exportPanelActive = $state(false);
  let exportOptions = $state<ExportOptions>(getDefaultExportOptions());
  let exportPresets = $state<ExportPreset[]>(EXPORT_PRESETS);
  let batchExportConfig = $state(getDefaultBatchExportConfig());

  // Unified side-panel toggle: mutually exclusive. Opening one closes
  // the others so they don't stack/overlap off-screen. Keep connector
  // tool out of this group — it's tied to a drawing tool, not a panel.
  type SidePanelId =
    | "alignment"
    | "measurement"
    | "autolayout"
    | "grid"
    | "layer"
    | "history"
    | "library";

  const isSidePanelOpen = (name: SidePanelId): boolean => {
    switch (name) {
      case "alignment": return alignmentPanelActive;
      case "measurement": return measurementPanelActive;
      case "autolayout": return autoLayoutPanelActive;
      case "grid": return gridPanelActive;
      case "layer": return layerPanelActive;
      case "history": return historyPanelActive;
      case "library": return libraryPanelActive;
    }
  };

  const closeAllSidePanels = () => {
    alignmentPanelActive = false;
    measurementPanelActive = false;
    autoLayoutPanelActive = false;
    gridPanelActive = false;
    layerPanelActive = false;
    historyPanelActive = false;
    libraryPanelActive = false;
  };

  const toggleSidePanel = (name: SidePanelId) => {
    const wasOpen = isSidePanelOpen(name);
    closeAllSidePanels();
    if (wasOpen) return;
    switch (name) {
      case "alignment": alignmentPanelActive = true; break;
      case "measurement": measurementPanelActive = true; break;
      case "autolayout": autoLayoutPanelActive = true; break;
      case "grid": gridPanelActive = true; break;
      case "layer": layerPanelActive = true; break;
      case "history": historyPanelActive = true; break;
      case "library": libraryPanelActive = true; break;
    }
  };

  const loadLibrary = () => {
    try {
      const raw = localStorage.getItem(LIBRARY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LibraryItem[];
      if (Array.isArray(parsed)) libraryItems = parsed;
    } catch {
      /* corrupted — start fresh */
    }
  };
  const persistLibrary = () => {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(libraryItems));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("sveltedraw: library persist failed", err);
    }
  };

  const saveSelectionToLibrary = () => {
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    const name =
      window.prompt(
        t("labels.group") + " name",
        `${t("labels.group")} ${libraryItems.length + 1}`,
      ) ?? null;
    if (name === null) return; // user cancelled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cloned = selected.map((el: any) => deepCopyElement(el));
    const item: LibraryItem = {
      id: randomId(),
      name: name.trim() || `Item ${libraryItems.length + 1}`,
      created: Date.now(),
      elements: cloned,
    };
    libraryItems = [...libraryItems, item];
    persistLibrary();
  };

  // Insert a library item at the viewport center. Each element gets
  // a fresh randomId so repeat inserts don't collide with the originals
  // still in the scene (or with themselves).
  const insertLibraryItem = (item: LibraryItem) => {
    if (!scene) return;
    // Compute bbox of saved elements so we can translate the copy to
    // the viewport center.
    let minX = Infinity, minY = Infinity;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of item.elements as any[]) {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomV = (appState.zoom as any).value || 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrollX = (appState as any).scrollX ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrollY = (appState as any).scrollY ?? 0;
    const targetSceneX = appState.width / 2 / zoomV - scrollX;
    const targetSceneY = appState.height / 2 / zoomV - scrollY;
    const tx = targetSceneX - minX;
    const ty = targetSceneY - minY;

    // Build a local id-remap so group references stay consistent
    // within this inserted copy (if the saved item had grouped
    // elements, they remain grouped in the insert — with a fresh
    // group id scoped to this paste).
    const idRemap = new Map<string, string>();
    const groupRemap = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of item.elements as any[]) {
      idRemap.set(el.id, randomId());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const gid of (el.groupIds as string[]) ?? []) {
        if (!groupRemap.has(gid)) groupRemap.set(gid, randomId());
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fresh = item.elements.map((el: any) => ({
      ...deepCopyElement(el),
      id: idRemap.get(el.id)!,
      x: el.x + tx,
      y: el.y + ty,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      groupIds: ((el.groupIds as string[]) ?? []).map((g) =>
        groupRemap.get(g) ?? g,
      ),
      // Re-index so fractionalIndices generate fresh on replaceAllElements.
      index: null,
      // Bump version so the renderer treats them as new.
      version: 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: Date.now(),
    }));

    const existing = scene.getElementsIncludingDeleted();
    scene.replaceAllElements([...existing, ...fresh], {
      skipValidation: true,
    });
    const nextSel: Record<string, true> = {};
    for (const el of fresh) nextSel[el.id] = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = nextSel;
    pushHistory();
    bumpSceneRepaint();
  };

  const deleteLibraryItem = (id: string) => {
    libraryItems = libraryItems.filter((it) => it.id !== id);
    persistLibrary();
  };

  const loadRecentFiles = () => {
    try {
      const raw = localStorage.getItem(RECENT_FILES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RecentFile[];
      if (Array.isArray(parsed)) recentFiles = parsed;
    } catch {
      /* corrupted — start fresh */
    }
  };

  const persistRecentFiles = () => {
    try {
      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles));
    } catch {
      /* quota exceeded */
    }
  };

  const addToRecentFiles = (filename: string) => {
    const existing = recentFiles.find(
      (f) => f.name.toLowerCase() === filename.toLowerCase(),
    );
    if (existing) {
      existing.timestamp = Date.now();
    } else {
      recentFiles.unshift({
        id: randomId(),
        name: filename,
        timestamp: Date.now(),
      });
    }
    // Keep only last 10 files
    if (recentFiles.length > 10) {
      recentFiles = recentFiles.slice(0, 10);
    }
    persistRecentFiles();
  };

  const deleteRecentFile = (id: string) => {
    recentFiles = recentFiles.filter((f) => f.id !== id);
    persistRecentFiles();
  };

  const loadSettings = () => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as AppSettings;
      appSettings = { ...DEFAULT_SETTINGS, ...parsed };
      applySettings();
    } catch {
      /* corrupted — use defaults */
    }
  };

  const persistSettings = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
    } catch {
      /* quota exceeded */
    }
  };

  const applySettings = () => {
    // Apply theme
    if (appSettings.theme === "dark") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).theme = "dark";
    } else if (appSettings.theme === "light") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).theme = "light";
    }
    // Apply grid settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).gridModeEnabled = appSettings.gridVisible;
  };

  const updateSettings = (newSettings: AppSettings) => {
    appSettings = newSettings;
    applySettings();
    persistSettings();
  };

  // Load template and create elements from it
  const selectTemplate = (template: Template) => {
    if (!scene) return;

    // Convert template elements to proper excalidraw elements
    const newElements = template.elements.map((templateEl: any) => {
      const el = newElement({
        type: templateEl.type || 'rectangle',
        x: templateEl.x ?? 0,
        y: templateEl.y ?? 0,
        width: templateEl.width ?? 100,
        height: templateEl.height ?? 100,
        strokeColor: templateEl.strokeColor ?? '#000000',
        backgroundColor: templateEl.backgroundColor ?? '#ffffff',
        fillStyle: templateEl.fillStyle ?? 'solid',
        strokeWidth: templateEl.strokeWidth ?? 1,
        text: templateEl.text ?? '',
      });
      return el;
    });

    // Clear existing elements and replace with template
    scene.replaceAllElements(newElements, { skipValidation: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = {};
    pushHistory();
    bumpSceneRepaint();
    showTemplateSelector = false;
  };

  // Create an arrow element from center of `fromEl` to center of `toEl`
  // with two-way bindings. updateBoundElements — called when either end
  // moves — automatically reroutes the arrow to stay attached.
  const createConnectorArrow = (fromId: string, toId: string) => {
    if (!scene) return;
    const fromEl = scene.getElement(fromId);
    const toEl = scene.getElement(toId);
    if (!fromEl || !toEl) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = fromEl as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = toEl as any;
    const fx = f.x + (f.width ?? 0) / 2;
    const fy = f.y + (f.height ?? 0) / 2;
    const tx = t.x + (t.width ?? 0) / 2;
    const ty = t.y + (t.height ?? 0) / 2;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arrow: any = newArrowElement({
      x: fx,
      y: fy,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      points: [
        [0, 0],
        [tx - fx, ty - fy],
      ],
      endArrowhead: "arrow",
      startArrowhead: null,
      type: "arrow",
    } as any);
    // Center-bind both endpoints. updateBoundElements will move the arrow
    // endpoints as the bound shapes move.
    arrow.startBinding = {
      elementId: fromId,
      fixedPoint: [0.5, 0.5],
      mode: "inside",
    };
    arrow.endBinding = {
      elementId: toId,
      fixedPoint: [0.5, 0.5],
      mode: "inside",
    };

    const existing = scene.getElementsIncludingDeleted();
    scene.replaceAllElements([...existing, arrow], { skipValidation: true });

    // Register the arrow in each bound shape's boundElements array. Without
    // this, updateBoundElements visits zero arrows when either shape moves.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appendBinding = (shape: any) => {
      const list = Array.isArray(shape.boundElements) ? shape.boundElements : [];
      if (list.some((b: any) => b.id === arrow.id)) return;
      scene.mutateElement(
        shape,
        { boundElements: [...list, { id: arrow.id, type: "arrow" }] },
        { informMutation: false, isDragging: false },
      );
    };
    appendBinding(fromEl);
    appendBinding(toEl);

    pushHistory();
    bumpSceneRepaint();
  };

  // ── Smart Alignment & Guides ─────────────────────────────────────────
  const handleAlign = (alignmentType: AlignmentType) => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length < 2) return;

    const elements = selected.map(el => ({
      id: el.id,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: el.angle,
    }));

    const aligned = alignElements(elements, alignmentType);
    for (const el of selected) {
      const updated = aligned.find((a) => a.id === el.id);
      if (updated) {
        el.x = updated.x;
        el.y = updated.y;
      }
    }
    pushHistory();
    bumpSceneRepaint();
  };

  const handleDistribute = (distributionType: DistributionType) => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length < 3) return;

    const elements = selected.map(el => ({
      id: el.id,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: el.angle,
    }));

    const distributed = distributeElements(elements, distributionType);
    for (const el of selected) {
      const updated = distributed.find((a) => a.id === el.id);
      if (updated) {
        el.x = updated.x;
        el.y = updated.y;
      }
    }
    pushHistory();
    bumpSceneRepaint();
  };

  const updateAlignmentGuides = () => {
    const selected = getSelectedElements();
    if (selected.length < 2) {
      alignmentGuides = [];
      return;
    }

    const elements = selected.map(el => ({
      id: el.id,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: el.angle,
    }));

    alignmentGuides = calculateAlignmentGuides(elements);
  };

  const handleAutoLayout = (config: LayoutConfig) => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length < 2) return;

    const elements = selected.map(el => ({
      id: el.id,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: el.angle,
    }));

    const layoutResults = calculateLayout(elements, config);
    const newElements = applyLayout(elements, layoutResults);

    for (const el of selected) {
      const updated = newElements.find((a) => a.id === el.id);
      if (updated) {
        el.x = updated.x;
        el.y = updated.y;
      }
    }
    pushHistory();
    bumpSceneRepaint();
  };

  // Phase 15: Layer Management
  const syncLayersFromScene = () => {
    if (!scene) return;
    const elements = scene.getNonDeletedElements();

    // Check if element count changed - if not, skip rebuild
    const currentElementIds = new Set(layers.filter(l => l.type === 'element').map(l => l.id));
    const newElementIds = new Set(elements.map(el => el.id));

    let hasChanges = currentElementIds.size !== newElementIds.size;
    if (!hasChanges) {
      for (const id of newElementIds) {
        if (!currentElementIds.has(id)) {
          hasChanges = true;
          break;
        }
      }
    }

    if (!hasChanges) return; // Skip rebuild if nothing changed

    // Build flat layer array for ungrouped elements only
    const newLayers: LayerItem[] = [];

    // First, add existing groups
    for (const layer of layers) {
      if (layer.type === 'group') {
        newLayers.push(layer);
      }
    }

    // Add ungrouped elements
    for (let idx = 0; idx < elements.length; idx++) {
      const el = elements[idx];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const groupId = (el as any).__layerGroupId;
      if (!groupId) {
        newLayers.push({
          id: el.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: (el as any).customLayerName || getLayerName(el),
          visible: !el.isDeleted,
          locked: el.locked || false,
          opacity: el.opacity ?? 1,
          type: 'element' as const,
          order: idx,
        });
      }
    }

    // Add grouped elements as children
    for (const layer of newLayers) {
      if (layer.type === 'group' && layer.children) {
        for (const childId of layer.children) {
          const el = elements.find(e => e.id === childId);
          if (el) {
            newLayers.push({
              id: el.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name: (el as any).customLayerName || getLayerName(el),
              visible: !el.isDeleted,
              locked: el.locked || false,
              opacity: el.opacity ?? 1,
              type: 'element' as const,
              parentId: layer.id,
              order: newLayers.length,
            });
          }
        }
      }
    }

    layers = newLayers;
  };

  const handleLayerSelect = (layerId: string) => {
    selectedLayerId = layerId;
    // Select the element in the scene
    if (scene) {
      const element = scene.getNonDeletedElementsMap().get(layerId);
      if (element) {
        appState.selectedElementIds = { [layerId]: true };
        // Highlight the element visually
        bumpSceneRepaint();
      }
    }
  };

  const syncSelectionFromCanvas = () => {
    // When canvas selection changes, update layer selection
    const selected = getSelectedElements();
    if (selected.length === 1) {
      selectedLayerId = selected[0].id;
    } else if (selected.length === 0) {
      selectedLayerId = null;
    } else {
      // Multiple elements selected - highlight first
      selectedLayerId = selected[0].id;
    }
  };

  const handleReorderLayers = (fromId: string, toId: string) => {
    if (!scene || fromId === toId) return;

    const elements = scene.getNonDeletedElements();
    const fromIndex = elements.findIndex(el => el.id === fromId);
    const toIndex = elements.findIndex(el => el.id === toId);

    if (fromIndex === -1 || toIndex === -1) return;

    // Determine if we're moving up or down
    if (fromIndex < toIndex) {
      // Moving down (towards lower z-order)
      for (let i = fromIndex; i < toIndex; i++) {
        const temp = elements[i];
        elements[i] = elements[i + 1];
        elements[i + 1] = temp;
      }
    } else {
      // Moving up (towards higher z-order)
      for (let i = fromIndex; i > toIndex; i--) {
        const temp = elements[i];
        elements[i] = elements[i - 1];
        elements[i - 1] = temp;
      }
    }

    // Update the scene with new order
    scene.replaceAllElements(elements, { skipValidation: true });
    pushHistory();
    bumpSceneRepaint();
    syncLayersFromScene();
  };

  const handleLayerVisibilityChange = (layerId: string, visible: boolean) => {
    if (!scene) return;
    const element = scene.getNonDeletedElementsMap().get(layerId);
    if (!element) return;

    element.isDeleted = !visible;
    pushHistory();
    bumpSceneRepaint();
    syncLayersFromScene();
  };

  const handleLayerLockChange = (layerId: string, locked: boolean) => {
    if (!scene) return;
    const element = scene.getNonDeletedElementsMap().get(layerId);
    if (!element) return;

    element.locked = locked;
    pushHistory();
    bumpSceneRepaint();
    syncLayersFromScene();
  };

  const handleLayerOpacityChange = (layerId: string, opacity: number) => {
    if (!scene) return;
    const element = scene.getNonDeletedElementsMap().get(layerId);
    if (!element) return;

    element.opacity = Math.max(0, Math.min(1, opacity));
    pushHistory();
    bumpSceneRepaint();
    syncLayersFromScene();
  };

  const handleCreateGroup = () => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length === 0) return;

    // Create a group with a unique ID
    const groupId = randomId();
    const groupName = `Group ${layers.filter(l => l.type === 'group').length + 1}`;

    // Mark all selected elements with parentId
    for (const el of selected) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any).__layerGroupId = groupId;
    }

    // Store group metadata in a map (since elements don't have a direct "group" type in Excalidraw)
    // For now, we'll track groups in the layers array itself
    layers = [
      {
        id: groupId,
        name: groupName,
        visible: true,
        locked: false,
        opacity: 1,
        type: 'group' as const,
        children: selected.map(el => el.id),
        order: 0,
      },
      ...layers,
    ];

    pushHistory();
    bumpSceneRepaint();
    expandedGroups.add(groupId);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (!scene) return;

    // Find the group
    const groupIndex = layers.findIndex(l => l.id === groupId && l.type === 'group');
    if (groupIndex === -1) return;

    const group = layers[groupIndex];

    // Remove parentId from all child elements (promote to root)
    for (const el of scene.getNonDeletedElements()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((el as any).__layerGroupId === groupId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (el as any).__layerGroupId;
      }
    }

    // Remove the group from layers
    layers = layers.filter(l => l.id !== groupId);
    expandedGroups.delete(groupId);

    pushHistory();
    bumpSceneRepaint();
  };

  // ── Phase 16: History Management ──────────────────────────────────
  const handleHistoryJump = (index: number) => {
    if (index < 0 || index >= history.length) return;
    historyIndex = index;
    applySnapshot(history[index]);
    syncHistoryUI();
  };

  // Clear wipes the undo stack but preserves the current state so the user
  // doesn't lose their drawing. The new history starts with a single full
  // snapshot of what's on the canvas right now.
  const handleHistoryClear = () => {
    const current = captureSnapshot();
    history.length = 0;
    history.push(current);
    historyIndex = 0;
    syncHistoryUI();
  };

  // ── Phase 16 Feature 2: Library Management ─────────────────────────
  const handleSaveComponentToLibrary = () => {
    const selected = getSelectedElements();
    if (selected.length === 0) return;

    const name = window.prompt('Component name', `Component ${libraryComponents.length + 1}`);
    if (name === null) return;

    const category = librarySelectedCategory === 'all' ? 'custom' : librarySelectedCategory;
    const component = createLibraryComponent(name, category, selected);
    libraryComponents = [...libraryComponents, component];
  };

  const handleLibraryComponentSelect = (component: LibraryComponent) => {
    if (!scene) return;
    if (!Array.isArray(component.elements) || component.elements.length === 0) {
      return;
    }

    // Translate to viewport center: compute min(x,y) of the component's
    // bbox and shift so the component lands where the user is looking.
    let minX = Infinity;
    let minY = Infinity;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of component.elements as any[]) {
      if (typeof el.x === "number" && el.x < minX) minX = el.x;
      if (typeof el.y === "number" && el.y < minY) minY = el.y;
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      minX = 0;
      minY = 0;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomV = (appState.zoom as any)?.value || 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrollX = (appState as any).scrollX ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrollY = (appState as any).scrollY ?? 0;
    const targetSceneX = appState.width / 2 / zoomV - scrollX;
    const targetSceneY = appState.height / 2 / zoomV - scrollY;
    const tx = targetSceneX - minX;
    const ty = targetSceneY - minY;

    // Fresh ids so repeat inserts don't collide. Preserve intra-component
    // group relations by remapping groupIds consistently within this insert.
    const idRemap = new Map<string, string>();
    const groupRemap = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of component.elements as any[]) {
      idRemap.set(el.id, randomId());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const gid of (el.groupIds as string[]) ?? []) {
        if (!groupRemap.has(gid)) groupRemap.set(gid, randomId());
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fresh = component.elements.map((el: any) => ({
      ...deepCopyElement(el),
      id: idRemap.get(el.id)!,
      x: (el.x ?? 0) + tx,
      y: (el.y ?? 0) + ty,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      groupIds: ((el.groupIds as string[]) ?? []).map((g) =>
        groupRemap.get(g) ?? g,
      ),
      // Re-index so fractionalIndices regenerate fresh on replaceAllElements.
      index: null,
      version: 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: Date.now(),
    }));

    const existing = scene.getElementsIncludingDeleted();
    scene.replaceAllElements([...existing, ...fresh], {
      skipValidation: true,
    });
    const nextSel: Record<string, true> = {};
    for (const el of fresh) nextSel[el.id] = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = nextSel;

    // Bump usage + persist.
    const index = libraryComponents.findIndex((c) => c.id === component.id);
    if (index !== -1) {
      libraryComponents[index].usage += 1;
    }

    pushHistory();
    bumpSceneRepaint();
  };

  const handleLibraryComponentDelete = (componentId: string) => {
    libraryComponents = libraryComponents.filter(c => c.id !== componentId);
  };

  const handleLibraryExport = () => {
    const json = JSON.stringify(libraryComponents, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shape-library-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLibraryImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target?.result as string);
          if (Array.isArray(imported)) {
            libraryComponents = [...libraryComponents, ...imported];
          }
        } catch (err) {
          console.error('Failed to import library:', err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // ── Phase 16 Feature 3: Presentation Mode ──────────────────────────
  // If the scene has frames, each frame becomes a slide (its elements only).
  // Otherwise a single slide with every element. Each slide is pre-rendered
  // to SVG so PresentationMode can display actual drawing content, not just
  // a title card.
  const handleStartPresentation = async () => {
    if (!scene) return;
    const allElements = scene.getNonDeletedElements();
    if (allElements.length === 0) {
      window.alert("Draw something first, then start the presentation.");
      return;
    }

    const frameList = Array.from(frames.values());
    let slides: PresentationSlide[];
    if (frameList.length > 0) {
      slides = frameList.map((frame, i) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const frameElements = allElements.filter((el: any) =>
          frame.elementIds.has(el.id),
        );
        return createPresentationSlide(
          frame.name,
          frameElements,
          i,
          `${frameElements.length} element${frameElements.length === 1 ? "" : "s"}`,
        );
      });
    } else {
      slides = [
        createPresentationSlide(
          "Drawing",
          allElements,
          0,
          `${allElements.length} element${allElements.length === 1 ? "" : "s"}`,
        ),
      ];
    }

    // Pre-render each slide to an SVG string. Strip width/height so the
    // SVG scales to fit the presentation container.
    const svgs = await Promise.all(
      slides.map(async (slide) => {
        if (slide.elements.length === 0) return "";
        try {
          const svg = await exportToSvg({
            elements: slide.elements,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            appState: appState as any,
            files: binaryFiles,
            exportPadding: 40,
          });
          svg.removeAttribute("width");
          svg.removeAttribute("height");
          svg.setAttribute(
            "style",
            "max-width: 100%; max-height: 100%; width: auto; height: auto; display: block; margin: 0 auto;",
          );
          return svg.outerHTML;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("sveltedraw: slide svg failed", err);
          return "";
        }
      }),
    );

    presentationSlides = slides;
    presentationSlideSvgs = svgs;
    presentationCurrentIndex = 0;
    presentationIsPlaying = false;
    presentationActive = true;
  };

  const handlePresentationNextSlide = () => {
    if (presentationCurrentIndex < presentationSlides.length - 1) {
      presentationCurrentIndex += 1;
    } else if (presentationConfig.loopOnEnd) {
      presentationCurrentIndex = 0;
    }
  };

  const handlePresentationPreviousSlide = () => {
    if (presentationCurrentIndex > 0) {
      presentationCurrentIndex -= 1;
    }
  };

  const handlePresentationTogglePlayPause = () => {
    presentationIsPlaying = !presentationIsPlaying;
  };

  const handlePresentationExit = () => {
    presentationActive = false;
    presentationIsPlaying = false;
    presentationCurrentIndex = 0;
  };

  const handlePresentationSlideJump = (index: number) => {
    if (index >= 0 && index < presentationSlides.length) {
      presentationCurrentIndex = index;
    }
  };

  // ── Phase 16 Feature 4: Export Enhancements ──────────────────────────
  // buildExportAppState overrides a few appState fields the export helpers
  // read. exportScale is the scene→pixel ratio; exportBackground toggles the
  // viewBackgroundColor rect.
  const buildExportAppState = (options: ExportOptions) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(appState as any),
    exportScale: options.scale,
    exportBackground: options.includeBackground,
  });

  const handleExport = async (options: ExportOptions) => {
    if (!scene) return;

    const elements = scene.getNonDeletedElements();
    const padding = options.includeBorder ? options.borderWidth : 10;

    try {
      switch (options.format) {
        case "json": {
          const json = JSON.stringify(
            {
              type: "excalidraw",
              version: 2,
              source: window.location.origin,
              elements,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              appState: { viewBackgroundColor: (appState as any).viewBackgroundColor },
              files: binaryFiles,
            },
            null,
            2,
          );
          const blob = new Blob([json], { type: "application/json" });
          downloadFile(blob, options.fileName + ".json");
          break;
        }

        case "svg": {
          const svg = await exportToSvg({
            elements,
            appState: buildExportAppState(options),
            files: binaryFiles,
            exportPadding: padding,
          });
          // Force target width/height attributes on the SVG root. The viewBox
          // (set by upstream from the content bbox) stays, so vectors scale.
          svg.setAttribute("width", String(options.width * options.scale));
          svg.setAttribute("height", String(options.height * options.scale));
          if (options.includeBorder) {
            const vb = (svg.getAttribute("viewBox") ?? "0 0 0 0")
              .split(/\s+/)
              .map(Number);
            if (vb.length === 4 && vb.every(Number.isFinite)) {
              const [vx, vy, vw, vh] = vb;
              const bw = options.borderWidth;
              const ns = "http://www.w3.org/2000/svg";
              const rect = document.createElementNS(ns, "rect");
              rect.setAttribute("x", String(vx + bw / 2));
              rect.setAttribute("y", String(vy + bw / 2));
              rect.setAttribute("width", String(Math.max(0, vw - bw)));
              rect.setAttribute("height", String(Math.max(0, vh - bw)));
              rect.setAttribute("fill", "none");
              rect.setAttribute("stroke", options.borderColor);
              rect.setAttribute("stroke-width", String(bw));
              svg.appendChild(rect);
            }
          }
          const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
          downloadFile(blob, options.fileName + ".svg");
          break;
        }

        case "png": {
          const targetW = Math.max(1, options.width);
          const targetH = Math.max(1, options.height);
          const densityScale = Math.max(0.01, options.scale);
          const blob = await exportToBlob({
            elements,
            appState: buildExportAppState(options),
            files: binaryFiles,
            mimeType: "image/png",
            quality: options.quality,
            exportPadding: padding,
            // Fit natural bbox into target w×h with preserved aspect, then
            // apply densityScale as a pixel-density multiplier. Canvas ends
            // up exactly (targetW * scale) × (targetH * scale) pixels.
            getDimensions: (naturalW: number, naturalH: number) => {
              const fit = Math.min(targetW / naturalW, targetH / naturalH);
              return {
                width: Math.round(targetW * densityScale),
                height: Math.round(targetH * densityScale),
                scale: fit * densityScale,
              };
            },
          });
          downloadFile(blob, options.fileName + ".png");
          break;
        }

        case "pdf": {
          // A7: render scene to PNG via the PNG pipeline, then embed into
          // a single-page PDF. jspdf is lazy-loaded so its ~350KB only
          // hits the user's bundle when they actually ask for a PDF.
          const targetW = Math.max(1, options.width);
          const targetH = Math.max(1, options.height);
          const densityScale = Math.max(0.01, options.scale);
          const pngBlob = await exportToBlob({
            elements,
            appState: buildExportAppState(options),
            files: binaryFiles,
            mimeType: "image/png",
            quality: options.quality,
            exportPadding: padding,
            getDimensions: (naturalW: number, naturalH: number) => {
              const fit = Math.min(targetW / naturalW, targetH / naturalH);
              return {
                width: Math.round(targetW * densityScale),
                height: Math.round(targetH * densityScale),
                scale: fit * densityScale,
              };
            },
          });
          // Convert blob → data URL for addImage.
          const dataUrl: string = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => reject(r.error);
            r.readAsDataURL(pngBlob);
          });
          // Lazy-load jspdf. vite resolves from root node_modules.
          const { jsPDF } = await import("jspdf");
          // Page size = target canvas size in px (pt unit keeps the math
          // simple: 1 px ≈ 0.75 pt at 96 dpi, but we pass pixels as "pt"
          // so the page matches the drawing's pixel dimensions). Opens at
          // 100% zoom in all PDF viewers.
          const doc = new jsPDF({
            orientation: targetW >= targetH ? "landscape" : "portrait",
            unit: "pt",
            format: [targetW, targetH],
            compress: true,
          });
          doc.addImage(dataUrl, "PNG", 0, 0, targetW, targetH);
          const pdfBlob = doc.output("blob");
          downloadFile(pdfBlob as Blob, options.fileName + ".pdf");
          break;
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("sveltedraw: export failed", err);
      window.alert(`Export failed: ${(err as Error).message ?? err}`);
      return;
    }

    exportPanelActive = false;
  };

  const downloadFile = (blob: Blob, fileName: string) => {
    // Test hook: when defined on window, captures the blob + filename instead
    // of initiating a download. Lets puppeteer verify PDF/PNG/SVG byte output
    // without fighting headless Chrome's download handler.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hook = (window as any).__sveltedrawDownloadHook;
    if (typeof hook === "function") {
      try { hook(blob, fileName); return; } catch { /* fall through */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Z-order: bring forward / send backward / to front / to back ─────
  // Upstream's shiftElementsByOne returns the full reordered array;
  // replaceAllElements with skipValidation bypasses fractional-index
  // validation since upstream sync happens inside replaceAllElements.
  const reorderSelected = (
    direction: "forward" | "backward" | "front" | "back",
  ) => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    const elements = scene.getElementsIncludingDeleted();
    let next;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const as = appState as any;
    if (direction === "forward") next = moveOneRight(elements, as, scene);
    else if (direction === "backward") next = moveOneLeft(elements, as, scene);
    else if (direction === "front") next = moveAllRight(elements, as);
    else next = moveAllLeft(elements, as);
    scene.replaceAllElements(next, { skipValidation: true });
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

  // ── .excalidraw JSON file open/save ────────────────────────────
  // Serializes the full scene (elements + appState subset + files) to
  // a .excalidraw JSON file the user can download; load reads one
  // back in via a file-picker.
  const saveAsExcalidrawFile = async () => {
    if (!scene) return;
    const elements = scene.getNonDeletedElements();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: window.location.origin,
      elements,
      appState: {
        gridSize: (appState as any).gridSize,
        gridStep: (appState as any).gridStep,
        gridModeEnabled: (appState as any).gridModeEnabled,
        viewBackgroundColor: (appState as any).viewBackgroundColor,
        theme: (appState as any).theme,
      },
      files: binaryFiles,
    }, null, 2);
    const blob = new Blob([json], { type: "application/vnd.excalidraw+json" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (appState as any).name || "sveltedraw";
    triggerDownload(blob, `${name}.excalidraw`);
  };

  const loadFromExcalidrawFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".excalidraw,application/json,application/vnd.excalidraw+json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !scene) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.elements)) {
          throw new Error("Invalid .excalidraw file");
        }
        scene.replaceAllElements(parsed.elements, { skipValidation: true });
        if (parsed.appState) {
          for (const key of ["viewBackgroundColor", "theme", "gridModeEnabled"]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (parsed.appState[key] !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (appState as any)[key] = parsed.appState[key];
            }
          }
        }
        clearSelection();
        pushHistory();
        bumpSceneRepaint();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("sveltedraw: failed to load file", err);
        window.alert("Failed to load .excalidraw file");
      }
    };
    input.click();
  };

  const toggleGrid = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).gridModeEnabled = !(appState as any).gridModeEnabled;
    scheduleSave();
    bumpSceneRepaint();
  };

  // ── Burger main menu ────────────────────────────────────────────
  let mainMenuOpen = $state(false);
  let helpDialogOpen = $state(false);
  const closeMainMenu = () => (mainMenuOpen = false);

  $effect(() => {
    if (!mainMenuOpen) return;
    const onDocPointerDown = (e: PointerEvent) => {
      // Stay open if click is inside the menu itself.
      const t = e.target as HTMLElement | null;
      if (t?.closest(".sveltedraw-main-menu")) return;
      if (t?.closest(".sveltedraw-main-menu-trigger")) return;
      closeMainMenu();
    };
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMainMenu();
    };
    window.addEventListener("pointerdown", onDocPointerDown);
    window.addEventListener("keydown", onDocKey);
    return () => {
      window.removeEventListener("pointerdown", onDocPointerDown);
      window.removeEventListener("keydown", onDocKey);
    };
  });

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

  // ── Font loading ────────────────────────────────────────────────
  // Upstream Excalidraw uses a Fonts class instance tied to the
  // scene. It scans text elements, loads the woff2 files from the
  // registry, and re-renders once document.fonts.ready resolves.
  // Without this, picking Virgil / Nunito / etc. from the popover
  // changes element.fontFamily but the canvas keeps rendering in
  // the fallback (usually blank-looking because metrics differ).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fontsInstance: any = null;
  const reloadSceneFonts = async () => {
    if (!fontsInstance) return;
    try {
      await fontsInstance.loadSceneFonts();
      bumpSceneRepaint();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("sveltedraw: loadSceneFonts failed", err);
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

  // B1: minimal Frame creation. Upstream's `frame` element type is already
  // handled by staticScene renderer (draws outline + title bar). We create
  // a scene element of that type and auto-bind any existing elements whose
  // bbox falls inside the frame rect via element.frameId.
  const createFrameAtCenter = () => {
    if (!scene) return;
    const zoomV = (appState.zoom as any).value ?? 1;
    const scX = (appState.scrollX as any) ?? 0;
    const scY = (appState.scrollY as any) ?? 0;
    const vpCenterX = appState.width / 2;
    const vpCenterY = appState.height / 2;
    const sceneCX = vpCenterX / zoomV - scX;
    const sceneCY = vpCenterY / zoomV - scY;
    const W = 480;
    const H = 320;
    const frameX = sceneCX - W / 2;
    const frameY = sceneCY - H / 2;
    const frameId = `frame_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const frame: any = {
      id: frameId, type: "frame",
      x: frameX, y: frameY, width: W, height: H, angle: 0,
      strokeColor: "#bbb", backgroundColor: "transparent",
      fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid",
      roughness: 0, opacity: 100,
      seed: Math.floor(Math.random() * 2 ** 31),
      versionNonce: 1, version: 1, isDeleted: false,
      groupIds: [], frameId: null, boundElements: null,
      updated: Date.now(), link: null, locked: false, roundness: null,
      name: `Frame ${frames.size + 1}`,
    };
    const existing = scene.getNonDeletedElements();
    // Bind any existing element whose bbox is fully inside the frame.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextElements = existing.map((el: any) => {
      if (el.id === frameId) return el;
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const insideX = cx >= frameX && cx <= frameX + W;
      const insideY = cy >= frameY && cy <= frameY + H;
      if (insideX && insideY) return { ...el, frameId };
      return el;
    });
    // Frame renders FIRST so it sits behind its children — acting as a
    // container, not an overlay. Upstream also places the frame at the
    // bottom of its group. Array order == z-order.
    scene.replaceAllElements([frame, ...nextElements], { skipValidation: true });
    pushHistory();
    bumpSceneRepaint();
    return frameId;
  };

  // B3: URLs we accept as embeddable iframe sources. Matches upstream's
  // allowlist intent — only origins we trust won't serve hostile content.
  const EMBED_URL_PATTERNS = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=/i,
    /^https?:\/\/(www\.)?youtu\.be\//i,
    /^https?:\/\/(www\.)?vimeo\.com\/\d+/i,
    /^https?:\/\/(www\.)?codepen\.io\//i,
    /^https?:\/\/excalidraw\.com\//i,
    /^https?:\/\/plus\.excalidraw\.com\//i,
  ];

  const isEmbeddableUrl = (text: string): boolean =>
    EMBED_URL_PATTERNS.some((re) => re.test(text.trim()));

  const insertEmbed = (url: string, sceneX: number, sceneY: number) => {
    if (!scene) return;
    const id = `embed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el: any = {
      id, type: "iframe",
      x: sceneX, y: sceneY, width: 480, height: 270, angle: 0,
      strokeColor: "#1e1e1e", backgroundColor: "transparent",
      fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid",
      roughness: 0, opacity: 100,
      seed: Math.floor(Math.random() * 2 ** 31),
      versionNonce: 1, version: 1, isDeleted: false,
      groupIds: [], frameId: null, boundElements: null,
      updated: Date.now(), link: url, locked: false, roundness: null,
      customData: { embedUrl: url },
    };
    const existing = scene.getNonDeletedElements();
    scene.replaceAllElements([...existing, el], { skipValidation: true });
    pushHistory();
    bumpSceneRepaint();
  };

  const onContainerPaste = async (event: ClipboardEvent) => {
    // Ignore paste inside the text editor.
    if (textEditor) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    // B3: text URL paste → embed element (before image-item path)
    const text = event.clipboardData?.getData("text/plain")?.trim();
    if (text && isEmbeddableUrl(text)) {
      event.preventDefault();
      const sceneX = ((appState as any).scrollX ? -(appState as any).scrollX : 0) + 200;
      const sceneY = ((appState as any).scrollY ? -(appState as any).scrollY : 0) + 200;
      insertEmbed(text, sceneX, sceneY);
      return;
    }
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (blob) {
          event.preventDefault();
          // B4: an Excalidraw-exported PNG carries the scene JSON in a
          // private tEXt chunk. If we can decode it, restore the scene
          // instead of inserting the PNG as a flat image.
          if (blob.type === "image/png") {
            const restored = await tryRestoreSceneFromPng(blob);
            if (restored) return;
          }
          await insertImageFromBlob(blob);
          return;
        }
      }
    }
    // Not an image paste — let browser handle.
  };

  // B4: try to decode the Excalidraw scene metadata embedded in a PNG.
  // Returns true if the scene was restored; false if the PNG is a plain
  // image (caller falls through to insertImageFromBlob). No throws —
  // failure is a soft signal.
  const tryRestoreSceneFromPng = async (blob: Blob): Promise<boolean> => {
    try {
      const { decodePngMetadata } = await import("@excalidraw/excalidraw/data/image");
      const raw = await decodePngMetadata(blob);
      const data = JSON.parse(raw);
      const parsed = Array.isArray(data?.elements) ? data.elements : null;
      if (!parsed || parsed.length === 0) return false;
      if (!scene) return false;
      scene.replaceAllElements(parsed, { skipValidation: true });
      pushHistory();
      bumpSceneRepaint();
      return true;
    } catch {
      // Plain PNG (no tEXt chunk) or legacy / malformed metadata. Fall
      // through to the generic image-paste path.
      return false;
    }
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
      // If a fontFamily or fontSize changed, make sure the browser
      // has the woff2 for the new family+glyphs loaded and the
      // canvas re-rendered once fonts are ready. Without this, the
      // text element paints with a fallback until the page reloads.
      if (patch.fontFamily !== undefined || patch.fontSize !== undefined) {
        reloadSceneFonts();
      }
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
        fontWeight: "currentItemFontWeight",
        fontStyle: "currentItemFontStyle",
        textDecoration: "currentItemTextDecoration",
        textColor: "currentItemTextColor",
      };
      for (const [k, v] of Object.entries(patch)) {
        const targetKey = currentItemKeyMap[k] ?? k;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any)[targetKey] = v;
      }
      scheduleSave();
    }
  };

  // Stroke/fill color now rendered via <ColorPicker> (TopPicks + popover).
  // Width + opacity still use local preset buttons below.
  const STROKE_WIDTHS = [
    { name: "thin", value: STROKE_WIDTH.thin },
    { name: "bold", value: STROKE_WIDTH.bold },
    { name: "extrabold", value: STROKE_WIDTH.extraBold },
  ];
  const STROKE_STYLES = [
    { name: "solid", value: "solid" as const, icon: "StrokeStyleSolidIcon" },
    { name: "dashed", value: "dashed" as const, icon: "StrokeStyleDashedIcon" },
    { name: "dotted", value: "dotted" as const, icon: "StrokeStyleDottedIcon" },
  ];
  const FILL_STYLES = [
    { name: "hachure", value: "hachure" as const, icon: "FillHachureIcon" },
    { name: "cross-hatch", value: "cross-hatch" as const, icon: "FillCrossHatchIcon" },
    { name: "solid", value: "solid" as const, icon: "FillSolidIcon" },
  ];
  const ROUGHNESS_PRESETS = [
    { name: "architect", value: ROUGHNESS.architect, icon: "SloppinessArchitectIcon" },
    { name: "artist", value: ROUGHNESS.artist, icon: "SloppinessArtistIcon" },
    { name: "cartoonist", value: ROUGHNESS.cartoonist, icon: "SloppinessCartoonistIcon" },
  ];
  const OPACITY_PRESETS = [25, 50, 75, 100];
  // Font size quick-picks — matches upstream Excalidraw's 4 canonical
  // sizes. DEFAULT_FONT_SIZE = 20 (Medium).
  const FONT_SIZE_PRESETS = [
    { name: "Small", value: 16, icon: "FontSizeSmallIcon" },
    { name: "Medium", value: 20, icon: "FontSizeMediumIcon" },
    { name: "Large", value: 28, icon: "FontSizeLargeIcon" },
    { name: "Extra large", value: 36, icon: "FontSizeExtraLargeIcon" },
  ];
  // Arrowhead quick-picks — full upstream Arrowhead enum minus
  // cardinality_* (DB-notation icons, rarely used outside ERD
  // diagrams). 8 presets fit one panel row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ARROWHEAD_PRESETS = [
    { name: "none", value: null },
    { name: "arrow", value: "arrow" as const },
    { name: "triangle", value: "triangle" as const },
    { name: "triangle outline", value: "triangle_outline" as const },
    { name: "diamond", value: "diamond" as const },
    { name: "diamond outline", value: "diamond_outline" as const },
    { name: "circle", value: "circle" as const },
    { name: "circle outline", value: "circle_outline" as const },
    { name: "bar", value: "bar" as const },
  ];
  const TEXT_ALIGN_PRESETS = [
    { name: "left", value: "left" as const, icon: "TextAlignLeftIcon" },
    { name: "center", value: "center" as const, icon: "TextAlignCenterIcon" },
    { name: "right", value: "right" as const, icon: "TextAlignRightIcon" },
  ];
  const VERTICAL_ALIGN_PRESETS = [
    { name: "top", value: "top" as const },
    { name: "middle", value: "middle" as const },
    { name: "bottom", value: "bottom" as const },
  ];

  // Open-state for the two picker popovers (controlled). Only one open at
  // a time; opening the other auto-closes the first.
  let strokePickerOpen = $state(false);
  let bgPickerOpen = $state(false);

  // Reactive list the ColorPicker reads for "most used" custom-color
  // extraction — ideally the current selection if any, else the whole
  // scene. Re-computes on scene mutations (via `sceneReady` bumps).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pickerElements = $derived.by<readonly any[]>(() => {
    void sceneReady;
    if (!scene) return [];
    const selected = getSelectedElements();
    return selected.length > 0 ? selected : scene.getNonDeletedElements();
  });

  // What to display in the panel — reflects either the last-selected
  // element's style or the currentItem* defaults when no selection.
  const panelStyle = $derived.by(() => {
    // Re-run on scene mutations so toggles reflect the new element state.
    void sceneReady;
    const selected = getSelectedElements();
    if (selected.length > 0) {
      const el = selected[selected.length - 1];
      return {
        strokeColor: el.strokeColor,
        backgroundColor: el.backgroundColor,
        strokeWidth: el.strokeWidth,
        opacity: el.opacity,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        strokeStyle: (el as any).strokeStyle,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fillStyle: (el as any).fillStyle,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        roughness: (el as any).roughness,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        startArrowhead: (el as any).startArrowhead ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        endArrowhead: (el as any).endArrowhead ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        textAlign: (el as any).textAlign,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        verticalAlign: (el as any).verticalAlign,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fontSize: (el as any).fontSize,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        roundness: (el as any).roundness,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fontWeight: (el as any).fontWeight ?? "normal",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fontStyle: (el as any).fontStyle ?? "normal",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        textDecoration: (el as any).textDecoration ?? "none",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        textColor: (el as any).textColor ?? null,
        // A9: line-height + rotation moved here from TextEditorPanel. angle
        // is already on every element; lineHeight is text-only.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lineHeight: (el as any).lineHeight ?? 1.25,
        angle: el.angle ?? 0,
        // C1: drop shadow config — null when no shadow.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shadow: (el as any).shadow ?? null,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      strokeStyle: (appState as any).currentItemStrokeStyle,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fillStyle: (appState as any).currentItemFillStyle,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      roughness: (appState as any).currentItemRoughness,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      startArrowhead: (appState as any).currentItemStartArrowhead ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      endArrowhead: (appState as any).currentItemEndArrowhead ?? "arrow",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      textAlign: (appState as any).currentItemTextAlign,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      verticalAlign: (appState as any).currentItemVerticalAlign,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fontSize: (appState as any).currentItemFontSize ?? DEFAULT_FONT_SIZE,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fontWeight: (appState as any).currentItemFontWeight ?? "normal",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fontStyle: (appState as any).currentItemFontStyle ?? "normal",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      textDecoration: (appState as any).currentItemTextDecoration ?? "none",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      textColor: (appState as any).currentItemTextColor ?? null,
    };
  });

  // Linear-only: show arrowhead rows only when at least one selected
  // element is a line or arrow. Reads selectedElementIds directly so
  // Svelte 5's proxy reactivity tracks the change; reads `sceneReady`
  // so scene mutations (e.g. element deletion) also invalidate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasLinearSelected = $derived.by<boolean>(() => {
    void sceneReady;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = (appState as any).selectedElementIds ?? {};
    if (!scene) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (ids[el.id] && (el.type === "line" || el.type === "arrow")) {
        return true;
      }
    }
    return false;
  });

  // Every selected line/arrow, used for rendering the handle overlay.
  // $derived tracks selectedElementIds + sceneReady; inline
  // filter in the template (`selectedElementIds?.[el.id]`) doesn't
  // track reliably in Svelte 5 — have to read the proxy field
  // directly inside a $derived.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedLinearElements = $derived.by<any[]>(() => {
    void sceneReady;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = (appState as any).selectedElementIds ?? {};
    if (!scene) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (scene.getNonDeletedElements() as any[]).filter(
      (el) => ids[el.id] && (el.type === "line" || el.type === "arrow"),
    );
  });

  // Text-only: shows text-alignment rows. Same inline-proxy-access
  // pattern as `hasLinearSelected` — Svelte 5 tracking is finicky
  // across function boundaries (see feedback memory).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasTextSelected = $derived.by<boolean>(() => {
    void sceneReady;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = (appState as any).selectedElementIds ?? {};
    if (!scene) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (ids[el.id] && el.type === "text") return true;
    }
    return false;
  });

  // True iff selection is ENTIRELY text elements — used to hide rows
  // that don't apply to text (Background fill, Stroke width, etc.).
  const allSelectedAreText = $derived.by<boolean>(() => {
    void sceneReady;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = (appState as any).selectedElementIds ?? {};
    const keys = Object.keys(ids);
    if (keys.length === 0) return false;
    if (!scene) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (ids[el.id] && el.type !== "text") return false;
    }
    return true;
  });

  // Rectangles/diamonds support roundness (ADAPTIVE_RADIUS = type 3),
  // linear supports roundness (PROPORTIONAL_RADIUS = type 2). Ellipse
  // is already "round" so exclude it. Show the Edges toggle when any
  // selected element can accept a roundness change.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasRoundableSelected = $derived.by<boolean>(() => {
    void sceneReady;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = (appState as any).selectedElementIds ?? {};
    if (!scene) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (!ids[el.id]) continue;
      if (el.type === "line" || el.type === "arrow" ||
          el.type === "rectangle" || el.type === "diamond") {
        return true;
      }
    }
    return false;
  });

  // Roundness type per element type (upstream ROUNDNESS constants):
  //   linear  → 2 (PROPORTIONAL_RADIUS)
  //   rect/diamond → 3 (ADAPTIVE_RADIUS)
  const roundnessTypeFor = (el: { type: string }) =>
    el.type === "line" || el.type === "arrow" ? 2 : 3;

  const applyRoundnessToSelection = (round: boolean) => {
    const selected = getSelectedElements();
    if (selected.length === 0 || !scene) {
      // No selection → update currentItemRoundness default.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).currentItemRoundness = round ? { type: 3 } : null;
      scheduleSave();
      return;
    }
    for (const el of selected) {
      if (el.type !== "line" && el.type !== "arrow" &&
          el.type !== "rectangle" && el.type !== "diamond") {
        continue;
      }
      const patch = round ? { roundness: { type: roundnessTypeFor(el) } } : { roundness: null };
      scene.mutateElement(el, patch, { informMutation: false, isDragging: false });
    }
    pushHistory();
    bumpSceneRepaint();
  };

  // True iff selection is ENTIRELY linear — hide Fill / Fill style /
  // Background for those. Linear has stroke + arrowheads only.
  const allSelectedAreLinear = $derived.by<boolean>(() => {
    void sceneReady;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = (appState as any).selectedElementIds ?? {};
    const keys = Object.keys(ids);
    if (keys.length === 0) return false;
    if (!scene) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (ids[el.id] && el.type !== "line" && el.type !== "arrow") return false;
    }
    return true;
  });

  // Toggle lock on every selected element. Locked elements can't be
  // clicked / dragged / resized; they're essentially inert until
  // unlocked. Matches upstream's element.locked boolean field.
  // C2: mirror selected elements. For a single selection, mirror around
  // the element's own bbox (symmetric shapes are no-ops visually). For
  // multi-select, mirror around the COMBINED bounding box of the
  // selection — each element's points + position get reflected so the
  // group as a whole flips rigidly, matching upstream Excalidraw UX.
  const flipSelected = (axis: "horizontal" | "vertical") => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    const flippables = (selected as any[]).filter((el) => !el.locked);
    if (flippables.length === 0) return;
    // Selection bbox (axis-aligned): the reflection axis that keeps the
    // group centered. For single-selection this collapses to the element's
    // own bbox, so behavior stays identical for the common case.
    let selMinX = Infinity, selMinY = Infinity;
    let selMaxX = -Infinity, selMaxY = -Infinity;
    for (const el of flippables) {
      selMinX = Math.min(selMinX, el.x);
      selMinY = Math.min(selMinY, el.y);
      selMaxX = Math.max(selMaxX, el.x + el.width);
      selMaxY = Math.max(selMaxY, el.y + el.height);
    }
    const groupCenterX = (selMinX + selMaxX) / 2;
    const groupCenterY = (selMinY + selMaxY) / 2;
    let mutated = 0;
    for (const el of flippables) {
      const w = el.width;
      const h = el.height;
      // Reflect element position around the group axis. New top-left =
      // (group axis) * 2 - (old right) for horizontal, similarly for
      // vertical. This ensures the element ends up in the mirrored slot
      // of the group bbox.
      const newX = axis === "horizontal" ? 2 * groupCenterX - (el.x + w) : el.x;
      const newY = axis === "vertical" ? 2 * groupCenterY - (el.y + h) : el.y;
      const positionPatch =
        newX !== el.x || newY !== el.y ? { x: newX, y: newY } : null;
      if (el.type === "line" || el.type === "arrow" || el.type === "freedraw") {
        const pts = (el.points ?? []) as number[][];
        const next = pts.map(([px, py]) => [
          axis === "horizontal" ? w - px : px,
          axis === "vertical" ? h - py : py,
        ]);
        // Line/arrow: swap endpoint metadata so "the other end" is still
        // the other end. Without this, the next updateBoundElements call
        // would re-route points back toward the original endpoints and
        // visibly undo the flip.
        const patch: any = { points: next, ...(positionPatch ?? {}) };
        if (el.type === "arrow" || el.type === "line") {
          if (el.startBinding || el.endBinding) {
            patch.startBinding = el.endBinding ?? null;
            patch.endBinding = el.startBinding ?? null;
          }
          if (el.startArrowhead !== undefined || el.endArrowhead !== undefined) {
            patch.startArrowhead = el.endArrowhead ?? null;
            patch.endArrowhead = el.startArrowhead ?? null;
          }
        }
        scene.mutateElement(el, patch, { informMutation: false, isDragging: false });
        mutated++;
      } else if (el.type === "image") {
        const cur = (el.scale ?? [1, 1]) as number[];
        const next: [number, number] = [
          axis === "horizontal" ? -cur[0] : cur[0],
          axis === "vertical" ? -cur[1] : cur[1],
        ];
        scene.mutateElement(
          el,
          { scale: next, ...(positionPatch ?? {}) },
          { informMutation: false, isDragging: false },
        );
        mutated++;
      } else if (positionPatch) {
        // Symmetric bbox shapes (rectangle/diamond/ellipse/text): the
        // shape itself is mirror-identical, but in a multi-select it
        // still needs to swap SLOTS in the group bbox so the group
        // flips as a whole. Skip entirely for single-select where
        // positionPatch is null.
        scene.mutateElement(el, positionPatch,
          { informMutation: false, isDragging: false });
        mutated++;
      }
    }
    if (mutated > 0) {
      pushHistory();
      bumpSceneRepaint();
    }
  };

  const toggleLockSelected = () => {
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    // If any are locked → unlock all. Else lock all.
    const anyLocked = selected.some((el) => el.locked);
    const nextLocked = !anyLocked;
    for (const el of selected) {
      scene.mutateElement(
        el,
        { locked: nextLocked },
        { informMutation: false, isDragging: false },
      );
    }
    pushHistory();
    bumpSceneRepaint();
  };

  // ── Font picker state ────────────────────────────────────────────
  // The picker shows a 3-way quick-pick (Hand-drawn / Normal / Code) at
  // the top and a full searchable list in a popover. All selection writes
  // go through `applyStyle({ fontFamily })` so they flow through the
  // existing "apply-to-selection-or-currentItem*" path.
  let fontPickerOpen = $state(false);
  let fontPickerHover = $state<number | null>(null);

  // Font family currently shown in the picker — last selected text
  // element's fontFamily OR currentItemFontFamily.
  const panelFontFamily = $derived.by<number>(() => {
    const selected = getSelectedElements();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textEls = selected.filter((el: any) => el.type === "text");
    if (textEls.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (textEls[textEls.length - 1] as any).fontFamily ?? DEFAULT_FONT_FAMILY;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (appState as any).currentItemFontFamily ?? DEFAULT_FONT_FAMILY;
  });

  // Build FontDescriptor arrays. Text labels are font family names (the
  // list items render them in their own font). Icons are attached in
  // the template (Svelte Snippets are template constructs).
  const fontFamilyLabels: Record<number, string> = {
    [FONT_FAMILY.Virgil]: "Virgil",
    [FONT_FAMILY.Helvetica]: "Helvetica",
    [FONT_FAMILY.Cascadia]: "Cascadia",
    [FONT_FAMILY.Excalifont]: "Excalifont",
    [FONT_FAMILY.Nunito]: "Nunito",
    [FONT_FAMILY["Lilita One"]]: "Lilita One",
    [FONT_FAMILY["Comic Shanns"]]: "Comic Shanns",
    [FONT_FAMILY["Liberation Sans"]]: "Liberation Sans",
    [FONT_FAMILY.Assistant]: "Assistant",
  };
  const defaultFontValues = [
    FONT_FAMILY.Excalifont,
    FONT_FAMILY.Helvetica,
    FONT_FAMILY.Cascadia,
  ];

  // Scene fonts = {font-family values used by ≥1 text element} minus the
  // 3 default quick-picks. Available fonts = everything else.
  const sceneFontFamilies = $derived.by<Set<number>>(() => {
    void sceneReady;
    const out = new Set<number>();
    if (!scene) return out;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (el.type === "text" && typeof el.fontFamily === "number") {
        out.add(el.fontFamily);
      }
    }
    return out;
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
  // Set inside pointerdown when Alt-drag creates duplicates. Read in
  // pointerup to force pushHistory even when cursor didn't move —
  // otherwise the created duplicates leak out of the undo stack.
  let altDragHadDuplicate = false;
  let panStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  let spaceHeld = false;

  // ── Touch / pinch gesture state ─────────────────────────────────
  // Tracks every active finger by pointerId. When ≥2 touches are
  // simultaneous, we engage pinch-mode: zoom on distance ratio and
  // pan on midpoint delta. Single-touch routes normally through the
  // selection / tool pipeline.
  const activeTouches = new Map<number, { x: number; y: number }>();
  let pinchGesture: {
    startDist: number;
    startZoom: number;
    startMidX: number;
    startMidY: number;
    startScrollX: number;
    startScrollY: number;
  } | null = null;

  const isPinchActive = () => pinchGesture !== null;

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
      // Group / ungroup: Ctrl+G adds a shared groupId to all selected
      // elements; Ctrl+Shift+G pops the outermost group from each.
      // Matches upstream keybindings.
      if (event.key === "g" || event.key === "G") {
        if (event.shiftKey) ungroupSelected();
        else groupSelected();
        event.preventDefault();
        return;
      }

      // B1: New frame: Ctrl+Shift+F. Creates a frame at viewport center
      // and auto-binds every element whose bbox center falls inside.
      if (event.shiftKey && (event.key === "f" || event.key === "F")) {
        createFrameAtCenter();
        event.preventDefault();
        return;
      }

      // Phase 12: Template selector: Ctrl+N (new with template)
      if (!event.shiftKey && (event.key === "n" || event.key === "N")) {
        showTemplateSelector = true;
        event.preventDefault();
        return;
      }

      // Phase 12: Recent files: Ctrl+R
      if (!event.shiftKey && (event.key === "r" || event.key === "R")) {
        showRecentFiles = true;
        event.preventDefault();
        return;
      }

      // Phase 12: Settings: Ctrl+,
      if (!event.shiftKey && event.key === ",") {
        showSettings = true;
        event.preventDefault();
        return;
      }

      // Phase 13: Connector tool: Ctrl+Shift+C
      if (event.shiftKey && (event.key === "c" || event.key === "C")) {
        connectorToolActive = !connectorToolActive;
        selectedForConnection = null;
        event.preventDefault();
        return;
      }

      // Phase 13: Measurement panel: Ctrl+M
      if (!event.shiftKey && (event.key === "m" || event.key === "M")) {
        toggleSidePanel("measurement");
        event.preventDefault();
        return;
      }

      // Phase 13: Auto-Layout panel: Ctrl+L
      if (!event.shiftKey && (event.key === "l" || event.key === "L")) {
        toggleSidePanel("autolayout");
        event.preventDefault();
        return;
      }

      // A1: Edit-link dialog: Ctrl+K (upstream keybinding). Only opens when
      // exactly one element is selected.
      if (!event.shiftKey && (event.key === "k" || event.key === "K")) {
        openLinkDialog();
        event.preventDefault();
        return;
      }

      // Z-order: Ctrl+] / Ctrl+[ (one step), Ctrl+Shift+] / Ctrl+Shift+[
      // (to front / to back). Matches upstream keybindings.
      if (event.key === "]") {
        reorderSelected(event.shiftKey ? "front" : "forward");
        event.preventDefault();
        return;
      }
      if (event.key === "[") {
        reorderSelected(event.shiftKey ? "back" : "backward");
        event.preventDefault();
        return;
      }

      // Lock / unlock selected: Ctrl+Shift+L.
      if (event.shiftKey && (event.key === "l" || event.key === "L")) {
        toggleLockSelected();
        event.preventDefault();
        return;
      }

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

    // ── Ctrl+Alt: Alignment & Distribution shortcuts ─────────────────
    if ((event.ctrlKey || event.metaKey) && event.altKey) {
      const key = event.key.toLowerCase();

      // Alignment shortcuts
      if (key === "l") {
        handleAlign("left");
        event.preventDefault();
        return;
      }
      if (key === "c") {
        handleAlign("centerH");
        event.preventDefault();
        return;
      }
      if (key === "r") {
        handleAlign("right");
        event.preventDefault();
        return;
      }
      if (key === "t") {
        handleAlign("top");
        event.preventDefault();
        return;
      }
      if (key === "m") {
        handleAlign("centerV");
        event.preventDefault();
        return;
      }
      if (key === "b") {
        handleAlign("bottom");
        event.preventDefault();
        return;
      }
    }

    // ── Ctrl+Shift: Distribution shortcuts ───────────────────────────
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey) {
      const key = event.key.toLowerCase();

      if (key === "h") {
        handleDistribute("distributeEvenlyH");
        event.preventDefault();
        return;
      }
      if (key === "v") {
        handleDistribute("distributeEvenlyV");
        event.preventDefault();
        return;
      }
    }

    // A2: L key toggles laser when no modifier and no text input focused.
    // Active in presentation and normal editing alike. Avoids conflict with
    // Ctrl+L (autolayout panel) by requiring no ctrl/meta.
    if (
      (event.key === "l" || event.key === "L") &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
      const t = event.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag !== "input" && tag !== "textarea" && !t?.isContentEditable) {
        toggleLaser();
        event.preventDefault();
        return;
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

    // Enter (no modifiers) → commit in-progress polyline if any.
    if (event.key === "Enter" && polylineActive && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      commitPolyline();
      setActiveTool("selection");
      event.preventDefault();
      return;
    }

    // Escape → clear in-progress element + selection + back to selection tool.
    if (event.key === "Escape") {
      // A2: Esc also turns off laser if active.
      if (laserActive) {
        laserActive = false;
        laserTrail = [];
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).newElement = null;
      polylineActive = false;
      clearSelection();
      setActiveTool("selection");
      bumpSceneRepaint();
      return;
    }

    // Tool lock toggle (Q). When on, the active drawing tool stays
    // active after each draw instead of auto-switching to selection.
    if (event.key === "q" || event.key === "Q") {
      toggleToolLock();
      event.preventDefault();
      return;
    }

    // Show help dialog on `?`.
    if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
      helpDialogOpen = true;
      event.preventDefault();
      return;
    }

    // Show comprehensive help on F1.
    if (event.key === "F1") {
      showHelpPanel = true;
      event.preventDefault();
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
    | { kind: "endpoint"; el: any; pointIndex: number }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { kind: "midpoint"; el: any; afterIndex: number; sceneX: number; sceneY: number };

  const hitResizeHandle = (sceneX: number, sceneY: number): HandleHit | null => {
    if (!scene) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectedIds = (appState as any).selectedElementIds ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomV = (appState.zoom as any).value || 1;
    const tol = 8 / zoomV;
    const rotTol = 10 / zoomV; // rotation handle is slightly more forgiving

    // ── Linear endpoint + midpoint editor (line / arrow only) ─────
    // First pass — test every points[i] against the cursor. These
    // are the "anchored" handles at actual vertices.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (!selectedIds[el.id]) continue;
      if (el.locked) continue;
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
    // Second pass — midpoints between consecutive vertices. These
    // are the "bend" handles: dragging creates a new intermediate
    // point at that position. Tolerance matches vertices; the
    // earlier 6px was too stingy on short segments so users kept
    // missing.
    const midTol = 10 / zoomV;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (!selectedIds[el.id]) continue;
      if (el.locked) continue;
      if (el.type !== "line" && el.type !== "arrow") continue;
      const pts = el.points ?? [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const mx = el.x + (ax + bx) / 2;
        const my = el.y + (ay + by) / 2;
        if (Math.abs(sceneX - mx) <= midTol && Math.abs(sceneY - my) <= midTol) {
          return {
            kind: "midpoint",
            el,
            afterIndex: i,
            sceneX: mx,
            sceneY: my,
          };
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of scene.getNonDeletedElements() as any[]) {
      if (!selectedIds[el.id]) continue;
      // A8: locked elements show a selection outline but expose no
      // rotation/resize/endpoint handles. Exits the loop early so the
      // user can't grab a handle that shouldn't be there.
      if (el.locked) continue;

      // Rotation handle works on EVERY element type (including linear
      // and freedraw). Resize handles are only meaningful for bbox
      // shapes; for linear we have the endpoint editor + midpoint bend
      // handles instead.
      const rot = getRotationHandlePos(el);
      if (
        Math.abs(sceneX - rot.x) <= rotTol &&
        Math.abs(sceneY - rot.y) <= rotTol
      ) {
        return { kind: "rotate", el };
      }

      if (el.type === "line" || el.type === "arrow" || el.type === "freedraw") {
        continue;
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
    const zoomV = (appState.zoom as any).value;
    const baseThreshold = DEFAULT_COLLISION_THRESHOLD / zoomV;
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      // A8: locked elements ARE hit-testable — clicking one selects it
      // (so the user sees the padlock outline). The drag/resize guards
      // live in onInteractivePointerDown and hitResizeHandle.
      // Linear elements (line, arrow) have no fill so selection
      // relies entirely on distance-to-outline. The default 8px
      // threshold is stingy on thin strokes at normal zoom — bump
      // to 15px for lines/arrows so users don't have to pixel-hunt.
      const threshold =
        el.type === "line" || el.type === "arrow"
          ? Math.max(baseThreshold, 15 / zoomV)
          : baseThreshold;
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
    const cur = (appState as any).selectedElementIds ?? {};
    // Only update if there are actually selected elements to clear
    if (Object.keys(cur).length > 0) {
      (appState as any).selectedElementIds = {};
    }
  };

  const selectOnly = (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = (appState as any).selectedElementIds ?? {};
    // Only update if selection actually changed
    if (Object.keys(cur).length !== 1 || !cur[id]) {
      (appState as any).selectedElementIds = { [id]: true };
    }
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
    // Visual props copied from the element being edited (null → defaults
    // for new-text entry). Lets the textarea overlay match the canvas
    // rendering so there's no visual jump between edit and committed
    // text.
    fontSize: number;
    fontFamily: number;
    strokeColor: string;
    angle: number;
    width: number | null;
    height: number | null;
  } | null = $state(null);
  let textEditorEl: HTMLTextAreaElement | null = $state(null);

  const commitTextEditor = () => {
    if (!textEditor || !scene) return;
    const { sceneX, sceneY, editingElementId } = textEditor;
    const text = (textEditorEl?.value ?? "").replace(/\s+$/, "");
    // Close the editor first so blur handler doesn't re-enter.
    textEditor = null;
    // Clear editing-text flag so canvas resumes rendering the element.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).editingTextElement = null;

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    element?: any;
  } = {}) => {
    const el = opts.element;
    textEditor = {
      sceneX,
      sceneY,
      initialValue: opts.initialValue ?? "",
      editingElementId: opts.editingElementId ?? null,
      fontSize: el?.fontSize ?? DEFAULT_FONT_SIZE,
      fontFamily: el?.fontFamily ?? DEFAULT_FONT_FAMILY,
      strokeColor:
        el?.strokeColor ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((appState as any).currentItemStrokeColor || "#000"),
      angle: el?.angle || 0,
      width: el?.width ?? null,
      height: el?.height ?? null,
    };
    // Hide the canvas-rendered element while editing so it doesn't
    // ghost under the textarea overlay. Upstream's Renderer skips any
    // element whose id matches appState.editingTextElement.id.
    if (el) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).editingTextElement = el;
      bumpSceneRepaint();
    }
    // Focus after Svelte commits the DOM — tick via rAF.
    requestAnimationFrame(() => {
      const ta = textEditorEl;
      if (!ta) return;
      ta.focus();
      ta.select();
      // Auto-grow to fit initialValue so the first paint doesn't show a
      // tiny box clipping multi-line existing text.
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
      ta.style.width = "auto";
      ta.style.width = ta.scrollWidth + "px";
    });
  };

  // ── Multi-point line/arrow (polyline) state ─────────────────────
  // Upstream UX:
  //   - Click-drag-release on the line/arrow tool → 2-point line, commits
  //     immediately (existing behavior).
  //   - Click-release without drag → enters polyline mode. Each subsequent
  //     click anchors a new vertex; the last point floats under the
  //     cursor until anchored. Enter / dblclick commits; Escape cancels.
  let polylineActive = $state(false);

  // Drop trailing floating points that duplicate the previous vertex
  // (within 0.5 scene px). Happens after dblclick or an accidental
  // back-to-back click in polyline mode.
  const trimPolylineTail = (
    points: readonly (readonly number[])[],
  ): readonly (readonly number[])[] => {
    let out = points;
    while (out.length >= 2) {
      const [ax, ay] = out[out.length - 1];
      const [bx, by] = out[out.length - 2];
      if (Math.hypot(ax - bx, ay - by) < 0.5) out = out.slice(0, -1);
      else break;
    }
    return out;
  };

  // Commit the in-progress polyline newElement. The last point in
  // `points` is the UNANCHORED floating preview (tracking the cursor);
  // we drop it here since only user-clicked vertices are intended to
  // persist. Any remaining duplicate tail (from dblclick's second
  // press) is trimmed too. No-op if newElement isn't a line/arrow.
  const commitPolyline = () => {
    if (!scene) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = (appState as any).newElement;
    if (!cur || (cur.type !== "line" && cur.type !== "arrow")) return;
    let points = cur.points ?? [];
    if (points.length >= 1) points = points.slice(0, -1);
    points = trimPolylineTail(points);
    if (points.length >= 2) {
      let minX = 0, minY = 0, maxX = 0, maxY = 0;
      for (const [px, py] of points) {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
      const committed = {
        ...cur,
        points,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        version: (cur.version ?? 1) + 1,
      };
      const existing = scene.getElementsIncludingDeleted();
      scene.replaceAllElements([...existing, committed], { skipValidation: true });
      pushHistory();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).newElement = null;
    polylineActive = false;
    dragStart = null;
    bumpSceneRepaint();
  };

  // ── Context menu (right-click) ────────────────────────────────────
  // Opens at the cursor's viewport coords. Selection under the cursor
  // (if any, and not already selected) replaces the selection first.
  // Items are a static array; only the actions that make sense for the
  // current state are rendered.
  let contextMenu: {
    vpX: number;
    vpY: number;
    hasSelection: boolean;
  } | null = $state(null);

  const closeContextMenu = () => {
    contextMenu = null;
  };

  // Close on outside-click or Escape while open. The menu's root div
  // stops pointerdown-propagation so clicks inside don't trigger this.
  $effect(() => {
    if (!contextMenu) return;
    const onDocPointerDown = () => closeContextMenu();
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    window.addEventListener("pointerdown", onDocPointerDown);
    window.addEventListener("keydown", onDocKey);
    return () => {
      window.removeEventListener("pointerdown", onDocPointerDown);
      window.removeEventListener("keydown", onDocKey);
    };
  });

  // In-memory scene-copy buffer for context-menu Copy/Cut/Paste. Browser
  // clipboard APIs require user-gesture + permissions for text; for a
  // PoC PoC we keep it local to the editor instance. Deep-cloned so
  // subsequent scene mutations don't affect the copy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clipboardBuffer: any[] = $state([]);

  const copySelectedToBuffer = () => {
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clipboardBuffer = selected.map((el: any) => deepCopyElement(el));
  };

  const pasteFromBuffer = (sceneX?: number, sceneY?: number) => {
    if (!scene || clipboardBuffer.length === 0) return;
    // Compute bbox of copied elements to translate them to the target.
    let minX = Infinity, minY = Infinity;
    for (const el of clipboardBuffer) {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomV = (appState.zoom as any).value || 1;
    const tx =
      (sceneX ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        appState.width / 2 / zoomV - ((appState as any).scrollX ?? 0)) - minX;
    const ty =
      (sceneY ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        appState.height / 2 / zoomV - ((appState as any).scrollY ?? 0)) - minY;
    // Duplicate through upstream helper so ids / group-ids rewire
    // correctly. `in-place` mode + override(x,y) translates each one.
    const existing = scene.getElementsIncludingDeleted();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idsMap = new Map<string, any>(clipboardBuffer.map((el) => [el.id, el]));
    const { elementsWithDuplicates, origIdToDuplicateId } = duplicateElements({
      type: "in-place",
      elements: [...existing, ...clipboardBuffer],
      idsOfElementsToDuplicate: idsMap,
      appState: { editingGroupId: null, selectedGroupIds: {} },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dupIds = new Set<string>(origIdToDuplicateId.values() as any);
    // Translate the duplicates to the paste location; also filter out
    // the temporary clipboard-buffer copies we inserted for dedup.
    const clipIds = new Set(clipboardBuffer.map((el) => el.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = elementsWithDuplicates
      .filter((el: any) => !clipIds.has(el.id))
      .map((el: any) =>
        dupIds.has(el.id) ? { ...el, x: el.x + tx, y: el.y + ty } : el,
      );
    scene.replaceAllElements(next, { skipValidation: true });
    const nextSel: Record<string, true> = {};
    for (const id of dupIds) nextSel[id] = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).selectedElementIds = nextSel;
    pushHistory();
    bumpSceneRepaint();
  };

  const onContainerContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    if (!scene) return;
    const { x: sx, y: sy } = toSceneCoords(event.clientX, event.clientY);
    const hit = hitTestAt(sx, sy);
    if (hit) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sel = (appState as any).selectedElementIds ?? {};
      if (!sel[(hit as any).id]) selectOnly((hit as any).id);
    } else {
      clearSelection();
    }
    // Position the menu inside the container (relative to its
    // viewport-offset origin), not the window.
    contextMenu = {
      vpX: event.clientX - (appState.offsetLeft as number),
      vpY: event.clientY - (appState.offsetTop as number),
      hasSelection: Object.keys(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).selectedElementIds ?? {},
      ).length > 0,
    };
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
    // ── Touch tracking (for pinch-zoom + two-finger pan) ─────────────
    // Record every active touch. When a second finger lands, engage
    // pinch-mode and drop any in-flight single-touch gesture so we
    // don't accidentally draw a 2-point line while pinching.
    if (event.pointerType === "touch") {
      activeTouches.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (activeTouches.size === 2) {
        const [a, b] = Array.from(activeTouches.values());
        pinchGesture = {
          startDist: Math.hypot(a.x - b.x, a.y - b.y),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          startZoom: (appState.zoom as any).value,
          startMidX: (a.x + b.x) / 2,
          startMidY: (a.y + b.y) / 2,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          startScrollX: (appState as any).scrollX,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          startScrollY: (appState as any).scrollY,
        };
        // Cancel any in-flight single-touch gesture.
        dragStart = null;
        dragOrigins = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).newElement = null;
        resizeGesture = null;
        rotateGesture = null;
        event.preventDefault();
        return;
      }
      // First finger: fall through to the normal pointerdown handler.
    }

    // ── Connector tool: pick two shapes, link them with a bound arrow ──
    if (connectorToolActive) {
      const { x: cx, y: cy } = toSceneCoords(event.clientX, event.clientY);
      const hit = hitTestAt(cx, cy);
      if (!hit) {
        // Click on empty space exits the tool without linking.
        connectorToolActive = false;
        selectedForConnection = null;
        event.preventDefault();
        return;
      }
      if (!selectedForConnection) {
        selectedForConnection = hit.id;
        // Highlight the first pick so the user sees what they selected.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).selectedElementIds = { [hit.id]: true };
        event.preventDefault();
        return;
      }
      if (selectedForConnection === hit.id) {
        // Same shape clicked twice — ignore (can't self-connect).
        event.preventDefault();
        return;
      }
      createConnectorArrow(selectedForConnection, hit.id);
      selectedForConnection = null;
      connectorToolActive = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).selectedElementIds = {};
      event.preventDefault();
      return;
    }

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
        } else if (handleHit.kind === "midpoint") {
          // Insert a new point at the midpoint position, then drag it
          // just like an endpoint. The user feels like they "bent"
          // the line at that spot.
          const el = handleHit.el;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const origPoints = (el.points as number[][]).map((p) => [p[0], p[1]]);
          const newPointIndex = handleHit.afterIndex + 1;
          const localX = handleHit.sceneX - el.x;
          const localY = handleHit.sceneY - el.y;
          const nextPoints = [
            ...origPoints.slice(0, newPointIndex),
            [localX, localY],
            ...origPoints.slice(newPointIndex),
          ];
          scene.mutateElement(
            el,
            { points: nextPoints },
            { informMutation: false, isDragging: true },
          );
          endpointGesture = {
            el,
            pointIndex: newPointIndex,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            origPoints: nextPoints.map((p: any) => [p[0], p[1]]),
            origX: el.x,
            origY: el.y,
          };
          bumpSceneRepaint();
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
        // Clicking unselected element replaces selection. If the hit
        // element belongs to a group, expand the selection to include
        // every member of the outermost group — matches upstream UX.
        // Alt-click bypasses expansion so Alt-drag can target a single
        // group member for duplication/move.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hitGroupIds = ((hit as any).groupIds as string[]) ?? [];
        if (hitGroupIds.length > 0 && !event.altKey) {
          const ids = expandSelectionToGroup(hit);
          const nextSel: Record<string, true> = {};
          for (const id of ids) nextSel[id] = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (appState as any).selectedElementIds = nextSel;
        } else {
          selectOnly(hit.id);
        }
      }

      // Alt-held at drag-start → duplicate the selection first, then
      // drag the DUPLICATES. Matches Excalidraw upstream UX. The
      // originals stay pinned at their original position; the new
      // copies follow the cursor. `altDragHadDuplicate` flag ensures
      // pointerup pushes history even when the user didn't actually
      // move (otherwise the duplicate leaks — created in scene but
      // unreachable from undo stack).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (event.altKey) {
        const selectedNow = getSelectedElements();
        if (selectedNow.length > 0) {
          const elements = scene.getElementsIncludingDeleted();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const idsMap = new Map<string, any>(selectedNow.map((el) => [el.id, el]));
          const { elementsWithDuplicates, origIdToDuplicateId } = duplicateElements({
            type: "in-place",
            elements,
            idsOfElementsToDuplicate: idsMap,
            appState: { editingGroupId: null, selectedGroupIds: {} },
          });
          scene.replaceAllElements(elementsWithDuplicates, { skipValidation: true });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dupIds = new Set<string>(origIdToDuplicateId.values() as any);
          const nextSel: Record<string, true> = {};
          for (const id of dupIds) nextSel[id] = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (appState as any).selectedElementIds = nextSel;
          altDragHadDuplicate = true;
          bumpSceneRepaint();
        }
      }

      // A1: Ctrl/Cmd-click on a linked element opens the URL in a new tab.
      // Fire before the lock guard so linked-and-locked still navigates.
      const hitLink = (hit as any).link as string | null | undefined;
      if ((event.ctrlKey || event.metaKey) && hitLink) {
        window.open(hitLink, "_blank", "noopener,noreferrer");
        event.preventDefault();
        return;
      }

      // A8: clicking directly on a locked element selects it (for the
      // padlock outline) but MUST NOT initiate a drag. Skip dragOrigins
      // entirely in that case so pointermove's drag branch stays dormant.
      if ((hit as any).locked) {
        dragOrigins = [];
        dragStart = null;
        tryCapture(event.currentTarget as HTMLElement | null, event.pointerId);
        event.preventDefault();
        return;
      }

      // Snapshot every currently-selected element's origin for the drag.
      // Locked elements are excluded — even when multi-selected (Ctrl+A),
      // they must stay pinned while the rest of the group drags.
      // B1: when a frame is in the selection, its children (elements with
      // frameId === frame.id) are pulled into dragOrigins so the frame
      // moves as a container — upstream group-drag UX.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectedIds = new Set(Object.keys((appState as any).selectedElementIds));
      const map = scene.getNonDeletedElementsMap();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectedFrameIds = new Set<string>();
      for (const id of selectedIds) {
        const el = map.get(id);
        if (el && (el as any).type === "frame") selectedFrameIds.add(id);
      }
      if (selectedFrameIds.size > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const el of scene.getNonDeletedElements() as any[]) {
          if (selectedFrameIds.has(el.frameId)) selectedIds.add(el.id);
        }
      }
      dragOrigins = Array.from(selectedIds)
        .map((id: string) => {
          const el = map.get(id);
          if (!el || (el as any).locked) return null;
          return { id, x: el.x, y: el.y, el };
        })
        .filter(Boolean) as typeof dragOrigins;
      dragStart = { x, y };
      // History recorded on pointerup IF element positions actually changed
      // (see finalize branch). Recording on pointerdown would store the
      // pre-drag state; we want the post-drag state per the invariant.
      tryCapture(event.currentTarget as HTMLElement | null, event.pointerId);
      return;
    }

    // ── Eraser tool: tap or drag to delete elements under the cursor.
    //    Soft-deletes via isDeleted=true so undo restores them. Records
    //    the starting set for the drag in eraserDragSet.
    if (tool === "eraser") {
      eraserDragActive = true;
      eraserDraggedIds.clear();
      eraseAt(x, y);
      dragStart = { x, y };
      dragOrigins = [];
      tryCapture(event.currentTarget as HTMLElement | null, event.pointerId);
      event.preventDefault();
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

      // ── Polyline: subsequent click anchors a new vertex ───────────
      // Only engages when we're already in polyline mode AND the current
      // newElement is the matching linear type. The previous floating
      // last-point becomes fixed at this click's local coord, and a new
      // floating point is appended to track the cursor going forward.
      if (polylineActive && (tool === "line" || tool === "arrow")) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const curLine = (appState as any).newElement;
        if (curLine && (curLine.type === "line" || curLine.type === "arrow")) {
          const dx = x - curLine.x;
          const dy = y - curLine.y;
          const pts = [...(curLine.points ?? [])];
          if (pts.length === 0) pts.push([0, 0]);
          // Overwrite the floating last point with the click coord, then
          // append a new floating point identical to it.
          pts[pts.length - 1] = [dx, dy];
          pts.push([dx, dy]);
          let minX = 0, minY = 0, maxX = 0, maxY = 0;
          for (const [px, py] of pts) {
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (appState as any).newElement = {
            ...curLine,
            points: pts,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
            version: (curLine.version ?? 1) + 1,
          };
          tryCapture(event.currentTarget as HTMLElement | null, event.pointerId);
          bumpSceneRepaint();
          return;
        }
        // newElement was somehow cleared mid-polyline — reset flag and
        // fall through to fresh creation below.
        polylineActive = false;
      }

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
    // B2: eraser drag. Each hit is soft-deleted and tracked in the drag
    // set so the same element isn't hit twice + history lands once.
    if (eraserDragActive) {
      const { x: sx, y: sy } = toSceneCoords(event.clientX, event.clientY);
      eraseAt(sx, sy);
      return;
    }

    // A2: laser trail. Record container-relative coords so the SVG overlay
    // (also container-relative) can render without extra math. Runs before
    // any drawing/drag handlers so it fires even during pan or pinch.
    if (laserActive && containerEl) {
      const r = containerEl.getBoundingClientRect();
      laserTrail = [
        ...laserTrail,
        { x: event.clientX - r.left, y: event.clientY - r.top, t: performance.now() },
      ];
      startLaserRaf();
    }

    // ── Pinch update: when 2+ touches are active, compute new
    //    distance & midpoint relative to the gesture's start. ──────
    //
    // Anchor math: the SCENE point that was under the fingers'
    // midpoint at gesture-start should remain under the fingers'
    // midpoint throughout the gesture. This lets the user pinch-
    // zoom AND drag at the same time with natural feel.
    //
    //   sceneAnchor.x = (startMidX - offsetLeft) / startZoom - startScrollX
    //   nextZoom       = startZoom × (currentDist / startDist)
    //   // solve: (currentMidX - offsetLeft) / nextZoom - newScrollX == sceneAnchor.x
    //   newScrollX     = (currentMidX - offsetLeft) / nextZoom - sceneAnchor.x
    if (event.pointerType === "touch" && activeTouches.has(event.pointerId)) {
      activeTouches.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (pinchGesture && activeTouches.size >= 2) {
        const [a, b] = Array.from(activeTouches.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const offL = (appState.offsetLeft as any) ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const offT = (appState.offsetTop as any) ?? 0;
        const sceneAnchorX =
          (pinchGesture.startMidX - offL) / pinchGesture.startZoom -
          pinchGesture.startScrollX;
        const sceneAnchorY =
          (pinchGesture.startMidY - offT) / pinchGesture.startZoom -
          pinchGesture.startScrollY;
        const zoomFactor = dist / pinchGesture.startDist;
        // Clamp next zoom to sane bounds (matches applyZoom's range).
        const nextZoom = Math.min(
          30,
          Math.max(0.1, pinchGesture.startZoom * zoomFactor),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).zoom = { value: nextZoom };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).scrollX = (midX - offL) / nextZoom - sceneAnchorX;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).scrollY = (midY - offT) / nextZoom - sceneAnchorY;
        event.preventDefault();
        return;
      }
    }

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
      let dx = x - dragStart.x;
      let dy = y - dragStart.y;

      // A4/A6: snap + alignment guides. Shift bypasses snap (standard UX).
      // Snap the primary (first) origin and apply the same offset to the
      // rest so multi-element groups stay rigid.
      if (snapConfig.enabled && !event.shiftKey && dragOrigins.length > 0) {
        const primary = dragOrigins[0];
        const candidate = {
          x: primary.x + dx,
          y: primary.y + dy,
          width: primary.el.width,
          height: primary.el.height,
        };
        const draggingIds = new Set(dragOrigins.map((o) => o.el.id));
        const others = scene
          .getNonDeletedElements()
          .filter((el) => !draggingIds.has(el.id))
          .map((el) => ({
            id: el.id,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
          }));
        const { snapOffsetX, snapOffsetY, guides } = computeDragSnap(
          candidate,
          others,
          {
            threshold: snapConfig.threshold,
            snapToGrid: snapConfig.snapToGrid ?? false,
            snapToElements: snapConfig.snapToElements ?? false,
            snapEdges: snapConfig.snapEdges ?? true,
            snapCenters: snapConfig.snapCenters ?? true,
            gridSize: gridConfig.size,
          },
        );
        dx += snapOffsetX;
        dy += snapOffsetY;
        snapGuides = guides;
        isDraggingForSnap = guides.length > 0;
      } else {
        snapGuides = [];
        isDraggingForSnap = false;
      }

      // B1: precompute frame bboxes so drag-into-frame can assign frameId
      // as each non-frame origin crosses the boundary. Skip frames that
      // are themselves being dragged (moving with their children).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const draggingIds = new Set(dragOrigins.map((o: any) => o.el.id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const framesForBinding: Array<{ id: string; x: number; y: number; r: number; b: number }> = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const el of scene.getNonDeletedElements() as any[]) {
        if (el.type !== "frame") continue;
        if (draggingIds.has(el.id)) continue;
        framesForBinding.push({
          id: el.id, x: el.x, y: el.y,
          r: el.x + el.width, b: el.y + el.height,
        });
      }

      for (const origin of dragOrigins) {
        const nextX = origin.x + dx;
        const nextY = origin.y + dy;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const patch: any = { x: nextX, y: nextY };
        // B1: drag-into-frame — check bbox center against all non-dragging
        // frames. Skip for frame elements themselves (frames-in-frames not
        // supported here). `null` = not in any frame, which is also a valid
        // patch when the element is dragged OUT of its previous frame.
        if ((origin.el as any).type !== "frame") {
          const cx = nextX + origin.el.width / 2;
          const cy = nextY + origin.el.height / 2;
          const hit = framesForBinding.find((f) =>
            cx >= f.x && cx <= f.r && cy >= f.y && cy <= f.b,
          );
          const currentFrameId = (origin.el as any).frameId ?? null;
          const nextFrameId = hit ? hit.id : null;
          if (currentFrameId !== nextFrameId) patch.frameId = nextFrameId;
        }
        // scene.mutateElement applies the update AND bumps scene nonce via
        // triggerUpdate() — but the static-render $effect doesn't track
        // sceneNonce directly, so we bumpSceneRepaint() ourselves after
        // all mutations to force a repaint in one batch.
        scene.mutateElement(origin.el, patch,
          { informMutation: false, isDragging: true });
        // Re-route arrows bound to this element so connectors follow as
        // the shape moves. No-op if the element has no bound arrows.
        try {
          updateBoundElements(origin.el, scene);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("sveltedraw: updateBoundElements failed", err);
        }
      }
      bumpSceneRepaint();
      return;
    }

    // ── Extending the in-progress newElement (drawing tool) ──
    if (cur) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;

      if (cur.type === "line" || cur.type === "arrow") {
        // Linear elements: x/y stays at drag-start; the LAST point floats
        // with the cursor. Generalizes to N-point polylines: earlier
        // vertices were anchored by prior click-events (polyline mode).
        // Points are LOCAL coords relative to element's x/y.
        const basePts = cur.points && cur.points.length >= 1
          ? [...cur.points]
          : [[0, 0]];
        if (basePts.length === 1) {
          basePts.push([dx, dy]);
        } else {
          basePts[basePts.length - 1] = [dx, dy];
        }
        let minX = 0, minY = 0, maxX = 0, maxY = 0;
        for (const [px, py] of basePts) {
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).newElement = {
          ...cur,
          points: basePts,
          width: Math.max(1, maxX - minX),
          height: Math.max(1, maxY - minY),
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
    // Touch bookkeeping: drop the finger and, if we fall below 2
    // simultaneous touches, end the pinch gesture.
    if (event.pointerType === "touch") {
      activeTouches.delete(event.pointerId);
      if (pinchGesture && activeTouches.size < 2) {
        pinchGesture = null;
        // Persist zoom/scroll changes to localStorage.
        scheduleSave();
        tryRelease(event.currentTarget as HTMLElement | null, event.pointerId);
        return;
      }
    }

    if (isPanning) {
      endPan();
      tryRelease(event.currentTarget as HTMLElement | null, event.pointerId);
      return;
    }

    // B2: finish an eraser drag. One history entry for the whole swipe
    // (not one per shape). Clear the drag set + flag; tool stays active
    // so the user can keep erasing with subsequent pointerdowns.
    if (eraserDragActive) {
      eraserDragActive = false;
      if (eraserDraggedIds.size > 0) pushHistory();
      eraserDraggedIds.clear();
      bumpSceneRepaint();
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
      // undo stack). EXCEPTION: if this pointerdown created alt-drag
      // duplicates, we must push history regardless — otherwise the
      // duplicates are stranded in the scene with no undo path.
      let moved = false;
      for (const origin of dragOrigins) {
        if (origin.el.x !== origin.x || origin.el.y !== origin.y) {
          moved = true;
          break;
        }
      }
      dragOrigins = [];
      dragStart = null;
      // Clear A4/A6 snap guides on pointerup.
      snapGuides = [];
      isDraggingForSnap = false;
      if (moved || altDragHadDuplicate) pushHistory();
      altDragHadDuplicate = false;
      bumpSceneRepaint();
      tryRelease(event.currentTarget as HTMLElement | null, event.pointerId);
      return;
    }

    // ── Finalize in-progress newElement ──
    if (cur) {
      // Line/arrow dual-mode: click-release-without-drag enters polyline
      // mode (keep newElement alive for next vertex); drag-release
      // commits a 2-point line (existing UX). In polyline mode the
      // pointerdown handler already anchored a vertex — here we just
      // keep the element alive.
      if (cur.type === "line" || cur.type === "arrow") {
        const { x: ux, y: uy } = toSceneCoords(event.clientX, event.clientY);
        const ds = dragStart;
        const dragDist = ds ? Math.hypot(ux - ds.x, uy - ds.y) : 0;
        const CLICK_EPS = 4;
        if (polylineActive || dragDist < CLICK_EPS) {
          // Enter (or stay in) polyline mode. Ensure at least 2 points
          // so the next pointermove has a floating point to update.
          const pts = cur.points && cur.points.length >= 1
            ? [...cur.points]
            : [[0, 0]];
          if (pts.length === 1) pts.push([pts[0][0], pts[0][1]]);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (appState as any).newElement = {
            ...cur,
            points: pts,
            version: (cur.version ?? 1) + 1,
          };
          polylineActive = true;
          dragStart = null;
          bumpSceneRepaint();
          tryRelease(event.currentTarget as HTMLElement | null, event.pointerId);
          return;
        }
      }

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
      if (committed) {
        // After every draw: either keep the tool active (if the user
        // has "tool lock" on — upstream Q shortcut) or switch back
        // to selection + auto-select the fresh element.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const locked = !!(appState as any).activeTool?.locked;
        if (cur.type !== "freedraw" && !locked) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (appState as any).selectedElementIds = { [cur.id]: true };
          setActiveTool("selection");
        }
        pushHistory();
      }
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
    // Polyline mode: dblclick commits the current polyline. The second
    // pointerdown of the dblclick already anchored a duplicate vertex —
    // commitPolyline trims trailing duplicates automatically.
    if (polylineActive) {
      commitPolyline();
      setActiveTool("selection");
      event.preventDefault();
      return;
    }
    const { x, y } = toSceneCoords(event.clientX, event.clientY);
    const hit = hitTestAt(x, y);
    if (hit && hit.type === "text") {
      // Commit any open editor first.
      if (textEditor) commitTextEditor();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = hit as any;
      openTextEditor(el.x, el.y, {
        initialValue: el.text ?? "",
        editingElementId: el.id,
        element: el,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).theme === "dark" ? "theme--dark" : "",
      appState.viewModeEnabled ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState.openDialog as any)?.name === "elementLinkSelector"
        ? "excalidraw--view-mode"
        : "",
      editorInterface.formFactor === "phone" ? "excalidraw--mobile" : "",
      // A2: crosshair cursor while laser tool is active.
      laserActive ? "sveltedraw--laser" : "",
      // B2: eraser cursor hint.
      (appState.activeTool as any)?.type === "eraser" ? "sveltedraw--eraser" : "",
    ]
      .filter(Boolean)
      .join(" "),
  );

  // Language picker state — select element reads/writes via
  // setLanguage(). `currentLangCode` is a $derived that forwards the
  // store value so the select stays in sync after async load.
  const currentLangCode = $derived(getCurrentLangCode());

  // Toggle theme. Matches upstream's semantic: appState.theme is
  // "light" | "dark", and `exportWithDarkMode` mirrors it by default.
  const toggleTheme = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = (appState as any).theme === "dark" ? "light" : "dark";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).theme = next;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).exportWithDarkMode = next === "dark";
    scheduleSave();
  };

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

  <!-- Top-right utility bar: theme toggle + language picker. Kept
       minimal; upstream-style MainMenu is a Phase 7 concern. -->
  <!-- Main menu burger button — top-left. Dropdown with file +
       view + help commands. Uses the same outside-click / Escape
       pattern as the right-click context menu. -->
  <button
    type="button"
    class="sveltedraw-main-menu-trigger"
    aria-label="Menu"
    title="Menu"
    aria-expanded={mainMenuOpen}
    onclick={() => (mainMenuOpen = !mainMenuOpen)}
  >
    <Icon name="HamburgerMenuIcon" />
  </button>
  {#if mainMenuOpen}
    <div class="sveltedraw-main-menu" role="menu" tabindex="-1">
      <button type="button" class="mm-item" onclick={() => { loadFromExcalidrawFile(); closeMainMenu(); }}>{t("buttons.load", undefined, "Open…")}</button>
      <button type="button" class="mm-item" onclick={() => { saveAsExcalidrawFile(); closeMainMenu(); }}>{t("buttons.save", undefined, "Save as…")}</button>
      <div class="mm-sep"></div>
      <button type="button" class="mm-item" onclick={() => { downloadPng(); closeMainMenu(); }}>{t("buttons.exportImage", undefined, "Export as image")}</button>
      <button type="button" class="mm-item" onclick={() => { downloadSvg(); closeMainMenu(); }}>{t("buttons.exportToSvg", undefined, "Export as SVG")}</button>
      <div class="mm-sep"></div>
      <button type="button" class="mm-item" onclick={() => { toggleGrid(); closeMainMenu(); }}>
        {((appState as any).gridModeEnabled ? "✓ " : "")}{t("labels.showGrid", undefined, "Show grid")}
      </button>
      <button type="button" class="mm-item" onclick={() => { toggleTheme(); closeMainMenu(); }}>
        {((appState as any).theme === "dark" ? "✓ " : "")}{t("buttons.darkMode", undefined, "Dark mode")}
      </button>
      <div class="mm-sep"></div>
      <button type="button" class="mm-item" onclick={() => { helpDialogOpen = true; closeMainMenu(); }}>{t("helpDialog.title", undefined, "Keyboard shortcuts")}</button>
      <button type="button" class="mm-item mm-item--danger" onclick={() => { if (window.confirm(t("alerts.clearReset", undefined, "Clear the canvas?"))) { clearCanvas(); } closeMainMenu(); }}>{t("buttons.clearReset", undefined, "Reset canvas")}</button>
    </div>
  {/if}

  <!-- Help dialog — keyboard shortcut reference. Overlay + card. -->
  {#if helpDialogOpen}
    <div
      class="sveltedraw-help-overlay"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onpointerdown={() => (helpDialogOpen = false)}
    >
      <div
        class="sveltedraw-help-card"
        role="document"
        onpointerdown={(e) => e.stopPropagation()}
      >
        <div class="hd-header">
          <strong>{t("helpDialog.title", undefined, "Keyboard shortcuts")}</strong>
          <button type="button" class="hd-close" aria-label="Close" onclick={() => (helpDialogOpen = false)}>×</button>
        </div>
        <div class="hd-body">
          <div class="hd-section">
            <h4>Tools</h4>
            <div class="hd-row"><kbd>V</kbd>/<kbd>1</kbd><span>Selection</span></div>
            <div class="hd-row"><kbd>R</kbd>/<kbd>2</kbd><span>Rectangle</span></div>
            <div class="hd-row"><kbd>D</kbd>/<kbd>3</kbd><span>Diamond</span></div>
            <div class="hd-row"><kbd>O</kbd>/<kbd>4</kbd><span>Ellipse</span></div>
            <div class="hd-row"><kbd>A</kbd>/<kbd>5</kbd><span>Arrow</span></div>
            <div class="hd-row"><kbd>L</kbd>/<kbd>6</kbd><span>Line</span></div>
            <div class="hd-row"><kbd>P</kbd>/<kbd>7</kbd><span>Draw</span></div>
            <div class="hd-row"><kbd>T</kbd>/<kbd>8</kbd><span>Text</span></div>
          </div>
          <div class="hd-section">
            <h4>Edit</h4>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Z</kbd><span>Undo</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Y</kbd><span>Redo</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>A</kbd><span>Select all</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>D</kbd><span>Duplicate</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>G</kbd><span>Group</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd><span>Ungroup</span></div>
            <div class="hd-row"><kbd>Del</kbd><span>Delete</span></div>
            <div class="hd-row"><kbd>Alt</kbd>+drag<span>Duplicate while dragging</span></div>
          </div>
          <div class="hd-section">
            <h4>Z-order</h4>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>]</kbd><span>Bring forward</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>]</kbd><span>Bring to front</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>[</kbd><span>Send backward</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>[</kbd><span>Send to back</span></div>
          </div>
          <div class="hd-section">
            <h4>View</h4>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>0</kbd><span>Reset zoom</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>+</kbd><span>Zoom in</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>-</kbd><span>Zoom out</span></div>
            <div class="hd-row"><kbd>Space</kbd>+drag<span>Pan canvas</span></div>
            <div class="hd-row">Pinch<span>Zoom on touch</span></div>
          </div>
          <div class="hd-section">
            <h4>Export</h4>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>S</kbd><span>Export PNG</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd><span>Export SVG</span></div>
          </div>
          <div class="hd-section">
            <h4>Templates & Library</h4>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>N</kbd><span>New from template</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>R</kbd><span>Recent files</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>,</kbd><span>Settings</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>L</kbd><span>Toggle library</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd><span>New frame</span></div>
          </div>
          <div class="hd-section">
            <h4>Advanced Tools (Phase 13)</h4>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd><span>Connector tool</span></div>
            <h5 style="margin: 12px 0 8px; font-weight: 600; color: #666;">Alignment & Distribution</h5>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>L</kbd><span>Align left</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>C</kbd><span>Align center</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd><span>Align right</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd><span>Align top</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd><span>Align middle</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd><span>Align bottom</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd><span>Distribute horizontally</span></div>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd><span>Distribute vertically</span></div>
            <h5 style="margin: 12px 0 8px; font-weight: 600; color: #666;">Measurements & Dimensions</h5>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>M</kbd><span>Show/hide measurements panel</span></div>
            <h5 style="margin: 12px 0 8px; font-weight: 600; color: #666;">Auto-Layout</h5>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>L</kbd><span>Show/hide auto-layout panel</span></div>
            <h5 style="margin: 12px 0 8px; font-weight: 600; color: #666;">Advanced Text Features</h5>
            <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>T</kbd><span>Show/hide text editor panel</span></div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Welcome screen — centered hint shown only when canvas is empty
       and no tool is active. Disappears as soon as the user adds an
       element or picks a non-selection tool. -->
  {#if scene && scene.getNonDeletedElements().length === 0 && (appState.activeTool as any)?.type === "selection"}
    <div class="sveltedraw-welcome">
      <div class="sw-title">Sveltedraw</div>
      <div class="sw-hint">
        Pick a tool above or press <kbd>R</kbd> <kbd>D</kbd> <kbd>O</kbd> <kbd>L</kbd> <kbd>A</kbd> <kbd>P</kbd> <kbd>T</kbd> to start drawing.
      </div>
      <div class="sw-hint-alt">
        <kbd>?</kbd> for keyboard shortcuts ·
        <button type="button" class="sw-link" onclick={() => (helpDialogOpen = true)}>Open help</button>
      </div>
    </div>
  {/if}

  <!-- Hint viewer — contextual one-liner at bottom-center showing
       what the current tool does. Upstream has richer per-state hints;
       ours is minimal. -->
  {#if (appState.activeTool as any)?.type && (appState.activeTool as any).type !== "selection"}
    <div class="sveltedraw-hint">
      {#if (appState.activeTool as any).type === "text"}
        Click to place text, then type. <kbd>Esc</kbd> or click elsewhere to commit.
      {:else if (appState.activeTool as any).type === "line" || (appState.activeTool as any).type === "arrow"}
        Drag for a straight line, or click successive points + press <kbd>Enter</kbd> for a polyline.
      {:else if (appState.activeTool as any).type === "freedraw"}
        Draw freehand. Pressure-sensitive if your device supports it.
      {:else}
        Click and drag to draw a {(appState.activeTool as any).type}. <kbd>Esc</kbd> to cancel.
      {/if}
    </div>
  {/if}

  <!-- Toolbox — top-center. Single row of shape buttons + a
       keyboard-shortcut hint. Active tool gets highlighted. -->
  {#snippet toolBtn(
    tool: string,
    iconName: string,
    key: string,
    label: string,
  )}
    <button
      type="button"
      class="sveltedraw-tool-btn"
      class:active={(appState.activeTool as any)?.type === tool}
      aria-label={label}
      aria-pressed={(appState.activeTool as any)?.type === tool}
      title={`${label} — ${key.toUpperCase()}`}
      data-tool={tool}
      onclick={() => setActiveTool(tool)}
    >
      <Icon name={iconName} />
    </button>
  {/snippet}
  <div class="sveltedraw-toolbox" role="toolbar" aria-label="Shape tools">
    {@render toolBtn("selection", "SelectionIcon", "v", "Selection")}
    <div class="tb-sep"></div>
    {@render toolBtn("rectangle", "RectangleIcon", "r", "Rectangle")}
    {@render toolBtn("diamond", "DiamondIcon", "d", "Diamond")}
    {@render toolBtn("ellipse", "EllipseIcon", "o", "Ellipse")}
    {@render toolBtn("arrow", "ArrowIcon", "a", "Arrow")}
    {@render toolBtn("line", "LineIcon", "l", "Line")}
    {@render toolBtn("freedraw", "FreedrawIcon", "p", "Draw")}
    {@render toolBtn("eraser", "EraserIcon", "e", "Eraser")}
    {@render toolBtn("text", "TextIcon", "t", "Text")}
    <div class="tb-sep"></div>
    <button
      type="button"
      class="sveltedraw-tool-btn"
      class:active={(appState.activeTool as any)?.locked}
      aria-label="Tool lock"
      aria-pressed={(appState.activeTool as any)?.locked}
      title="Tool lock — Q"
      onclick={toggleToolLock}
    >
      {(appState.activeTool as any)?.locked ? "🔒" : "🔓"}
    </button>
  </div>

  <!-- Zoom controls — bottom-right. −, percent (reset on click), +. -->
  <div class="sveltedraw-zoom-ctrls" role="toolbar" aria-label="Zoom">
    <button
      type="button"
      class="sveltedraw-zoom-btn"
      aria-label="Zoom out"
      title="Zoom out (Ctrl+-)"
      onclick={() => zoomCentered(((appState.zoom as any).value || 1) - ZOOM_STEP)}
    >−</button>
    <button
      type="button"
      class="sveltedraw-zoom-btn sveltedraw-zoom-reset"
      aria-label="Reset zoom"
      title="Reset zoom (Ctrl+0)"
      onclick={resetZoom}
    >
      {Math.round(((appState.zoom as any).value || 1) * 100)}%
    </button>
    <button
      type="button"
      class="sveltedraw-zoom-btn"
      aria-label="Zoom in"
      title="Zoom in (Ctrl++)"
      onclick={() => zoomCentered(((appState.zoom as any).value || 1) + ZOOM_STEP)}
    >+</button>
  </div>

  <div class="sveltedraw-utility-bar">
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={libraryPanelOpen}
      aria-label={t("toolBar.library")}
      title={t("toolBar.library")}
      onclick={() => (libraryPanelOpen = !libraryPanelOpen)}
    >
      📚
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      aria-label="New from template"
      title="New from template (Ctrl+N)"
      onclick={() => (showTemplateSelector = true)}
    >
      📋
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      aria-label="Recent files"
      title="Recent files (Ctrl+R)"
      onclick={() => (showRecentFiles = true)}
    >
      🕐
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      aria-label="Settings"
      title="Settings (Ctrl+,)"
      onclick={() => (showSettings = true)}
    >
      ⚙️
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={connectorToolActive}
      aria-label="Connector tool"
      title="Connector tool (Ctrl+Shift+C)"
      onclick={() => (connectorToolActive = !connectorToolActive)}
    >
      ⚡
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={laserActive}
      aria-label="Laser pointer"
      title="Laser pointer (K, L in presentation)"
      onclick={toggleLaser}
    >
      ✦
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      aria-label="Create frame"
      title="New frame (Ctrl+Shift+F)"
      onclick={createFrameAtCenter}
    >
      ⬛
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={alignmentPanelActive}
      aria-label="Alignment tool"
      title="Alignment & Distribution (Ctrl+Alt+L, etc)"
      onclick={() => toggleSidePanel("alignment")}
    >
      ◫
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={measurementPanelActive}
      aria-label="Measurements"
      title="Measurements & Dimensions (Ctrl+M)"
      onclick={() => toggleSidePanel("measurement")}
    >
      📏
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={autoLayoutPanelActive}
      aria-label="Auto Layout"
      title="Auto Layout (Ctrl+L)"
      onclick={() => toggleSidePanel("autolayout")}
    >
      🎯
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={gridPanelActive}
      aria-label="Grid & Snap"
      title="Grid & Snap Settings"
      onclick={() => toggleSidePanel("grid")}
    >
      ⊞
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={layerPanelActive}
      aria-label="Layers"
      title="Layer Management"
      onclick={() => toggleSidePanel("layer")}
    >
      📑
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={historyPanelActive}
      aria-label="History"
      title="Undo/Redo History"
      onclick={() => toggleSidePanel("history")}
    >
      ⏮
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={libraryPanelActive}
      aria-label="Shape Library"
      title="Shape Library & Components"
      onclick={() => toggleSidePanel("library")}
    >
      📚
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      aria-label="Presentation"
      title="Start Presentation Mode"
      onclick={handleStartPresentation}
    >
      🎬
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      aria-label="Export"
      title="Export Drawing"
      onclick={() => (exportPanelActive = true)}
    >
      💾
    </button>
    <button
      type="button"
      class="sveltedraw-util-btn"
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      onclick={toggleTheme}
    >
      {#if (appState as any).theme === "dark"}☀{:else}☾{/if}
    </button>
    <select
      class="sveltedraw-util-btn sveltedraw-lang-select"
      aria-label="Language"
      value={currentLangCode}
      onchange={(e) => setLanguage((e.currentTarget as HTMLSelectElement).value)}
    >
      {#each availableLanguages as lang (lang.code)}
        <option value={lang.code}>{lang.label}</option>
      {/each}
    </select>
    <button
      type="button"
      class="sveltedraw-util-btn"
      aria-label="Help"
      title="Help (F1)"
      onclick={() => (showHelpPanel = true)}
    >
      ❓
    </button>
  </div>

  <!-- Connector tool panel — Phase 13 -->
  {#if connectorToolActive}
    <div class="sveltedraw-connector-panel">
      <ConnectorTool
        hasFirstPick={selectedForConnection !== null}
        onCancel={() => {
          connectorToolActive = false;
          selectedForConnection = null;
        }}
      />
    </div>
  {/if}

  <!-- Alignment panel — Phase 13 Feature 2 -->
  {#if alignmentPanelActive}
    <div class="sveltedraw-alignment-panel">
      <AlignmentPanel
        selectedCount={getSelectedElements().length}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
      />
    </div>
  {/if}

  <!-- Measurement panel — Phase 13 Feature 3 -->
  {#if measurementPanelActive}
    <div class="sveltedraw-measurement-panel">
      <MeasurementPanel
        selectedElements={getSelectedElements().map(el => ({
          id: el.id,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
        }))}
        config={measurementConfig}
        onConfigChange={(newConfig) => (measurementConfig = newConfig)}
      />
    </div>
  {/if}

  <!-- Auto-Layout panel — Phase 13 Feature 4 -->
  {#if autoLayoutPanelActive}
    <div class="sveltedraw-autolayout-panel">
      <AutoLayoutPanel
        selectedCount={getSelectedElements().length}
        onLayout={handleAutoLayout}
      />
    </div>
  {/if}


  <!-- Grid & Snap panel — Phase 14 Feature 1 -->
  {#if gridPanelActive}
    <div class="sveltedraw-grid-panel">
      <GridPanel
        {gridConfig}
        {snapConfig}
        onGridConfigChange={(newConfig) => (gridConfig = newConfig)}
        onSnapConfigChange={(newConfig) => (snapConfig = newConfig)}
      />
    </div>
  {/if}

  <!-- Layer panel — Phase 15 Feature 1 + 2 + 3 + 4 -->
  {#if layerPanelActive}
    <div class="sveltedraw-layer-panel">
      <LayerPanel
        {layers}
        {selectedLayerId}
        onLayerSelect={handleLayerSelect}
        onLayerVisibilityChange={handleLayerVisibilityChange}
        onLayerLockChange={handleLayerLockChange}
        onLayerOpacityChange={handleLayerOpacityChange}
        onCreateGroup={handleCreateGroup}
        onDeleteGroup={handleDeleteGroup}
        onReorderLayers={handleReorderLayers}
      />
    </div>
  {/if}

  <!-- History panel — Phase 16 Feature 1 -->
  {#if historyPanelActive}
    <div class="sveltedraw-history-panel">
      <HistoryPanel
        history={editorHistory}
        currentIndex={historyCurrentIndex}
        onJumpToState={handleHistoryJump}
        onClearHistory={handleHistoryClear}
      />
    </div>
  {/if}

  <!-- Shape Library panel — Phase 16 Feature 2 -->
  {#if libraryPanelActive}
    <div class="sveltedraw-shape-library-panel">
      <ShapeLibraryPanel
        components={libraryComponents}
        categories={libraryCategories}
        selectedCategoryId={librarySelectedCategory}
        searchQuery={librarySearchQuery}
        onSelectComponent={handleLibraryComponentSelect}
        onDeleteComponent={handleLibraryComponentDelete}
        onCategoryChange={(id) => (librarySelectedCategory = id)}
        onSearchChange={(q) => (librarySearchQuery = q)}
        onExportLibrary={handleLibraryExport}
        onImportLibrary={handleLibraryImport}
      />
    </div>
  {/if}

  <!-- Presentation Mode — Phase 16 Feature 3 -->
  {#if presentationActive}
    <PresentationMode
      slides={presentationSlides}
      slideSvgs={presentationSlideSvgs}
      currentSlideIndex={presentationCurrentIndex}
      isPlaying={presentationIsPlaying}
      showSlideNumbers={presentationConfig.showSlideNumbers}
      showNotes={presentationConfig.showNotes}
      onNextSlide={handlePresentationNextSlide}
      onPreviousSlide={handlePresentationPreviousSlide}
      onTogglePlayPause={handlePresentationTogglePlayPause}
      onExit={handlePresentationExit}
      onSlideJump={handlePresentationSlideJump}
    />
  {/if}

  <!-- Export Panel — Phase 16 Feature 4 -->
  {#if exportPanelActive}
    <ExportPanel
      options={exportOptions}
      presets={exportPresets}
      elementCount={scene ? scene.getNonDeletedElements().length : 0}
      onExport={handleExport}
      onOptionsChange={(opts) => (exportOptions = opts)}
      onPresetSelect={(preset) => {
        exportOptions = {
          ...exportOptions,
          format: preset.format,
          width: preset.width,
          height: preset.height,
          scale: preset.scale,
          quality: preset.quality,
        };
      }}
      onClose={() => (exportPanelActive = false)}
    />
  {/if}

  <!-- Library panel — floats bottom-left. Each item is a button that
       inserts the saved elements at viewport center. The × closes
       the panel; the ×-per-item deletes that specific item. -->
  {#if libraryPanelOpen}
    <div class="sveltedraw-library-panel" role="region" aria-label={t("toolBar.library")}>
      <div class="lib-header">
        <strong>{t("toolBar.library")}</strong>
        <button
          type="button"
          class="lib-close"
          aria-label="Close library"
          onclick={() => (libraryPanelOpen = false)}
        >×</button>
      </div>
      {#if libraryItems.length === 0}
        <div class="lib-empty">
          {t("library.hint_emptyLibrary", undefined, "Select elements, right-click → Save to library.")}
        </div>
      {:else}
        <div class="lib-items">
          {#each libraryItems as item (item.id)}
            <div class="lib-item">
              <button
                type="button"
                class="lib-item-insert"
                title={`Insert ${item.name}`}
                onclick={() => insertLibraryItem(item)}
              >
                <span class="lib-item-name">{item.name}</span>
                <span class="lib-item-count">{item.elements.length}</span>
              </button>
              <button
                type="button"
                class="lib-item-del"
                aria-label={`Delete ${item.name}`}
                title="Remove from library"
                onclick={() => deleteLibraryItem(item.id)}
              >×</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Template selector — modal for choosing pre-made templates. -->
  {#if showTemplateSelector}
    <TemplateSelector
      onSelect={selectTemplate}
      onClose={() => (showTemplateSelector = false)}
    />
  {/if}

  <!-- A1: element-link dialog. Modal overlay; Ctrl+K, context menu, and the
       hover chip all flow through openLinkDialog(). The overlay is just a
       backdrop — click closes; keyboard Esc also closes via the dialog's
       own listener. stopPropagation on the modal prevents backdrop clicks
       from reaching it and closing accidentally. -->
  {#if linkDialogOpen && getLinkedElement}
    <div
      class="sveltedraw-link-overlay"
      role="presentation"
      onclick={closeLinkDialog}
    >
      <div
        class="sveltedraw-link-modal"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => { if (e.key === "Escape") closeLinkDialog(); }}
      >
        <ElementLinkDialog
          link={(getLinkedElement as any).link ?? null}
          originalLink={(getLinkedElement as any).link ?? null}
          onConfirm={confirmLinkDialog}
          onClose={closeLinkDialog}
          enabled={linkDialogOpen}
        />
      </div>
    </div>
  {/if}

  <!-- Recent files panel — shows last 10 files. -->
  {#if showRecentFiles}
    <RecentFilesPanel
      files={recentFiles}
      onClose={() => (showRecentFiles = false)}
      onDelete={deleteRecentFile}
    />
  {/if}

  <!-- Settings panel — user preferences. -->
  {#if showSettings}
    <SettingsPanel
      settings={appSettings}
      onSettingsChange={updateSettings}
      onClose={() => (showSettings = false)}
    />
  {/if}

  <!-- Help panel — comprehensive documentation. -->
  {#if showHelpPanel}
    <HelpPanel onClose={() => (showHelpPanel = false)} />
  {/if}

  <!-- Style panel. Shown whenever the editor is mounted; changes apply
       to the current selection OR to currentItem* defaults if none. -->
  <div class="sveltedraw-style-panel">
    <div class="sp-row">
      <div class="sp-label">{t("labels.stroke")}</div>
      <div class="sp-picker">
        <ColorPicker
          type="elementStroke"
          color={panelStyle.strokeColor}
          label="Stroke"
          elements={pickerElements}
          updateData={() => {}}
          open={strokePickerOpen}
          onToggle={() => {
            strokePickerOpen = !strokePickerOpen;
            if (strokePickerOpen) bgPickerOpen = false;
          }}
          onClose={() => (strokePickerOpen = false)}
          onChange={(c) => applyStyle({ strokeColor: c })}
          onEyeDropperToggle={() => {}}
          container={containerEl}
        />
      </div>
    </div>

    {#if !allSelectedAreText && !allSelectedAreLinear}
      <div class="sp-row">
        <div class="sp-label">{t("labels.background")}</div>
        <div class="sp-picker">
          <ColorPicker
            type="elementBackground"
            color={panelStyle.backgroundColor}
            label="Background"
            elements={pickerElements}
            updateData={() => {}}
            open={bgPickerOpen}
            onToggle={() => {
              bgPickerOpen = !bgPickerOpen;
              if (bgPickerOpen) strokePickerOpen = false;
            }}
            onClose={() => (bgPickerOpen = false)}
            onChange={(c) => applyStyle({ backgroundColor: c })}
            onEyeDropperToggle={() => {}}
            container={containerEl}
          />
        </div>
      </div>
    {/if}

    {#if !allSelectedAreText}
      <div class="sp-row">
        <div class="sp-label">{t("labels.strokeWidth")}</div>
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
        <div class="sp-label">{t("labels.strokeStyle")}</div>
        <div class="sp-swatches">
          {#each STROKE_STYLES as s}
            <button
              type="button"
              class="sp-icon-btn"
              class:active={panelStyle.strokeStyle === s.value}
              data-preset="strokeStyle"
              data-value={s.value}
              aria-label={`Stroke style ${s.name}`}
              onclick={() => applyStyle({ strokeStyle: s.value })}
            >
              {#if s.value === "solid"}
                <StrokeStyleSolidIcon />
              {:else}
                <Icon name={s.icon} />
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if !allSelectedAreText && !allSelectedAreLinear}
      <div class="sp-row">
        <div class="sp-label">{t("labels.fill")}</div>
        <div class="sp-swatches">
          {#each FILL_STYLES as f}
            <button
              type="button"
              class="sp-icon-btn"
              class:active={panelStyle.fillStyle === f.value}
              data-preset="fillStyle"
              data-value={f.value}
              aria-label={`Fill style ${f.name}`}
              onclick={() => applyStyle({ fillStyle: f.value })}
            >
              <Icon name={f.icon} />
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if !allSelectedAreText}
      <div class="sp-row">
        <div class="sp-label">{t("labels.sloppiness")}</div>
        <div class="sp-swatches">
          {#each ROUGHNESS_PRESETS as r}
            <button
              type="button"
              class="sp-icon-btn"
              class:active={panelStyle.roughness === r.value}
              data-preset="roughness"
              data-value={r.value}
              aria-label={`Roughness ${r.name}`}
              onclick={() => applyStyle({ roughness: r.value })}
            >
              <Icon name={r.icon} />
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if hasRoundableSelected}
      <!-- Edge style: sharp corners vs smooth curves. applyRoundnessToSelection
           picks the right roundness.type per element (ADAPTIVE for rectangles/
           diamonds, PROPORTIONAL for lines/arrows). -->
      <div class="sp-row">
        <div class="sp-label">Edges</div>
        <div class="sp-swatches">
          <button
            type="button"
            class="sp-icon-btn"
            class:active={!panelStyle.roundness}
            data-preset="edges"
            data-value="sharp"
            aria-label="Sharp"
            title="Sharp"
            onclick={() => applyRoundnessToSelection(false)}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 14 L4 6 L16 6" stroke-linecap="round" stroke-linejoin="miter"/>
            </svg>
          </button>
          <button
            type="button"
            class="sp-icon-btn"
            class:active={!!panelStyle.roundness}
            data-preset="edges"
            data-value="round"
            aria-label="Round"
            title="Round"
            onclick={() => applyRoundnessToSelection(true)}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 14 Q4 6 10 6 L16 6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}

    {#if hasLinearSelected}
      {#snippet arrowheadIcon(value: string | null, flip: boolean)}
        {#if value === null}
          <ArrowheadNoneIcon {flip} />
        {:else if value === "arrow"}
          <ArrowheadArrowIcon {flip} />
        {:else if value === "triangle"}
          <ArrowheadTriangleIcon {flip} />
        {:else if value === "triangle_outline"}
          <ArrowheadTriangleOutlineIcon {flip} />
        {:else if value === "diamond"}
          <ArrowheadDiamondIcon {flip} />
        {:else if value === "diamond_outline"}
          <ArrowheadDiamondOutlineIcon {flip} />
        {:else if value === "circle"}
          <ArrowheadCircleIcon {flip} />
        {:else if value === "circle_outline"}
          <ArrowheadCircleOutlineIcon {flip} />
        {:else if value === "bar"}
          <ArrowheadBarIcon {flip} />
        {/if}
      {/snippet}
      <div class="sp-row">
        <div class="sp-label">Start arrow</div>
        <div class="sp-swatches">
          {#each ARROWHEAD_PRESETS as a}
            <button
              type="button"
              class="sp-icon-btn"
              class:active={panelStyle.startArrowhead === a.value}
              data-preset="startArrowhead"
              data-value={a.value ?? "none"}
              aria-label={`Start arrow ${a.name}`}
              onclick={() => applyStyle({ startArrowhead: a.value })}
            >
              {@render arrowheadIcon(a.value, true)}
            </button>
          {/each}
        </div>
      </div>
      <div class="sp-row">
        <div class="sp-label">End arrow</div>
        <div class="sp-swatches">
          {#each ARROWHEAD_PRESETS as a}
            <button
              type="button"
              class="sp-icon-btn"
              class:active={panelStyle.endArrowhead === a.value}
              data-preset="endArrowhead"
              data-value={a.value ?? "none"}
              aria-label={`End arrow ${a.name}`}
              onclick={() => applyStyle({ endArrowhead: a.value })}
            >
              {@render arrowheadIcon(a.value, false)}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if hasTextSelected}
      {#snippet verticalAlignIcon(value: string)}
        {#if value === "top"}
          <TextAlignTopIcon />
        {:else if value === "middle"}
          <TextAlignMiddleIcon />
        {:else if value === "bottom"}
          <TextAlignBottomIcon />
        {/if}
      {/snippet}

      <!-- Bold / Italic / Underline / Strikethrough — each applies the
           corresponding field on the text element. Toggle on second click.
           Renderer (canvas + SVG) honors all four; pixel-verified. -->
      <div class="sp-row">
        <div class="sp-label">Format</div>
        <div class="sp-swatches">
          <button
            type="button"
            class="sp-icon-btn sp-format-btn"
            class:active={panelStyle.fontWeight === "bold"}
            data-preset="fontWeight"
            data-value="bold"
            aria-label="Bold"
            title="Bold"
            onclick={() => applyStyle({
              fontWeight: panelStyle.fontWeight === "bold" ? "normal" : "bold",
            })}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            class="sp-icon-btn sp-format-btn"
            class:active={panelStyle.fontStyle === "italic"}
            data-preset="fontStyle"
            data-value="italic"
            aria-label="Italic"
            title="Italic"
            onclick={() => applyStyle({
              fontStyle: panelStyle.fontStyle === "italic" ? "normal" : "italic",
            })}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            class="sp-icon-btn sp-format-btn"
            class:active={panelStyle.textDecoration === "underline"}
            data-preset="textDecoration"
            data-value="underline"
            aria-label="Underline"
            title="Underline"
            onclick={() => applyStyle({
              textDecoration: panelStyle.textDecoration === "underline" ? "none" : "underline",
            })}
          >
            <span style="text-decoration: underline">U</span>
          </button>
          <button
            type="button"
            class="sp-icon-btn sp-format-btn"
            class:active={panelStyle.textDecoration === "line-through"}
            data-preset="textDecoration"
            data-value="line-through"
            aria-label="Strikethrough"
            title="Strikethrough"
            onclick={() => applyStyle({
              textDecoration: panelStyle.textDecoration === "line-through" ? "none" : "line-through",
            })}
          >
            <span style="text-decoration: line-through">S</span>
          </button>
        </div>
      </div>

      <div class="sp-row">
        <div class="sp-label">{t("labels.textAlign")}</div>
        <div class="sp-swatches">
          {#each TEXT_ALIGN_PRESETS as t}
            <button
              type="button"
              class="sp-icon-btn"
              class:active={panelStyle.textAlign === t.value}
              data-preset="textAlign"
              data-value={t.value}
              aria-label={`Text align ${t.name}`}
              onclick={() => applyStyle({ textAlign: t.value })}
            >
              <Icon name={t.icon} />
            </button>
          {/each}
        </div>
      </div>
      <div class="sp-row">
        <div class="sp-label">Vertical</div>
        <div class="sp-swatches">
          {#each VERTICAL_ALIGN_PRESETS as v}
            <button
              type="button"
              class="sp-icon-btn"
              class:active={panelStyle.verticalAlign === v.value}
              data-preset="verticalAlign"
              data-value={v.value}
              aria-label={`Vertical align ${v.name}`}
              onclick={() => applyStyle({ verticalAlign: v.value })}
            >
              {@render verticalAlignIcon(v.value)}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="sp-row">
      <div class="sp-label">{t("labels.opacity")}</div>
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

    {#if hasTextSelected}
      <!-- Font size — Small / Medium / Large / Extra large.
           Upstream's canonical values are 16 / 20 / 28 / 36. Applies
           via applyStyle so it flows through currentItemFontSize
           when no text is selected (defaults for next-drawn). -->
      <div class="sp-row">
        <div class="sp-label">{t("labels.fontSize")}</div>
        <div class="sp-swatches">
          {#each FONT_SIZE_PRESETS as fs}
            <button
              type="button"
              class="sp-icon-btn"
              class:active={panelStyle.fontSize === fs.value}
              data-preset="fontSize"
              data-value={fs.value}
              aria-label={fs.name}
              title={fs.name}
              onclick={() => applyStyle({ fontSize: fs.value })}
            >
              <Icon name={fs.icon} />
            </button>
          {/each}
        </div>
      </div>
      <div class="sp-row">
        <div class="sp-label">{t("labels.fontFamily")}</div>
        <div class="sp-picker sp-font-picker">
          {#snippet handDrawnIcon()}<Icon name="FreedrawIcon" />{/snippet}
          {#snippet normalIcon()}<Icon name="FontFamilyNormalIcon" />{/snippet}
          {#snippet codeIcon()}<Icon name="FontFamilyCodeIcon" />{/snippet}
          <FontPicker
            isOpened={fontPickerOpen}
            selectedFontFamily={panelFontFamily}
            hoveredFontFamily={fontPickerHover}
            defaultFonts={[
              { value: FONT_FAMILY.Excalifont, icon: handDrawnIcon, text: "Hand-drawn", testId: "font-family-hand-drawn" },
              { value: FONT_FAMILY.Helvetica, icon: normalIcon, text: "Normal", testId: "font-family-normal" },
              { value: FONT_FAMILY.Cascadia, icon: codeIcon, text: "Code", testId: "font-family-code" },
            ]}
            sceneFonts={Object.entries(fontFamilyLabels)
              .filter(([v]) => sceneFontFamilies.has(Number(v)) && !defaultFontValues.includes(Number(v)))
              .map(([v, text]) => ({ value: Number(v), icon: normalIcon, text }))}
            availableFonts={Object.entries(fontFamilyLabels)
              .filter(([v]) => !sceneFontFamilies.has(Number(v)) && !defaultFontValues.includes(Number(v)))
              .map(([v, text]) => ({ value: Number(v), icon: normalIcon, text }))}
            onSelect={(v) => {
              applyStyle({ fontFamily: v });
              fontPickerOpen = false;
            }}
            onHover={(v) => (fontPickerHover = v)}
            onLeave={() => (fontPickerHover = null)}
            onPopupChange={(open) => (fontPickerOpen = open)}
            container={containerEl}
          />
        </div>
      </div>
    {/if}

    <!-- C1: drop shadow — one-click presets. None / Soft / Hard. Applied
         on every selected element. Uses applyStyle so the value flows
         through scene.mutateElement + history. -->
    {#if Object.keys((appState as any).selectedElementIds ?? {}).length > 0}
      <div class="sp-row">
        <div class="sp-label">Shadow</div>
        <div class="sp-swatches">
          <button
            type="button"
            class="sp-icon-btn"
            class:active={!panelStyle.shadow}
            title="None"
            aria-label="Shadow none"
            onclick={() => applyStyle({ shadow: null })}
          >∅</button>
          <button
            type="button"
            class="sp-icon-btn"
            title="Soft"
            aria-label="Shadow soft"
            onclick={() => applyStyle({ shadow: { color: "rgba(0,0,0,0.25)", offsetX: 4, offsetY: 4, blur: 8 } })}
          >◌</button>
          <button
            type="button"
            class="sp-icon-btn"
            title="Hard"
            aria-label="Shadow hard"
            onclick={() => applyStyle({ shadow: { color: "#000", offsetX: 6, offsetY: 6, blur: 0 } })}
          >●</button>
        </div>
      </div>
    {/if}

    <!-- A9: line-height slider (text-only). Migrated from TextEditorPanel.
         Upstream stores lineHeight as a float multiplier (≈1.25 default). -->
    {#if hasTextSelected}
      <div class="sp-row">
        <div class="sp-label">Line height</div>
        <div class="sp-swatches sp-slider">
          <input
            type="range" min="1" max="3" step="0.05"
            value={panelStyle.lineHeight}
            oninput={(e) => applyStyle({ lineHeight: parseFloat((e.currentTarget as HTMLInputElement).value) })}
            aria-label="Line height"
          />
          <span class="sp-slider-value">{Number(panelStyle.lineHeight ?? 1.25).toFixed(2)}</span>
        </div>
      </div>
    {/if}

    <!-- A9: rotation slider. Any element. Also migrated from TextEditorPanel.
         Rotation handles still work; this is just a precise numeric input. -->
    {#if Object.keys((appState as any).selectedElementIds ?? {}).length === 1}
      <div class="sp-row">
        <div class="sp-label">Rotation</div>
        <div class="sp-swatches sp-slider">
          <input
            type="range" min="0" max="360" step="1"
            value={Math.round(((panelStyle.angle ?? 0) * 180) / Math.PI)}
            oninput={(e) => applyStyle({ angle: (parseInt((e.currentTarget as HTMLInputElement).value, 10) * Math.PI) / 180 })}
            aria-label="Rotation angle"
          />
          <span class="sp-slider-value">{Math.round(((panelStyle.angle ?? 0) * 180) / Math.PI)}°</span>
        </div>
      </div>
    {/if}

    <!-- Lock/unlock + C2 flip (H/V). Actions row. -->
    {#if Object.keys((appState as any).selectedElementIds ?? {}).length > 0}
      <div class="sp-row">
        <div class="sp-label">Actions</div>
        <div class="sp-swatches">
          <button
            type="button"
            class="sp-icon-btn"
            aria-label="Toggle lock"
            title="Lock/unlock (Ctrl+Shift+L)"
            onclick={toggleLockSelected}
          >
            {getSelectedElements().some((el) => el.locked) ? "🔒" : "🔓"}
          </button>
          <button
            type="button"
            class="sp-icon-btn"
            aria-label="Flip horizontal"
            title="Flip horizontal"
            onclick={() => flipSelected("horizontal")}
          >⇔</button>
          <button
            type="button"
            class="sp-icon-btn"
            aria-label="Flip vertical"
            title="Flip vertical"
            onclick={() => flipSelected("vertical")}
          >⇕</button>
        </div>
      </div>
    {/if}
  </div>

  <StaticCanvas
    canvas={staticCanvas}
    {scale}
    appState={{ width: appState.width, height: appState.height }}
    renderConfig={undefined}
    render={noopRender}
  />

  <!-- A1: link chip overlay. `linkedSelected` is a $derived that reads
       sceneReady explicitly so it recomputes after mutateElement bumps. -->
  {#each linkedSelected as el (el.id)}
    {@const zoomV = (appState.zoom as any).value ?? 1}
    {@const cx = (el.x + el.width + ((appState.scrollX as any) ?? 0)) * zoomV}
    {@const cy = (el.y + ((appState.scrollY as any) ?? 0)) * zoomV}
    <a
      class="sveltedraw-link-chip"
      style="left: {Math.max(cx - 180, 8)}px; top: {Math.max(cy - 28, 8)}px;"
      href={(el as any).link}
      target="_blank"
      rel="noopener noreferrer"
      title={(el as any).link}
    >
      🔗 {(el as any).link}
    </a>
  {/each}

  <!-- Grid Renderer — Phase 14 Feature 2 -->
  <GridRenderer
    {gridConfig}
    width={appState.width}
    height={appState.height}
    zoomLevel={scale}
    offsetX={0}
    offsetY={0}
  />

  <!-- Snap Guide Renderer — Phase 14 Feature 3 -->
  {#if snapConfig.guides && isDraggingForSnap && snapGuides.length > 0}
    <!-- @ts-ignore -->
    <SnapGuideRenderer
      guides={snapGuides}
      width={appState.width}
      height={appState.height}
      zoomLevel={scale}
      offsetX={0}
      offsetY={0}
    />
  {/if}

  <!-- A5: measurement overlays (rulers / dimensions / distances). All three
       render as one absolutely-positioned SVG. Outer {#if} reads sceneReady
       so mutateElement bumps trigger a rerender — otherwise resize/move
       don't update the dimension/distance labels since el.width reads
       happen inside non-reactive {@const} evaluation. -->
  {#if (sceneReady >= 0) && (measurementConfig.showRulers || ((measurementConfig.showDimensions || measurementConfig.showDistances) && getSelectedElements().length >= 1))}
    {@const zoomV = (appState.zoom as any).value ?? 1}
    {@const scX = ((appState.scrollX as any) ?? 0)}
    {@const scY = ((appState.scrollY as any) ?? 0)}
    {@const measSelected = getSelectedElements()}
    {@const showRulers = measurementConfig.showRulers}
    {@const showDims = measurementConfig.showDimensions && measSelected.length >= 1}
    {@const showDists = measurementConfig.showDistances && measSelected.length >= 2}
    <svg
      class="sveltedraw-measurement-overlay"
      width={appState.width}
      height={appState.height}
      viewBox="0 0 {appState.width} {appState.height}"
    >
      {#if showRulers}
        {@const RULER_SIZE = 20}
        {@const tickStep = Math.max(gridConfig.size, 1)}
        <!-- Ruler backgrounds -->
        <rect x="0" y="0" width={appState.width} height={RULER_SIZE}
              fill="rgba(255,255,255,0.92)" stroke="#d1d4da" />
        <rect x="0" y="0" width={RULER_SIZE} height={appState.height}
              fill="rgba(255,255,255,0.92)" stroke="#d1d4da" />
        <!-- Horizontal ticks -->
        {#each Array.from({ length: Math.ceil(appState.width / (tickStep * zoomV)) + 2 }) as _, i}
          {@const sceneX = Math.floor(-scX / tickStep) * tickStep + i * tickStep}
          {@const vx = (sceneX + scX) * zoomV}
          {#if vx >= RULER_SIZE && vx <= appState.width}
            <line x1={vx} y1={RULER_SIZE - 6} x2={vx} y2={RULER_SIZE}
                  stroke="#888" stroke-width="1" />
            <text x={vx + 2} y={12} font-size="9" fill="#666"
                  font-family="system-ui, -apple-system, sans-serif">
              {formatMeasurement(sceneX, measurementConfig.unit, 0)}
            </text>
          {/if}
        {/each}
        <!-- Vertical ticks -->
        {#each Array.from({ length: Math.ceil(appState.height / (tickStep * zoomV)) + 2 }) as _, i}
          {@const sceneY = Math.floor(-scY / tickStep) * tickStep + i * tickStep}
          {@const vy = (sceneY + scY) * zoomV}
          {#if vy >= RULER_SIZE && vy <= appState.height}
            <line x1={RULER_SIZE - 6} y1={vy} x2={RULER_SIZE} y2={vy}
                  stroke="#888" stroke-width="1" />
            <text x={2} y={vy + 10} font-size="9" fill="#666"
                  font-family="system-ui, -apple-system, sans-serif">
              {formatMeasurement(sceneY, measurementConfig.unit, 0)}
            </text>
          {/if}
        {/each}
      {/if}

      {#if showDims}
        {#each measSelected as el, i (el.id + ":" + sceneReady)}
          <text class="sveltedraw-measurement-dimension"
                x={(el.x + el.width / 2 + scX) * zoomV}
                y={(el.y + scY) * zoomV - 8}
                text-anchor="middle" font-size="11"
                font-family="system-ui, -apple-system, sans-serif"
                fill="#6965db" font-weight="600">
            {formatMeasurement(el.width, measurementConfig.unit, measurementConfig.precision)} × {formatMeasurement(el.height, measurementConfig.unit, measurementConfig.precision)}
          </text>
        {/each}
      {/if}

      {#if showDists}
        {#each measSelected.slice(1) as el, i (el.id + ":" + sceneReady)}
          {@const a = measSelected[i]}
          {@const b = el}
          {@const ax = (a.x + a.width / 2 + scX) * zoomV}
          {@const ay = (a.y + a.height / 2 + scY) * zoomV}
          {@const bx = (b.x + b.width / 2 + scX) * zoomV}
          {@const by = (b.y + b.height / 2 + scY) * zoomV}
          {@const d = Math.hypot(bx - ax, by - ay) / zoomV}
          <line class="sveltedraw-measurement-distance"
                x1={ax} y1={ay} x2={bx} y2={by}
                stroke="#6965db" stroke-width="1.5"
                stroke-dasharray="4 3" />
          <text x={(ax + bx) / 2} y={(ay + by) / 2 - 6}
                text-anchor="middle" font-size="11"
                font-family="system-ui, -apple-system, sans-serif"
                fill="#6965db" font-weight="600">
            d = {formatMeasurement(d, measurementConfig.unit, measurementConfig.precision)}
          </text>
        {/each}
      {/if}
    </svg>
  {/if}

  <!-- A2: laser pointer overlay. Polyline with per-segment opacity fading
       over LASER_FADE_MS. Pointer-events: none so it never swallows clicks.
       Void-read laserFrame so the RAF loop continuously refreshes opacity
       even when the pointer stops moving. -->
  {#if laserActive || laserTrail.length > 0}
    <svg
      class="sveltedraw-laser-overlay"
      data-laser-frame={laserFrame}
      width={appState.width}
      height={appState.height}
      viewBox="0 0 {appState.width} {appState.height}"
    >
      {#each laserTrail as p, i (p.t)}
        {#if i > 0}
          {@const prev = laserTrail[i - 1]}
          {@const age = performance.now() - p.t}
          {@const opacity = Math.max(0, 1 - age / LASER_FADE_MS)}
          <line
            x1={prev.x} y1={prev.y} x2={p.x} y2={p.y}
            stroke="#ff3b30"
            stroke-width="4"
            stroke-linecap="round"
            stroke-opacity={opacity}
          />
        {/if}
      {/each}
    </svg>
  {/if}

  <InteractiveCanvas
    appState={{
      width: appState.width,
      height: appState.height,
      viewModeEnabled: appState.viewModeEnabled,
      activeTool: appState.activeTool,
    }}
    {scale}
    handleCanvasRef={handleInteractiveCanvasRef}
    oncontextmenu={onContainerContextMenu}
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
         lives there. For rotated text, we rotate around the element's
         center; transform-origin is set to the center offset in px. -->
    {@const vpX = (textEditor.sceneX + ((appState.scrollX as any) ?? 0)) * zoomV}
    {@const vpY = (textEditor.sceneY + ((appState.scrollY as any) ?? 0)) * zoomV}
    {@const teW = textEditor.width ?? 0}
    {@const teH = textEditor.height ?? 0}
    {@const rotOrigin = teW && teH
      ? `${(teW * zoomV) / 2}px ${(teH * zoomV) / 2}px`
      : `0 0`}
    <textarea
      bind:this={textEditorEl}
      value={textEditor.initialValue}
      class="sveltedraw-text-editor"
      style="position: absolute;
             left: {vpX}px;
             top: {vpY}px;
             min-width: {teW ? teW * zoomV : 40}px;
             min-height: {(teH || textEditor.fontSize * 1.2) * zoomV}px;
             font: {textEditor.fontSize * zoomV}px {getFontFamilyString({ fontFamily: textEditor.fontFamily })};
             line-height: 1.2;
             background: transparent;
             border: 1px dashed #6965db;
             outline: none;
             resize: none;
             padding: 0;
             margin: 0;
             overflow: hidden;
             white-space: pre;
             color: {textEditor.strokeColor};
             transform: rotate({textEditor.angle}rad);
             transform-origin: {rotOrigin};
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
  <!-- Right-click context menu. Absolute-positioned at the click point.
       Outside-click / Escape closes via a single-use window listener. -->
  {#if contextMenu}
    <div
      class="sveltedraw-ctx-menu"
      style="position: absolute;
             left: {contextMenu.vpX}px;
             top: {contextMenu.vpY}px;
             z-index: 100;"
      role="menu"
      tabindex="-1"
      onpointerdown={(e) => e.stopPropagation()}
    >
      {#if contextMenu.hasSelection}
        <button type="button" class="ctx-item" onclick={() => { copySelectedToBuffer(); closeContextMenu(); }}>{t("labels.copy")}</button>
        <button type="button" class="ctx-item" onclick={() => {
          copySelectedToBuffer();
          deleteSelected();
          closeContextMenu();
        }}>{t("labels.cut")}</button>
      {/if}
      <button type="button" class="ctx-item" disabled={clipboardBuffer.length === 0} onclick={() => {
        if (contextMenu) {
          const { x, y } = toSceneCoords(
            (contextMenu.vpX + (appState.offsetLeft as number)),
            (contextMenu.vpY + (appState.offsetTop as number)),
          );
          pasteFromBuffer(x, y);
        }
        closeContextMenu();
      }}>{t("labels.paste")}</button>
      {#if contextMenu.hasSelection}
        <div class="ctx-sep"></div>
        {#if getSelectedElements().length === 1}
          <button type="button" class="ctx-item" onclick={() => { openLinkDialog(); closeContextMenu(); }}>
            {getSelectedElements()[0]?.link ? "Edit link" : "Add link"}
          </button>
        {/if}
        <button type="button" class="ctx-item" onclick={() => { duplicateSelected(); closeContextMenu(); }}>{t("labels.duplicateSelection")}</button>
        <button type="button" class="ctx-item" onclick={() => { groupSelected(); closeContextMenu(); }}>{t("labels.group")}</button>
        <button type="button" class="ctx-item" onclick={() => { ungroupSelected(); closeContextMenu(); }}>{t("labels.ungroup")}</button>
        <button type="button" class="ctx-item" onclick={() => { saveSelectionToLibrary(); closeContextMenu(); }}>{t("toolBar.library")}</button>
        <button type="button" class="ctx-item" onclick={() => { reorderSelected("forward"); closeContextMenu(); }}>{t("labels.bringForward")}</button>
        <button type="button" class="ctx-item" onclick={() => { reorderSelected("front"); closeContextMenu(); }}>{t("labels.bringToFront")}</button>
        <button type="button" class="ctx-item" onclick={() => { reorderSelected("backward"); closeContextMenu(); }}>{t("labels.sendBackward")}</button>
        <button type="button" class="ctx-item" onclick={() => { reorderSelected("back"); closeContextMenu(); }}>{t("labels.sendToBack")}</button>
        <div class="ctx-sep"></div>
        <button type="button" class="ctx-item ctx-item--danger" onclick={() => { deleteSelected(); closeContextMenu(); }}>{t("labels.delete")}</button>
      {/if}
    </div>
  {/if}

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

  <!-- Linear handle overlay: for each selected line/arrow, draw a
       vertex dot at every points[i] and a smaller midpoint dot
       between consecutive points. The dots are visual only — the
       actual hit-testing happens in hitResizeHandle(). Picker dot
       on vertex = grab to move; dot on midpoint = grab to bend. -->
  {#if selectedLinearElements.length > 0}
    {@const zoomV = (appState.zoom as any).value || 1}
    {@const sX = ((appState as any).scrollX ?? 0)}
    {@const sY = ((appState as any).scrollY ?? 0)}
    {@const oL = (appState.offsetLeft as number) ?? 0}
    {@const oT = (appState.offsetTop as number) ?? 0}
    {#each selectedLinearElements as el (el.id)}
      {#if true}
        {@const pts = el.points ?? []}
        {#each pts as pt, i}
          {@const vpX = (el.x + pt[0] + sX) * zoomV + oL - (appState.offsetLeft as number)}
          {@const vpY = (el.y + pt[1] + sY) * zoomV + oT - (appState.offsetTop as number)}
          <div
            class="sveltedraw-line-handle sveltedraw-line-handle--vertex"
            style="left: {vpX - 5}px; top: {vpY - 5}px;"
            aria-hidden="true"
          ></div>
        {/each}
        {#each pts.slice(0, -1) as _pt, i}
          {@const ax = pts[i][0]}
          {@const ay = pts[i][1]}
          {@const bx = pts[i + 1][0]}
          {@const by = pts[i + 1][1]}
          {@const mxVp = (el.x + (ax + bx) / 2 + sX) * zoomV + oL - (appState.offsetLeft as number)}
          {@const myVp = (el.y + (ay + by) / 2 + sY) * zoomV + oT - (appState.offsetTop as number)}
          <div
            class="sveltedraw-line-handle sveltedraw-line-handle--mid"
            style="left: {mxVp - 4}px; top: {myVp - 4}px;"
            aria-hidden="true"
          ></div>
        {/each}
        <!-- Rotation handle: top-center of the element's BBOX above it.
             Same math as getRotationHandlePos — kept as overlay dot so
             the user can see the grab target. -->
        {@const cx = el.x + el.width / 2}
        {@const cy = el.y + el.height / 2}
        {@const ROT_GAP = 16}
        {@const rLocalY = el.y - ROT_GAP / zoomV}
        {@const rdx = cx - cx}
        {@const rdy = rLocalY - cy}
        {@const ang = el.angle || 0}
        {@const rotSceneX = cx + rdx * Math.cos(ang) - rdy * Math.sin(ang)}
        {@const rotSceneY = cy + rdx * Math.sin(ang) + rdy * Math.cos(ang)}
        {@const rotVpX = (rotSceneX + sX) * zoomV + oL - (appState.offsetLeft as number)}
        {@const rotVpY = (rotSceneY + sY) * zoomV + oT - (appState.offsetTop as number)}
        <div
          class="sveltedraw-line-handle sveltedraw-rotate-handle"
          style="left: {rotVpX - 7}px; top: {rotVpY - 7}px;"
          aria-hidden="true"
        ></div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  /* A1: element-link dialog modal. */
  .sveltedraw-link-overlay {
    position: fixed;
    inset: 0;
    background: rgba(12, 13, 19, 0.55);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sveltedraw-link-modal {
    background: #fff;
    border-radius: 8px;
    padding: 16px 18px;
    width: min(480px, 92vw);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  }
  :global(.excalidraw.theme--dark) .sveltedraw-link-modal {
    background: #1a1a1e;
    color: #e5e7ea;
  }

  /* A1: link chip — shown over a selected linked element so the user can
     jump to the URL without opening the dialog. */
  .sveltedraw-link-chip {
    position: absolute;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: #1e1e1e;
    color: #fff;
    border-radius: 14px;
    font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    text-decoration: none;
    white-space: nowrap;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    z-index: 60;
    cursor: pointer;
  }
  .sveltedraw-link-chip:hover { background: #2b2b2b; }
  .sveltedraw-link-chip:focus-visible { outline: 2px solid #6965db; }

  /* A2: laser overlay pinned over the canvas. pointer-events: none so the
     trail never blocks clicks on the underlying canvas. Z-index above the
     canvas layer but below side panels. */
  .sveltedraw-laser-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 30;
  }
  :global(.sveltedraw--laser) { cursor: crosshair; }
  :global(.sveltedraw--eraser) { cursor: crosshair; }

  /* D1: dark-mode overrides for orphan upstream components whose SCSS
     sidecars don't ship with theme--dark rules. Targets visible white-on-
     white patterns: dialogs, buttons, color pickers, dropdowns, menus. */
  :global(.excalidraw.theme--dark .excalidraw-button) {
    background: #2e2e36;
    color: #e5e7ea;
    border-color: #363636;
  }
  :global(.excalidraw.theme--dark .excalidraw-button:hover) {
    background: #363644;
  }
  :global(.excalidraw.theme--dark .excalidraw-button.selected) {
    background: #6965db;
    color: #fff;
  }
  :global(.excalidraw.theme--dark .Dialog),
  :global(.excalidraw.theme--dark .Dialog__content) {
    background: #232329;
    color: #e5e7ea;
    border-color: #363636;
  }
  :global(.excalidraw.theme--dark .Dialog__title) { color: #e5e7ea; }
  :global(.excalidraw.theme--dark .context-menu),
  :global(.excalidraw.theme--dark .dropdown-menu-container) {
    background: #232329;
    color: #e5e7ea;
    border-color: #363636;
  }
  :global(.excalidraw.theme--dark .context-menu-option),
  :global(.excalidraw.theme--dark .dropdown-menu-item) {
    color: #e5e7ea;
  }
  :global(.excalidraw.theme--dark .context-menu-option:hover),
  :global(.excalidraw.theme--dark .dropdown-menu-item:hover),
  :global(.excalidraw.theme--dark .dropdown-menu-item[data-highlighted]) {
    background: #2e2e36;
  }
  :global(.excalidraw.theme--dark .color-picker-container),
  :global(.excalidraw.theme--dark .color-picker-popover-content),
  :global(.excalidraw.theme--dark .color-picker-content),
  :global(.excalidraw.theme--dark .Picker),
  :global(.excalidraw.theme--dark .picker-heading),
  :global(.excalidraw.theme--dark .shade-list),
  :global(.excalidraw.theme--dark .top-picks) {
    background: #232329;
    color: #e5e7ea;
    border-color: #363636;
  }
  :global(.excalidraw.theme--dark .color-input-container),
  :global(.excalidraw.theme--dark .color-input) {
    background: #2e2e36;
    color: #e5e7ea;
    border-color: #363636;
  }
  :global(.excalidraw.theme--dark .active-confirm-dialog) {
    background: #232329;
    color: #e5e7ea;
  }

  /* A5: measurement overlay — rulers, dimensions, distances. */
  .sveltedraw-measurement-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 25;
  }

  .excalidraw-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    /* Disable the browser's native pinch-zoom and scroll-via-touch
       so our own PointerEvent handlers own the gesture. Without this,
       iOS/Android hijacks 2-finger gestures. */
    touch-action: none;
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
    width: 76px;
    flex-shrink: 0;
    color: #5a5d66;
    font-weight: 500;
    white-space: nowrap;
  }
  .sveltedraw-style-panel .sp-swatches {
    display: flex;
    gap: 4px;
  }
  /* A9: slider variant for line-height + rotation controls. */
  .sveltedraw-style-panel .sp-slider {
    flex: 1;
    align-items: center;
  }
  .sveltedraw-style-panel .sp-slider input[type="range"] {
    flex: 1;
    min-width: 80px;
  }
  .sveltedraw-style-panel .sp-slider-value {
    min-width: 42px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: #6965db;
    font-weight: 600;
    font-size: 11px;
  }
  .sveltedraw-style-panel .sp-picker {
    flex: 1;
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
  .sveltedraw-style-panel .sp-icon-btn {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    cursor: pointer;
    color: #1e1e1e;
  }
  .sveltedraw-style-panel .sp-icon-btn.active {
    border-color: #6965db;
    background: #eeedfa;
  }
  :global(.sveltedraw-style-panel .sp-icon-btn svg) {
    width: 16px;
    height: 16px;
  }

  .sveltedraw-ctx-menu {
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    min-width: 160px;
    padding: 4px 0;
    font-size: 13px;
  }
  .sveltedraw-ctx-menu .ctx-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: #1e1e1e;
  }
  .sveltedraw-ctx-menu .ctx-item:hover:not([disabled]) {
    background: #eeedfa;
  }
  .sveltedraw-ctx-menu .ctx-item[disabled] {
    color: #a0a3a9;
    cursor: not-allowed;
  }
  .sveltedraw-ctx-menu .ctx-item--danger {
    color: #e03131;
  }
  .sveltedraw-toolbox {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 10px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    z-index: 50;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-toolbox {
    background: #232329;
    border-color: #363636;
  }
  .sveltedraw-toolbox .tb-sep {
    width: 1px;
    height: 22px;
    background: #e5e7ea;
    margin: 0 4px;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-toolbox .tb-sep {
    background: #363636;
  }
  .sveltedraw-toolbox .sveltedraw-tool-btn {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    color: #1e1e1e;
  }
  .sveltedraw-toolbox .sveltedraw-tool-btn:hover {
    background: #f1f3f5;
  }
  .sveltedraw-toolbox .sveltedraw-tool-btn.active {
    background: #eeedfa;
    border-color: #6965db;
    color: #5349d6;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-toolbox .sveltedraw-tool-btn {
    color: #e5e7ea;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-toolbox .sveltedraw-tool-btn:hover {
    background: #2e2e36;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-toolbox .sveltedraw-tool-btn.active {
    background: #3b3a66;
    border-color: #6965db;
    color: #b5b2ee;
  }
  :global(.sveltedraw-toolbox .sveltedraw-tool-btn svg) {
    width: 20px;
    height: 20px;
  }

  .sveltedraw-zoom-ctrls {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    align-items: stretch;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    z-index: 50;
    overflow: hidden;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-zoom-ctrls {
    background: #232329;
    border-color: #363636;
  }
  .sveltedraw-zoom-ctrls .sveltedraw-zoom-btn {
    width: 32px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: none;
    border-left: 1px solid #e5e7ea;
    cursor: pointer;
    font-size: 16px;
    color: #1e1e1e;
    font-variant-numeric: tabular-nums;
  }
  .sveltedraw-zoom-ctrls .sveltedraw-zoom-btn:first-child {
    border-left: none;
  }
  .sveltedraw-zoom-ctrls .sveltedraw-zoom-btn:hover {
    background: #f1f3f5;
  }
  .sveltedraw-zoom-ctrls .sveltedraw-zoom-reset {
    min-width: 52px;
    font-size: 12px;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-zoom-ctrls .sveltedraw-zoom-btn {
    color: #e5e7ea;
    border-left-color: #363636;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-zoom-ctrls .sveltedraw-zoom-btn:hover {
    background: #2e2e36;
  }

  .sveltedraw-main-menu-trigger {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    cursor: pointer;
    color: #1e1e1e;
    z-index: 50;
  }
  .sveltedraw-main-menu-trigger:hover {
    background: #f1f3f5;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-main-menu-trigger {
    background: #232329;
    border-color: #363636;
    color: #e5e7ea;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-main-menu-trigger:hover {
    background: #2e2e36;
  }
  :global(.sveltedraw-main-menu-trigger svg) {
    width: 18px;
    height: 18px;
  }

  .sveltedraw-main-menu {
    position: absolute;
    top: 54px;
    left: 12px;
    min-width: 200px;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    padding: 4px 0;
    z-index: 60;
    font-size: 13px;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-main-menu {
    background: #232329;
    border-color: #363636;
    color: #e5e7ea;
  }
  .sveltedraw-main-menu .mm-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 7px 14px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: inherit;
    font-size: 13px;
  }
  .sveltedraw-main-menu .mm-item:hover {
    background: #eeedfa;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-main-menu .mm-item:hover {
    background: #3b3a66;
  }
  .sveltedraw-main-menu .mm-item--danger {
    color: #e03131;
  }
  .sveltedraw-main-menu .mm-sep {
    height: 1px;
    background: #e5e7ea;
    margin: 4px 0;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-main-menu .mm-sep {
    background: #363636;
  }

  .sveltedraw-help-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .sveltedraw-help-card {
    width: min(680px, 92vw);
    max-height: 85vh;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-size: 13px;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-help-card {
    background: #232329;
    color: #e5e7ea;
  }
  .sveltedraw-help-card .hd-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid #e5e7ea;
    font-size: 16px;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-help-card .hd-header {
    border-bottom-color: #363636;
  }
  .sveltedraw-help-card .hd-close {
    background: transparent;
    border: none;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    color: inherit;
  }
  .sveltedraw-help-card .hd-body {
    padding: 16px 20px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px 24px;
  }
  .sveltedraw-help-card .hd-section h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
  }
  .sveltedraw-help-card .hd-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 0;
    color: #1e1e1e;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-help-card .hd-row {
    color: #e5e7ea;
  }
  .sveltedraw-help-card .hd-row span {
    margin-left: auto;
    color: #6b7280;
  }
  :global(.sveltedraw-help-card kbd),
  :global(.sveltedraw-hint kbd),
  :global(.sveltedraw-welcome kbd) {
    display: inline-block;
    padding: 1px 6px;
    font: 11px ui-monospace, Menlo, Consolas, monospace;
    background: #f1f3f5;
    border: 1px solid #d1d4da;
    border-bottom-width: 2px;
    border-radius: 3px;
    color: #1e1e1e;
  }
  :global(.excalidraw.theme--dark .sveltedraw-help-card kbd),
  :global(.excalidraw.theme--dark .sveltedraw-hint kbd),
  :global(.excalidraw.theme--dark .sveltedraw-welcome kbd) {
    background: #2e2e36;
    border-color: #464651;
    color: #e5e7ea;
  }

  .sveltedraw-welcome {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
    z-index: 5;
  }
  .sveltedraw-welcome .sw-title {
    font-size: 32px;
    font-weight: 700;
    color: #c5c7cc;
    margin-bottom: 12px;
    font-family: Excalifont, Xiaolai, sans-serif;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-welcome .sw-title {
    color: #4a4a52;
  }
  .sveltedraw-welcome .sw-hint {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 8px;
  }
  .sveltedraw-welcome .sw-hint-alt {
    color: #9ca3af;
    font-size: 12px;
    pointer-events: auto;
  }
  .sveltedraw-welcome .sw-link {
    background: transparent;
    border: none;
    color: #6965db;
    cursor: pointer;
    text-decoration: underline;
    font-size: 12px;
    padding: 0;
  }

  .sveltedraw-hint {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 14px;
    background: rgba(30, 30, 30, 0.85);
    color: #fff;
    border-radius: 16px;
    font-size: 12px;
    pointer-events: none;
    z-index: 30;
  }

  .sveltedraw-line-handle {
    position: absolute;
    pointer-events: none;
    z-index: 15;
    border-radius: 50%;
    background: #fff;
    border: 1.5px solid #6965db;
    box-sizing: border-box;
  }
  .sveltedraw-line-handle--vertex {
    width: 10px;
    height: 10px;
  }
  .sveltedraw-line-handle--mid {
    width: 8px;
    height: 8px;
    border-color: #a6a0f0;
    opacity: 0.85;
  }
  .sveltedraw-rotate-handle {
    width: 14px;
    height: 14px;
    background: #fff;
    border: 1.5px solid #6965db;
  }

  .sveltedraw-utility-bar {
    position: absolute;
    top: 64px;
    right: 12px;
    display: flex;
    gap: 6px;
    z-index: 50;
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: calc(100vw - 24px);
  }
  .sveltedraw-utility-bar .sveltedraw-util-btn {
    height: 30px;
    padding: 0 10px;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 6px;
    cursor: pointer;
    color: #1e1e1e;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .sveltedraw-utility-bar .sveltedraw-util-btn:hover {
    background: #f1f3f5;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-utility-bar .sveltedraw-util-btn {
    background: #232329;
    border-color: #363636;
    color: #e5e7ea;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-utility-bar .sveltedraw-util-btn:hover {
    background: #2e2e36;
  }
  .sveltedraw-utility-bar .sveltedraw-lang-select {
    min-width: 120px;
  }
  .sveltedraw-utility-bar .sveltedraw-util-btn.active {
    background: #eeedfa;
    border-color: #6965db;
  }

  .sveltedraw-library-panel {
    position: absolute;
    bottom: 16px;
    left: 16px;
    width: 260px;
    max-height: 60vh;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    z-index: 40;
    font-size: 13px;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-library-panel {
    background: #232329;
    border-color: #363636;
    color: #e5e7ea;
  }
  .sveltedraw-library-panel .lib-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #e5e7ea;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-library-panel .lib-header {
    border-bottom-color: #363636;
  }
  .sveltedraw-library-panel .lib-close {
    background: transparent;
    border: none;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    padding: 0 4px;
  }
  .sveltedraw-library-panel .lib-empty {
    padding: 16px 12px;
    color: #6b7280;
    font-size: 12px;
  }
  .sveltedraw-library-panel .lib-items {
    overflow-y: auto;
    padding: 4px;
  }
  .sveltedraw-library-panel .lib-item {
    display: flex;
    align-items: stretch;
    gap: 2px;
    margin-bottom: 2px;
  }
  .sveltedraw-library-panel .lib-item-insert {
    flex: 1;
    text-align: left;
    padding: 6px 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    color: inherit;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sveltedraw-library-panel .lib-item-insert:hover {
    background: #f1f3f5;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-library-panel .lib-item-insert:hover {
    background: #2e2e36;
  }
  .sveltedraw-library-panel .lib-item-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sveltedraw-library-panel .lib-item-count {
    color: #9ca3af;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    margin-left: 8px;
  }
  .sveltedraw-library-panel .lib-item-del {
    width: 26px;
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  }
  .sveltedraw-library-panel .lib-item-del:hover {
    color: #e03131;
    background: #fff5f5;
    border-radius: 4px;
  }

  .sveltedraw-ctx-menu .ctx-sep {
    height: 1px;
    background: #e5e7ea;
    margin: 4px 0;
  }

  .sveltedraw-connector-panel {
    position: absolute;
    bottom: 16px;
    right: 20px;
    width: 280px;
    max-height: 50vh;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    z-index: 40;
    overflow-y: auto;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-connector-panel {
    background: #232329;
    border-color: #363636;
  }

  .sveltedraw-alignment-panel {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 320px;
    max-height: 60vh;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    z-index: 40;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-alignment-panel {
    background: #232329;
    border-color: #363636;
  }

  .sveltedraw-measurement-panel {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 280px;
    max-height: 60vh;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    z-index: 40;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-measurement-panel {
    background: #232329;
    border-color: #363636;
  }

  .sveltedraw-autolayout-panel {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 280px;
    max-height: 70vh;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    z-index: 40;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-autolayout-panel {
    background: #232329;
    border-color: #363636;
  }

  .sveltedraw-grid-panel {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 280px;
    max-height: 60vh;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    z-index: 40;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-grid-panel {
    background: #232329;
    border-color: #363636;
  }

  .sveltedraw-layer-panel {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 280px;
    max-height: 70vh;
    overflow-y: auto;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    z-index: 40;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-layer-panel {
    background: #232329;
    border-color: #363636;
  }

  .sveltedraw-history-panel {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 280px;
    max-height: 70vh;
    overflow-y: auto;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    z-index: 40;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-history-panel {
    background: #232329;
    border-color: #363636;
  }

  .sveltedraw-shape-library-panel {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 280px;
    max-height: 70vh;
    overflow-y: auto;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    z-index: 40;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-shape-library-panel {
    background: #232329;
    border-color: #363636;
  }
</style>

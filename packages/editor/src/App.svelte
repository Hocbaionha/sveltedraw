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
  //  - SveltedrawImperativeAPI (`onSveltedrawAPI` callback) → batch 6.
  //  - textWysiwyg.ts port → batch 7.

  // @ts-ignore
  // only exists in the editor package, not sveltedraw-app.
  import type { EditorInterface } from "@sveltedraw/common";
  import type { LayerUIAppStateLike } from "./components/LayerUI.svelte";

  /**
   * Minimal AppState shape needed by LayerUI + canvas wrappers.
   * Original `AppState` has ~80 fields; the runtime value comes from
   * `getDefaultAppState()` (full shape) so passing it to original helpers
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
  // @ts-ignore
  import { getDefaultAppState } from "@sveltedraw/engine/appState";
  // @ts-ignore
  import { Scene } from "@sveltedraw/element";
  // @ts-ignore
  import { Renderer } from "@sveltedraw/engine/scene/Renderer";
  // @ts-ignore
  import { renderStaticScene } from "@sveltedraw/engine/renderer/staticScene";
  // @ts-ignore
  import { renderNewElementScene } from "@sveltedraw/engine/renderer/renderNewElementScene";
  // @ts-ignore
  import { renderInteractiveScene } from "@sveltedraw/engine/renderer/interactiveScene";
  // @ts-ignore
  import { AnimationController } from "@sveltedraw/engine/renderer/animation";
  // Inline to avoid pulling @sveltedraw/engine/components/canvases/InteractiveCanvas.tsx
  // (which imports from "react"). Original value confirmed identical.
  const INTERACTIVE_SCENE_ANIMATION_KEY = "animateInteractiveScene";
  // @ts-ignore
  import rough from "roughjs/bin/rough";
  // @ts-ignore
  import { Fonts } from "@sveltedraw/engine/fonts/Fonts";
  // @ts-ignore
  // prettier-ignore
  import { getFormFactor, createUserAgentDescriptor, MQ_RIGHT_SIDEBAR_MIN_WIDTH, supportsResizeObserver, POINTER_EVENTS, randomId, viewportCoordsToSceneCoords, DEFAULT_ELEMENT_PROPS, DEFAULT_FONT_FAMILY, FONT_FAMILY } from "@sveltedraw/common";
  // @ts-ignore
  import { newElement, newLinearElement, newArrowElement, newFreeDrawElement, newTextElement, newImageElement, hitElementItself, duplicateElements, deepCopyElement, moveOneLeft, moveOneRight, moveAllLeft, moveAllRight } from "@sveltedraw/element";
  // @ts-ignore
  import { updateBoundElements } from "@sveltedraw/element";
  // @ts-ignore
  import { DEFAULT_FONT_SIZE, getFontFamilyString } from "@sveltedraw/common";
  // @ts-ignore
  import { exportToBlob, exportToSvg } from "@sveltedraw/utils/export";
  // @ts-ignore
  // prettier-ignore
  import { DEFAULT_COLLISION_THRESHOLD, ELEMENT_TRANSLATE_AMOUNT, ELEMENT_SHIFT_TRANSLATE_AMOUNT, ZOOM_STEP, STROKE_WIDTH, COLOR_PALETTE, ROUGHNESS } from "@sveltedraw/common";
  // @ts-ignore
  import { getStateForZoom } from "@sveltedraw/engine/scene/zoom";
  // @ts-ignore
  import { getNormalizedZoom } from "@sveltedraw/engine/scene/normalize";
  // @ts-ignore
  import { pointFrom } from "@sveltedraw/math";

  import {
    EDITOR_STORE_KEY,
    APP_STORE_KEY,
    EDITOR_INTERFACE_KEY,
    EXCAL_ID_KEY,
    createEditorStore,
    createAppStore,
    createTunnelsContext,
    TUNNELS_KEY,
    createPersistence,
  } from "./state/index.js";
  import {
    t,
    setLanguage,
    getCurrentLangCode,
    getPreferredLanguage,
    availableLanguages,
  } from "./state/i18n.svelte.js";
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
  import ElementLinkDialog from "./components/ElementLinkDialog.svelte";
  import GridRenderer from "./components/GridRenderer.svelte";
  import SnapGuideRenderer from "./components/SnapGuideRenderer.svelte";
  import MeasurementOverlay from "./components/MeasurementOverlay.svelte";
  import LinkChip from "./components/LinkChip.svelte";
  import ShadowPresetsRow from "./components/ShadowPresetsRow.svelte";
  import ActionsRow from "./components/ActionsRow.svelte";
  import StyleSliderRow from "./components/StyleSliderRow.svelte";
  import PresetIconRow from "./components/PresetIconRow.svelte";
  import FormatRow from "./components/FormatRow.svelte";
  import EdgesRow from "./components/EdgesRow.svelte";
  import ColorRow from "./components/ColorRow.svelte";
  import PresentationMode from "./components/PresentationMode.svelte";
  import HelpDialog from "./components/HelpDialog.svelte";
  import MainMenu from "./components/MainMenu.svelte";
  import CanvasContextMenu from "./components/CanvasContextMenu.svelte";
  import CanvasHintOverlay from "./components/CanvasHintOverlay.svelte";
  import UtilityBar from "./components/UtilityBar.svelte";
  import ZoomControls from "./components/ZoomControls.svelte";
  import FloatingLibraryPanel from "./components/FloatingLibraryPanel.svelte";
  import LiveCollaborationTrigger from "./components/LiveCollaborationTrigger.svelte";
  import CollabIdentityDialog, {
    type IdentityResult,
  } from "./components/CollabIdentityDialog.svelte";
  import CollabCursors from "./components/CollabCursors.svelte";
  import Toast from "./components/Toast.svelte";
  import {
    createCollabStore,
    COLLAB_STORE_KEY,
    type CollabStore,
  } from "./collab/store.svelte.js";
  import type { HistoryState } from "./history/types.js";
  import { createHistoryStore } from "./history/store.js";
  import { triggerDownload } from "./data/download.js";
  import {
    saveAsSveltedrawFile as saveSveltedrawFileImpl,
    openSveltedrawFilePicker as openSveltedrawFilePickerImpl,
  } from "./data/sveltedrawFile.js";
  import { createImperativeAPI } from "./api/ImperativeAPI.svelte.js";
  import { SVELTEDRAW_API_KEY, type SveltedrawAPI } from "./api/types.js";
  import { PluginRegistry, PLUGIN_REGISTRY_KEY } from "./plugins/registry.svelte.js";
  import { recentFilesPlugin, RECENT_FILES_STORE_KEY } from "./plugins/builtin/recent-files/index.js";
  import { SETTINGS_STORE_KEY } from "./plugins/builtin/settings/index.js";
  import { HELP_STORE_KEY } from "./plugins/builtin/help/index.js";
  import { TEMPLATES_STORE_KEY } from "./plugins/builtin/templates/index.js";
  import {
    HISTORY_PANEL_STORE_KEY,
    HISTORY_UI_BRIDGE_KEY,
    type HistoryUIBridge,
  } from "./plugins/builtin/history-panel/index.js";
  import {
    ALIGNMENT_BRIDGE_KEY,
    type AlignmentBridge,
  } from "./plugins/builtin/alignment-panel/index.js";
  import {
    AUTOLAYOUT_BRIDGE_KEY,
    AUTOLAYOUT_PANEL_STORE_KEY,
    type AutoLayoutBridge,
  } from "./plugins/builtin/autolayout-panel/index.js";
  import {
    MEASUREMENT_BRIDGE_KEY,
    MEASUREMENT_PANEL_STORE_KEY,
    type MeasurementBridge,
  } from "./plugins/builtin/measurement-panel/index.js";
  import {
    GRID_BRIDGE_KEY,
    type GridBridge,
  } from "./plugins/builtin/grid-panel/index.js";
  import {
    LAYER_BRIDGE_KEY,
    type LayerBridge,
  } from "./plugins/builtin/layer-panel/index.js";
  import {
    SHAPE_LIBRARY_BRIDGE_KEY,
    type ShapeLibraryBridge,
  } from "./plugins/builtin/shape-library-panel/index.js";
  import {
    CONNECTOR_BRIDGE_KEY,
    CONNECTOR_STORE_KEY,
    type ConnectorBridge,
    type ConnectorStore,
  } from "./plugins/builtin/connector-tool/index.js";
  import {
    LASER_BRIDGE_KEY,
    LASER_STORE_KEY,
    LASER_REACTIVE_KEY,
    type LaserBridge,
    type LaserReactive,
    type LaserStore,
  } from "./plugins/builtin/laser-pointer/index.js";
  import {
    EXPORT_BRIDGE_KEY,
    EXPORT_STORE_KEY,
    type ExportBridge,
    type ExportPanelStore,
  } from "./plugins/builtin/export-panel/index.js";
  import { builtinPlugins } from "./plugins/builtin/index.js";
  import type { SveltedrawPlugin } from "./plugins/types.js";
  import { installSveltedrawProbe } from "./dev/probe.js";
  import { handleExport as handleExportImpl } from "./export/handleExport.js";
  import { createLibraryHandlers } from "./library/handlers.js";
  import { createPresentationHandlers } from "./presentation/handlers.js";
  import { createSceneInserts } from "./data/sceneInserts.js";
  import { installTouchGestures } from "./engine/touchGestures.js";
  import { createAlignmentHandlers } from "./alignment/handlers.js";
  import { createLayerHandlers } from "./layers/handlers.js";
  import type { LibraryComponent, LibraryCategory } from "./library/types.js";
  import { getDefaultLibraryConfig, createLibraryComponent, getCategoryLabel } from "./library/types.js";
  import type { PresentationSlide, PresentationConfig } from "./presentation/types.js";
  import { getDefaultPresentationConfig, createPresentationSlide } from "./presentation/types.js";
  import type { ExportOptions } from "./export/types.js";
  import type { Template } from "./templates/index.js";
  // Connector tool creates real Sveltedraw arrow elements with
  // startBinding/endBinding — the custom Connector type (Phase 13)
  // was never rendered. Arrows get rendering + export + hit-testing
  // for free from the original pipeline.
  import type { AlignmentType, DistributionType, AlignmentGuide } from "./alignment/types.js";
  import { calculateAlignmentGuides, alignElements, distributeElements } from "./alignment/types.js";
  import type { MeasurementConfig } from "./measurements/types.js";
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
    plugins = [],
    onmount,
  }: {
    viewModeEnabled?: boolean;
    zenModeEnabled?: boolean;
    gridModeEnabled?: boolean;
    objectsSnapModeEnabled?: boolean;
    theme?: "light" | "dark";
    name?: string;
    plugins?: SveltedrawPlugin[];
    onmount?: (api: SveltedrawAPI) => void;
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

  // Derive the frames Map from scene on demand. Historical note: `frames`
  // was declared as a $state Map populated imperatively, but no call site
  // ever actually populated it — `createFrameAtCenter` only mutates scene
  // elements, not this Map. That meant `getFrames().size === 0` forever
  // and the presentation handler (which reads this to slice the scene
  // into per-frame slides) always fell through to its "whole scene as
  // one slide" branch. Deriving from scene fixes that without requiring
  // every mutation path to remember to sync.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deriveFramesFromScene = (): Map<string, Frame> => {
    const map = new Map<string, Frame>();
    const sc = scene;
    if (!sc) return map;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const els = sc.getNonDeletedElements() as any[];
    for (const el of els) {
      if (el.type !== "frame") continue;
      map.set(el.id, {
        id: el.id,
        name: el.name ?? "Frame",
        elementIds: new Set<string>(),
        x: el.x, y: el.y, w: el.width, h: el.height,
      });
    }
    // Second pass: attach each non-frame element to its frame (if any).
    for (const el of els) {
      if (el.type === "frame") continue;
      if (!el.frameId) continue;
      const f = map.get(el.frameId);
      if (f) f.elementIds.add(el.id);
    }
    return map;
  };

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
  // Use original `randomId` (nanoid in prod, deterministic in test) for parity
  // with the React side — `App.tsx` does `this.id = nanoid()`.
  setContext(EXCAL_ID_KEY, randomId());

  // ── ImperativeAPI + PluginRegistry ─────────────────────────────────────
  // contextSymbols mirrors setContext for Symbol-keyed stores so that
  // plugins can reach any store via api.getContext(KEY) without depending
  // on the Svelte component tree.
  const contextSymbols = new Map<symbol, unknown>();

  // Helper: register in both Svelte context and the symbol map.
  const registerCtx = <T>(key: symbol, value: T): T => {
    setContext(key, value);
    contextSymbols.set(key, value);
    return value;
  };
  const contextResolver = <T>(key: symbol): T => contextSymbols.get(key) as T;
  // Bridge for plugin getStore: prefer registry-published stores, fall
  // back to Svelte context keys (e.g. SVELTEDRAW_API_KEY). Returns
  // undefined if neither layer has the key.
  const pluginGetStoreBridge = <T>(key: symbol): T | undefined => {
    const v = contextSymbols.get(key);
    return v === undefined ? undefined : (v as T);
  };

  const imperativeAPI = createImperativeAPI(
    {
      getScene: () => scene,
      getAppState: () => appState,
      patchAppState: (patch) => {
        for (const [k, v] of Object.entries(patch)) {
          (appState as Record<string, unknown>)[k] = v;
        }
      },
      setActiveTool: (tool) => setActiveTool(tool),
      pushHistory: () => historyStore?.pushHistory(),
      bumpSceneRepaint: () => bumpSceneRepaint(),
      toSceneCoords: (clientX, clientY) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return viewportCoordsToSceneCoords({ clientX, clientY }, appState as any);
      },
    },
    contextResolver,
  );
  registerCtx(SVELTEDRAW_API_KEY, imperativeAPI);

  // ── Collab store (Phase 17) ─────────────────────────────────────────
  // Lifecycle: created with the editor, never destroyed (its `leaveRoom`
  // is idempotent and called from onMount cleanup). UI components read
  // it via getContext(COLLAB_STORE_KEY); honest-tests reach it through
  // the probe surface below. The store is dormant until `joinRoom` is
  // called — no socket, no observers — so creating it eagerly is free.
  const collabStore: CollabStore = createCollabStore(imperativeAPI);
  registerCtx(COLLAB_STORE_KEY, collabStore);

  const pluginRegistry = new PluginRegistry();
  registerCtx(PLUGIN_REGISTRY_KEY, pluginRegistry);

  // Stable-sorted view of canvas overlays. Re-derives only when the
  // registry array mutates; the sort is by ascending zIndex so plugins
  // registered later but with lower zIndex render below earlier ones.
  const canvasOverlaysSorted = $derived(
    [...pluginRegistry.canvasOverlays].sort((a, b) => a.zIndex - b.zIndex),
  );

  // Reactively install/uninstall plugins when the `plugins` prop changes.
  // Runs on mount (initial install) and on every subsequent prop update.
  const buildCtx = (pluginId: string) =>
    pluginRegistry.buildContext(pluginId, imperativeAPI, tunnels, pluginGetStoreBridge);

  // Combined plugin list: built-ins shipped with the editor + extras
  // passed through the `plugins` prop. Built-ins go first so a host
  // plugin with the same id (theoretically) could override — though
  // PluginRegistry.install is idempotent on id and won't double-mount.
  // Hosts that want to disable a built-in must filter builtinPlugins
  // themselves; expose builtinPlugins from the package surface so
  // they can.
  const allPlugins = $derived<SveltedrawPlugin[]>([
    ...builtinPlugins,
    ...plugins,
  ]);

  $effect(() => {
    const currentIds = new Set(allPlugins.map((p) => p.id));

    // Uninstall plugins that were removed from the combined list.
    // installedIds allocates a snapshot Set — only called once per effect run.
    for (const id of pluginRegistry.installedIds) {
      if (!currentIds.has(id)) pluginRegistry.uninstall(id);
    }

    // Install any plugins not yet registered.
    for (const plugin of allPlugins) {
      if (!pluginRegistry.isInstalled(plugin.id)) {
        pluginRegistry.install(plugin, buildCtx(plugin.id));
      }
    }
  });

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
  // non-reactive locals because the renderer reads them by reference and a
  // $state proxy would (a) deep-wrap mutations the renderer makes internally
  // and (b) trigger re-runs we don't want — `sceneReady` is the explicit
  // reactive ticker for paint. The svelte-ignore is intentional.
  // svelte-ignore non_reactive_update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scene: any = null;
  // svelte-ignore non_reactive_update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let renderer: any = null;
  // svelte-ignore non_reactive_update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rc: any = null;

  // Bumped after construction so the static-render $effect can trigger its
  // first paint once the Scene/Renderer are ready.
  let sceneReady = $state(0);

  // Static render callback — assembles StaticSceneRenderConfig per frame and
  // calls renderStaticScene. An empty Scene renders background + grid only.
  //
  // IMPORTANT (batch 4 gotcha): `Renderer.getRenderableElements` is wrapped
  // with original `memoize` (`Renderer.ts:26`). Memoize keys on argument
  // IDENTITY. Mutating nested state (`appState.zoom.value = 2`) keeps the
  // same object ref → memoize hit → canvas won't repaint. Use replace-style
  // mutations for any object-valued AppState field touched by this function
  // (`zoom`, `gridSize`, `gridStep` etc.) — e.g. `appState.zoom = { ...appState.zoom, value: 2 }`.
  const staticRender = () => {
    if (!renderer || !scene || !rc) return;
    // DEV probe: count static-render invocations so tests can verify repaint.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((import.meta as any).env?.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__sveltedrawStaticTicks =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).__sveltedrawStaticTicks ?? 0) + 1;
    }

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

    // Original `StaticSceneRenderConfig` pins exact AppState shape; our
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
    // re-paste), element draws as a placeholder per original behavior.
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
    sceneReady++; // triggers the first static paint

    // Initialize the original Fonts loader. It takes a scene object
    // with getNonDeletedElements + triggerUpdate(). Scene from
    // @sveltedraw/element already has both. After construction,
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

    // Test-only probe: smoke scripts read `window.__sveltedrawProbe`.
    // Implementation lives in ./dev/probe.ts; we just wire the bindings.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((import.meta as any).env?.DEV) {
      installSveltedrawProbe({
        appState,
        getScene: () => scene,
        binaryFiles,
        exportAsPng,
        exportAsSvg,
        saveSelectionToLibrary: () => saveSelectionToLibrary(),
        insertLibraryItem: (item) => insertLibraryItem(item as LibraryItem),
        deleteLibraryItem: (id) => deleteLibraryItem(id),
        getLibraryItems: () => libraryItems,
        toggleSidePanel: (name) => toggleSidePanel(name),
        closeAllSidePanels: () => closeAllSidePanels(),
        isSidePanelOpen: (name) => isSidePanelOpen(name),
        handleExport: (opts) => handleExport(opts as ExportOptions),
        startPresentation: () => handleStartPresentation(),
        exitPresentation: () => handlePresentationExit(),
        getPresentationSlides: () => presentationSlides,
        getPresentationSlideSvgs: () => presentationSlideSvgs,
        isPresentationActive: () => presentationActive,
        getLibraryComponents: () => libraryComponents,
        saveComponentToLibrary: () => handleSaveComponentToLibrary(),
        insertLibraryComponent: (c) => handleLibraryComponentSelect(c as LibraryComponent),
        getEditorHistory: () => editorHistory,
        getHistoryCurrentIndex: () => historyCurrentIndex,
        getHistoryLen: () => historyStore.getLength(),
        jumpHistory: (i) => handleHistoryJump(i),
        clearHistory: () => handleHistoryClear(),
        pushHistory: () => pushHistory(),
        updateBoundElementsHook: (el) => updateBoundElements(el, scene),
        bumpSceneRepaint: () => bumpSceneRepaint(),
        getSnapConfig: () => snapConfig,
        getGridConfig: () => gridConfig,
        setSnapConfig: (patch) => Object.assign(snapConfig, patch),
        setGridConfig: (patch) => Object.assign(gridConfig, patch),
        openLinkDialog: () => openLinkDialog(),
        closeLinkDialog: () => closeLinkDialog(),
        confirmLinkDialog: (v) => confirmLinkDialog(v),
        isLinkDialogOpen: () => linkDialogOpen,
        toggleLaser: () => toggleLaser(),
        isLaserActive: () => pluginRegistry.getStore<LaserStore>(LASER_STORE_KEY)?.isActive() ?? false,
        getLaserTrailLen: () => pluginRegistry.getStore<LaserStore>(LASER_STORE_KEY)?.trailLength() ?? 0,
        setMeasurementConfig: (patch) =>
          Object.assign(measurementConfig, patch as Partial<MeasurementConfig>),
        getMeasurementConfig: () => ({ ...measurementConfig }),
        tryRestoreSceneFromPng: (b) => tryRestoreSceneFromPng(b),
        flipSelected: (axis) => flipSelected(axis),
        setAutoAdvanceDuration: (ms) => {
          (presentationConfig as any).autoAdvanceDuration = ms;
        },
        setPresentationPlaying: (v) => {
          presentationIsPlaying = v;
        },
        getPresentationCurrentIndex: () => presentationCurrentIndex,
        createFrameAtCenter: () => createFrameAtCenter(),
        applyStyle: (patch) => applyStyle(patch as Record<string, unknown>),
        setActiveTool: (type) => setActiveTool(type),
        // Phase 17 — collab session inspector for honest-tests. Returns a
        // plain JSON-safe snapshot rather than the live store getters so
        // the test can pass it across CDP without serialization issues.
        getCollabState: () => ({
          status: collabStore.status,
          userCount: collabStore.users.size,
          myUserId: collabStore.myUserId,
          roomId: collabStore.roomId,
        }),
        forcePresentationSlides: (n) => {
          presentationSlides = Array.from({ length: n }, (_, i) => ({
            id: `s${i}`,
            title: `Slide ${i + 1}`,
            description: "",
            elements: [],
            order: i,
            duration: 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          })) as any;
          presentationSlideSvgs = Array.from({ length: n }, () => "");
          presentationCurrentIndex = 0;
          presentationActive = true;
        },
      });
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

    // Touch gesture handlers (mobile support) — see ./engine/touchGestures.ts
    // Long-press opens the same context menu as right-click. Wrapped in a
    // closure because `openContextMenuAtClient` is declared below this
    // onMount call site (avoids TDZ at module-eval time).
    const teardownTouch = containerEl
      ? installTouchGestures(containerEl, {
          appState,
          bumpSceneRepaint,
          showContextMenu: (clientX, clientY) =>
            openContextMenuAtClient(clientX, clientY),
        })
      : () => {};

    // Auto-focus the container on mount so hotkeys work without requiring
    // the user to click first. Matches original UX.
    containerEl?.focus({ preventScroll: true });

    let ro: ResizeObserver | null = null;
    if (supportsResizeObserver && containerEl) {
      ro = new ResizeObserver(() => measure());
      ro.observe(containerEl);
    }

    window.addEventListener("resize", measure);
    measure();

    // Notify host app that the API is ready (one-time callback).
    onmount?.(imperativeAPI);

    // Phase 17: auto-start collab if a server URL is configured. Runs
    // after `onmount?.()` so a host app embedding sveltedraw has a chance
    // to set its own collab policy before we connect on its behalf. Errors
    // are swallowed inside startCollabSession; the status indicator will
    // surface failure once Commit 4 lands.
    {
      const autoServerUrl = resolveCollabServerUrl();
      if (autoServerUrl) {
        const identity = loadStoredIdentity() ?? makeAnonIdentity();
        void startCollabSession(autoServerUrl, identity);
      }
    }

    // Flush any pending save on page unload so nothing is lost.
    const onBeforeUnload = () => {
      flushPendingSave();
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
      teardownTouch();
      // Laser RAF cleanup is now inside the laser-pointer plugin's
      // install() return — runs automatically when the plugin
      // uninstalls (App.svelte cleanup → builtinPlugins removed →
      // each plugin's cleanup fires).
      // Flush the pending save synchronously on unmount too.
      flushPendingSave();
      // Phase 17: tear down any active collab session. leaveRoom is
      // idempotent — safe to call regardless of whether joinRoom ran.
      collabStore.leaveRoom();
      AnimationController.cancel(INTERACTIVE_SCENE_ANIMATION_KEY);
      renderer?.destroy?.();
    };
  });

  // ── Batch 4: interaction handlers (Svelte-native port) ───────────────
  //
  // Rationale: original `engine/` modules (keyboardOps/pointerEventOps/…) are
  // React-coupled (flushSync, jotai atoms from .tsx files, actions system).
  // Reusing them requires a parallel shadow-monorepo of shims. We port each
  // tool's lifecycle fresh as Svelte-idiomatic code instead — bounded cost
  // per tool, no React baggage in the Svelte bundle.
  //
  // Batch 4 scope: ONE tool (rectangle), end-to-end. Keydown → tool switch,
  // pointerdown → create newElement, pointermove → extend, pointerup → commit.
  // Subsequent batches copy-paste for other shapes and add selection/drag.

  // Map keyboard keys to tool types. Approximates original `findShapeByKey`
  // (packages/engine/components/shapes.tsx). Numeric keys are the
  // primary hotkeys; letter aliases match original where applicable.
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
    // B2: eraser tool — 'e' hotkey matches original.
    e: "eraser",
    E: "eraser",
  };

  const setActiveTool = (type: string) => {
    // Commit any in-progress polyline before switching tool — otherwise
    // the floating newElement would leak across tool changes.
    if (polylineActive) commitPolyline();
    // Switching tools cancels the laser pointer — delegated to the
    // plugin store. Matches the prior "Laser auto-exits on Esc or tool
    // switch" behavior.
    pluginRegistry.getStore<LaserStore>(LASER_STORE_KEY)?.cancel();
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
    imperativeAPI.notifyToolChange(type);
  };

  // Toggle tool lock (Q in original). When on, the current drawing
  // tool stays active after a draw instead of falling back to
  // selection.
  const toggleToolLock = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const at = (appState as any).activeTool ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appState as any).activeTool = { ...at, locked: !at.locked };
  };

  // ── Persistence (localStorage) ───────────────────────────────────────
  // Implementation lives in ./state/persistence.ts. Scene is reassigned in
  // onMount, so we hand the factory a getter rather than the value.
  const { saveNow, scheduleSave, tryLoad, flushPendingSave } = createPersistence({
    getScene: () => scene,
    appState,
  });

  // ── History (undo/redo) ──────────────────────────────────────────────
  // Implementation lives in ./history/store.ts. App.svelte owns the reactive
  // panel state ($state below); collab broadcasting is handled by CollabStore
  // (injected via the `onmount` callback), not wired here.
  const historyStore = createHistoryStore({
    getScene: () => scene,
    appState,
    scheduleSave,
    bumpSceneRepaint: () => bumpSceneRepaint(),
    getYmap: () => null,
    setUI: (entries, idx) => {
      editorHistory = entries;
      historyCurrentIndex = idx;
    },
  });
  const { pushHistory, undo, redo } = historyStore;

  // Publish a reactive bridge to the editor history so the
  // builtin/history-panel plugin can render it without taking
  // ownership of the undo/redo source of truth. The getters close
  // over the $state proxies; reading them inside the plugin's
  // <HistoryPanel> component tracks dependencies normally.
  const historyUIBridge: HistoryUIBridge = {
    get history() { return editorHistory; },
    get currentIndex() { return historyCurrentIndex; },
    jumpTo: (i: number) => historyStore.jumpTo(i),
    clearKeepCurrent: () => historyStore.clearKeepCurrent(),
  };
  registerCtx(HISTORY_UI_BRIDGE_KEY, historyUIBridge);

  // ── Collab wiring (Phase 17) ─────────────────────────────────────────
  // Identity is persisted across sessions in localStorage; the dialog
  // (Commit 2) updates it. For now, anon-fallback covers auto-start +
  // direct button click flows.
  const COLLAB_IDENTITY_KEY = "sveltedraw-collab-identity";
  const COLLAB_PALETTE = [
    "#1971c2", // blue
    "#2f9e44", // green
    "#e67700", // amber
    "#c92a2a", // red
    "#9c36b5", // purple
    "#0c8599", // teal
    "#e8590c", // orange
    "#5f3dc4", // indigo
  ];

  type StoredIdentity = { id: string; name: string; color: string };

  /**
   * Read persisted identity from localStorage. Returns null on first
   * run / corrupted JSON / SSR. Caller must handle the null path
   * (either fall back to anon-default or prompt the dialog).
   */
  const loadStoredIdentity = (): StoredIdentity | null => {
    try {
      const raw = window.localStorage.getItem(COLLAB_IDENTITY_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        typeof parsed?.id === "string" &&
        typeof parsed?.name === "string" &&
        typeof parsed?.color === "string"
      ) {
        return parsed as StoredIdentity;
      }
    } catch { /* swallow */ }
    return null;
  };

  /**
   * Generate an ephemeral anonymous identity for users who join without
   * having gone through the identity dialog (e.g. auto-start via URL).
   * The id includes 4 random hex chars so two anon tabs in the same
   * room don't collide on awareness deduplication.
   */
  const makeAnonIdentity = (): StoredIdentity => {
    const slug = Math.random().toString(16).slice(2, 6);
    const color = COLLAB_PALETTE[Math.floor(Math.random() * COLLAB_PALETTE.length)];
    return {
      id: `anon-${slug}`,
      name: `Guest ${slug.toUpperCase()}`,
      color,
    };
  };

  /**
   * Read collab params from the URL. Sveltedraw runs under a hash
   * router (#app), so query params usually live inside the hash
   * fragment (`#app?collab=ws://...`). We check both top-level
   * `URL.searchParams` and the hash fragment so either form works.
   */
  const readCollabUrlParam = (name: string): string | null => {
    try {
      const url = new URL(window.location.href);
      const top = url.searchParams.get(name);
      if (top) return top;
      const hash = url.hash || "";
      const qIdx = hash.indexOf("?");
      if (qIdx === -1) return null;
      return new URLSearchParams(hash.slice(qIdx + 1)).get(name);
    } catch { return null; }
  };

  /**
   * Resolve the collab server URL. Priority:
   *   1. `?collab=ws://...` query param (per-session override)
   *   2. `VITE_COLLAB_SERVER` env var (deployment default)
   *   3. null → no auto-start
   */
  const resolveCollabServerUrl = (): string | null => {
    const fromUrl = readCollabUrlParam("collab");
    if (fromUrl) return fromUrl;
    const fromEnv = import.meta.env.VITE_COLLAB_SERVER as string | undefined;
    return fromEnv || null;
  };

  /**
   * Resolve the room id. `?room=foo` overrides; default room name lets
   * two tabs of the same browser converge without any URL params.
   */
  const resolveCollabRoomId = (): string =>
    readCollabUrlParam("room") ?? "sveltedraw-default";

  /**
   * Start a collab session with the given identity. Wraps `joinRoom` so
   * the button handler and auto-start share the same call site.
   */
  const startCollabSession = async (
    serverUrl: string,
    identity: StoredIdentity,
  ): Promise<void> => {
    if (collabStore.status !== "idle") return; // already active
    try {
      await collabStore.joinRoom({
        serverUrl,
        roomId: resolveCollabRoomId(),
        // Phase 17 / A1: role is hardcoded teacher until A3 ships role
        // selection. canEdit() returns true for teachers regardless of
        // zone, which is what we want for a generic 2-tab demo.
        role: "teacher",
        user: { id: identity.id, name: identity.name, color: identity.color },
      });
    } catch (err) {
      console.warn("[collab] joinRoom failed:", err);
    }
  };

  // ── Identity dialog state (Phase 17 / A3) ───────────────────────────
  // The dialog is opened only on explicit button-click flows when no
  // identity has been persisted. Auto-start (URL/env) bypasses it and
  // uses anon-fallback so embedded scenarios stay silent.
  let collabDialogOpen = $state(false);
  // Server URL captured at click time; remembered across the dialog's
  // lifetime so submit knows where to connect. Reset on close.
  let pendingCollabServerUrl: string | null = $state(null);
  // Stable id offered to the dialog as the default (so re-opening the
  // dialog after a cancel keeps the same anon id). Regenerated only
  // when the dialog actually opens with no prior identity.
  let pendingAnonId: string | null = $state(null);

  /**
   * Toggle handler for the LiveCollaborationTrigger button.
   * - If already in a session: leave.
   * - Otherwise: resolve server, then either join with persisted
   *   identity (fast path) or open the identity dialog.
   * - If no server URL is configured: warn (Commit 4 will surface a toast).
   */
  const handleCollabButtonClick = (): void => {
    if (collabStore.status !== "idle") {
      collabStore.leaveRoom();
      return;
    }
    const serverUrl = resolveCollabServerUrl();
    if (!serverUrl) {
      console.warn(
        "[collab] No collab server configured. Set VITE_COLLAB_SERVER " +
          "or use ?collab=ws://host:port",
      );
      return;
    }
    const stored = loadStoredIdentity();
    if (stored) {
      // Fast path: known identity, skip dialog.
      void startCollabSession(serverUrl, stored);
      return;
    }
    // First-time user: prompt for name + color before joining. We
    // generate a stable anon id up front so canceling and reopening
    // the dialog doesn't churn awareness ids on retry.
    pendingCollabServerUrl = serverUrl;
    pendingAnonId = makeAnonIdentity().id;
    collabDialogOpen = true;
  };

  /**
   * Identity dialog submit handler. Persists if requested, then joins.
   * Persisted form omits the volatile `persist` flag — only the
   * identity triple is durable.
   */
  const onCollabIdentitySubmit = (result: IdentityResult): void => {
    const identity: StoredIdentity = {
      id: result.id,
      name: result.name,
      color: result.color,
    };
    if (result.persist) {
      try {
        window.localStorage.setItem(
          COLLAB_IDENTITY_KEY,
          JSON.stringify(identity),
        );
      } catch (err) {
        console.warn("[collab] Failed to persist identity:", err);
      }
    }
    const serverUrl = pendingCollabServerUrl;
    collabDialogOpen = false;
    pendingCollabServerUrl = null;
    pendingAnonId = null;
    if (serverUrl) void startCollabSession(serverUrl, identity);
  };

  const onCollabIdentityCancel = (): void => {
    collabDialogOpen = false;
    pendingCollabServerUrl = null;
    pendingAnonId = null;
  };

  // ── Connection status toast (Phase 17 / A4) ─────────────────────────
  // We track the previous status so we can fire toasts only on actual
  // transitions (mid-session drop, reconnect). The initial idle →
  // connecting → connected sequence is already conveyed by the button's
  // own state and would just be noise as a toast.
  let collabToast: { message: string; tone: "info" | "warn" | "ok" } | null =
    $state(null);
  let prevCollabStatus: typeof collabStore.status = "idle";
  $effect(() => {
    const cur = collabStore.status;
    const prev = prevCollabStatus;
    prevCollabStatus = cur;

    if (prev === "connected" && cur === "disconnected") {
      // Mid-session drop. y-websocket auto-reconnects so we promise the
      // user it's coming back; the connected→toast (below) confirms.
      collabToast = {
        message: "Connection lost. Reconnecting…",
        tone: "warn",
      };
    } else if (prev === "disconnected" && cur === "connected") {
      collabToast = { message: "Reconnected", tone: "ok" };
    }
    // All other transitions (idle ↔ connecting, connecting → connected
    // initial join, leaveRoom) are silent.
  });

  // ── Cursor broadcast (Phase 17 / A2) ────────────────────────────────
  // Throttled to ~20fps. Native pointermove can fire at 60-1000Hz on
  // high-rate input devices; awareness gossip every tick would melt
  // both the socket and the peers' renderers. 50ms is smooth enough
  // that motion looks continuous and cheap enough that a 4-peer room
  // sends ~80 messages/sec total.
  const CURSOR_BROADCAST_THROTTLE_MS = 50;
  let lastCursorBroadcastAt = 0;
  const broadcastCursor = (event: PointerEvent): void => {
    if (collabStore.status !== "connected") return;
    const now = performance.now();
    if (now - lastCursorBroadcastAt < CURSOR_BROADCAST_THROTTLE_MS) return;
    lastCursorBroadcastAt = now;
    const { x: sceneX, y: sceneY } = toSceneCoords(event.clientX, event.clientY);
    // x/y are kept as raw clientX/clientY in case future on-screen
    // indicators want screen-space without redoing the scene-coord
    // conversion. Peers ignore them today and use sceneX/sceneY for
    // pan/zoom-stable rendering (see CollabCursors.svelte).
    collabStore.updateCursor(event.clientX, event.clientY, sceneX, sceneY);
  };

  // Phase 11 frames Map (read by handleStartPresentation + createFrameAtCenter
  // for slide segmentation + new-frame naming) is populated by createFrameAtCenter
  // alone; the standalone Map mutators (createFrame/deleteFrame/etc.) were never
  // wired to UI and lived as dead code — removed.

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
    // drop them. The engine does the same on frame removal.
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
    // original utility handles fractional indices + group id rewriting +
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
  // Original stores group membership as `element.groupIds: string[]`
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
  // Original has a much richer Library class (jotai-backed, file import
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

  // Laser pointer migrated to builtin/laser-pointer plugin. The plugin
  // owns active flag + trail + RAF loop; App.svelte's pointermove
  // handler just calls store.recordSample(x, y) with container-relative
  // coords (the plugin can't read event.clientX/Y or container rect).
  // toggleLaser is preserved as a thin shim for the probe surface
  // (honest-tests call probe.toggleLaser).
  const toggleLaser = (): void => {
    pluginRegistry.getStore<LaserStore>(LASER_STORE_KEY)?.toggle();
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


  // Connector tool state moved to builtin/connector-tool plugin. The
  // pointerdown handler routes hits through the plugin's store; this
  // file no longer tracks active/firstPick directly.

  // Phase 13: Smart Alignment & Guides — guide overlay state stays in
  // App.svelte (canvas rendering reads it). The alignment panel UI +
  // toolbar trigger are owned by builtin/alignment-panel plugin.
  let alignmentGuides = $state<AlignmentGuide[]>([]);

  // Phase 13: Measurement & Dimensions — config stays in App.svelte
  // (probe surface + future snap math reads it). The measurement
  // panel UI is owned by builtin/measurement-panel plugin via bridge.
  let measurementConfig = $state<MeasurementConfig>({
    showRulers: false,
    showDistances: false,
    showDimensions: true,
    unit: "px",
    precision: 1,
  });

  // Phase 13: Auto-Layout Algorithm — handlers stay in App.svelte
  // (selectedCount + onLayout exposed through bridge). The
  // auto-layout panel UI is owned by builtin/autolayout-panel plugin.

  // Phase 14: Grid & Snap System — gridConfig + snapConfig stay in
  // App.svelte (snap math runs in pointer-move drag handler). Panel
  // UI owned by builtin/grid-panel plugin via bridge.
  let gridConfig = $state<GridConfig>({
    enabled: true,
    size: 20,
    visible: false,
    opacity: 0.15,
  });
  let snapConfig = $state<SnapConfig>({
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

  // Phase 15: Layer Management — layers + selectedLayerId stay in
  // App.svelte (layer factory needs scene + appState). Panel UI
  // owned by builtin/layer-panel plugin via bridge.
  let layers = $state<LayerItem[]>([]);
  let selectedLayerId = $state<string | null>(null);
  let expandedGroups = $state<Set<string>>(new Set());

  // Phase 16: History Panel & Timeline
  let editorHistory = $state<HistoryState[]>([]);
  let historyCurrentIndex = $state(0);

  // Phase 16 Feature 2: Shape Library & Component Manager — library
  // state + handlers stay in App.svelte. Panel UI owned by
  // builtin/shape-library-panel plugin via bridge.
  const libraryConfig = getDefaultLibraryConfig();
  let libraryComponents = $state<LibraryComponent[]>([]);
  let libraryCategories = $state<LibraryCategory[]>(libraryConfig.defaultCategories);
  let librarySelectedCategory = $state('all');
  let librarySearchQuery = $state('');

  // All side panels are now plugins (Grid, Layer, Library migrated in
  // the final wave). The registry's openExclusiveSidePanel coordinates
  // them directly, so App.svelte no longer needs an external closer
  // hook. If a future feature adds an inline panel, register a closer
  // here via pluginRegistry.registerExternalSidePanelCloser.

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

  // Phase 16 Feature 4: Export Enhancements — state + panel mount now
  // live in the export-panel plugin. App.svelte only owns the export
  // pipeline (handleExport below), reachable via the EXPORT_BRIDGE_KEY.

  // Side panels are all plugins now — toggling happens through their
  // own toolbar buttons + `pluginRegistry.toggleExclusiveSidePanel`.
  // Functions kept as no-ops so probe surface still resolves the
  // method names. Will go away when probe drops them.
  const isSidePanelOpen = (_name: string): boolean => false;
  const closeAllSidePanels = () => {
    pluginRegistry.openExclusiveSidePanel(null);
  };
  const toggleSidePanel = (_name: string) => {
    // No-op: side panels are now plugin-owned.
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

  // Bridge for the connector-tool plugin. createArrow stays here
  // because it needs scene mutation + pushHistory + bumpSceneRepaint;
  // setHighlight pokes appState.selectedElementIds so the user sees
  // which shape they picked first.
  const connectorBridge: ConnectorBridge = {
    createArrow: createConnectorArrow,
    setHighlight: (elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).selectedElementIds = elementId
        ? { [elementId]: true }
        : {};
    },
  };
  registerCtx(CONNECTOR_BRIDGE_KEY, connectorBridge);

  // Bridge for the laser-pointer plugin — exposes the canvas
  // dimensions for the SVG overlay viewBox.
  const laserBridge: LaserBridge = {
    get width() { return appState.width as number; },
    get height() { return appState.height as number; },
  };
  registerCtx(LASER_BRIDGE_KEY, laserBridge);

  // Bridge for the export-panel plugin — exposes the live element
  // count + the export pipeline. The plugin owns the modal UI + the
  // ExportOptions state; App.svelte holds the closures over scene +
  // appState + binaryFiles that the actual byte-level export needs.
  const exportBridge: ExportBridge = {
    get elementCount() {
      return scene ? scene.getNonDeletedElements().length : 0;
    },
    doExport: (options, onComplete) => {
      handleExportImpl(options, {
        scene,
        appState,
        binaryFiles,
        onComplete,
      });
    },
  };
  registerCtx(EXPORT_BRIDGE_KEY, exportBridge);

  // ── Smart Alignment & Guides ─────────────────────────────────────────
  // Implementation in ./alignment/handlers.ts.
  const _alignmentHandlers = createAlignmentHandlers({
    getScene: () => scene,
    getSelectedElements,
    pushHistory,
    bumpSceneRepaint: () => bumpSceneRepaint(),
    setAlignmentGuides: (g) => { alignmentGuides = g; },
  });
  const handleAlign = _alignmentHandlers.handleAlign;
  const handleDistribute = _alignmentHandlers.handleDistribute;
  const updateAlignmentGuides = _alignmentHandlers.updateAlignmentGuides;
  const handleAutoLayout = _alignmentHandlers.handleAutoLayout;

  // Bridges for the alignment / autolayout / measurement plugins.
  // Each bridge exposes the editor's reactive sources via getters
  // so plugin components track dependencies through the property
  // accesses (Svelte's $derived registers the underlying $state proxy
  // reads when those getters fire).
  const alignmentBridge: AlignmentBridge = {
    get selectedCount() { return getSelectedElements().length; },
    align: handleAlign,
    distribute: handleDistribute,
  };
  registerCtx(ALIGNMENT_BRIDGE_KEY, alignmentBridge);

  const autoLayoutBridge: AutoLayoutBridge = {
    get selectedCount() { return getSelectedElements().length; },
    applyLayout: handleAutoLayout,
  };
  registerCtx(AUTOLAYOUT_BRIDGE_KEY, autoLayoutBridge);

  const measurementBridge: MeasurementBridge = {
    get selectedElements() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return getSelectedElements().map((el: any) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
      }));
    },
    get config() { return measurementConfig; },
    setConfig: (next) => { measurementConfig = next; },
  };
  registerCtx(MEASUREMENT_BRIDGE_KEY, measurementBridge);

  // Bridge for the Grid + Snap plugin — configs stay in App.svelte
  // because snap math runs in the pointer-move drag handler.
  const gridBridge: GridBridge = {
    get gridConfig() { return gridConfig; },
    get snapConfig() { return snapConfig; },
    setGridConfig: (next) => { gridConfig = next; },
    setSnapConfig: (next) => { snapConfig = next; },
  };
  registerCtx(GRID_BRIDGE_KEY, gridBridge);

  // Phase 15: Layer Management — implementation in ./layers/handlers.ts.
  const _layerHandlers = createLayerHandlers({
    getScene: () => scene,
    appState,
    pushHistory,
    bumpSceneRepaint: () => bumpSceneRepaint(),
    getSelectedElements,
    getLayers: () => layers,
    setLayers: (next) => { layers = next; },
    setSelectedLayerId: (id) => { selectedLayerId = id; },
    expandedGroups,
  });
  const syncLayersFromScene = _layerHandlers.syncLayersFromScene;
  // syncSelectionFromCanvas is exposed but never called externally — keep for parity
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _syncSelectionFromCanvas = _layerHandlers.syncSelectionFromCanvas;
  const handleLayerSelect = _layerHandlers.handleLayerSelect;
  const handleReorderLayers = _layerHandlers.handleReorderLayers;
  const handleLayerVisibilityChange = _layerHandlers.handleLayerVisibilityChange;
  const handleLayerLockChange = _layerHandlers.handleLayerLockChange;
  const handleLayerOpacityChange = _layerHandlers.handleLayerOpacityChange;
  const handleCreateGroup = _layerHandlers.handleCreateGroup;
  const handleDeleteGroup = _layerHandlers.handleDeleteGroup;

  // Bridge for the Layer panel plugin.
  const layerBridge: LayerBridge = {
    get layers() { return layers; },
    get selectedLayerId() { return selectedLayerId; },
    onLayerSelect: handleLayerSelect,
    onLayerVisibilityChange: handleLayerVisibilityChange,
    onLayerLockChange: handleLayerLockChange,
    onLayerOpacityChange: handleLayerOpacityChange,
    onCreateGroup: handleCreateGroup,
    onDeleteGroup: handleDeleteGroup,
    onReorderLayers: handleReorderLayers,
  };
  registerCtx(LAYER_BRIDGE_KEY, layerBridge);

  // ── Phase 16: History Management ──────────────────────────────────
  const handleHistoryJump = historyStore.jumpTo;
  const handleHistoryClear = historyStore.clearKeepCurrent;

  // ── Phase 16 Feature 2: Library Management ─────────────────────────
  // Implementation in ./library/handlers.ts. App owns the $state vars
  // (libraryComponents, librarySelectedCategory) and routes them via
  // getter/setter callbacks.
  const _libraryHandlers = createLibraryHandlers({
    getScene: () => scene,
    appState,
    pushHistory,
    bumpSceneRepaint: () => bumpSceneRepaint(),
    getSelectedElements,
    getLibraryComponents: () => libraryComponents,
    setLibraryComponents: (next) => {
      libraryComponents = next;
    },
    bumpComponentUsage: (id) => {
      const idx = libraryComponents.findIndex((c) => c.id === id);
      if (idx !== -1) libraryComponents[idx].usage += 1;
    },
    getLibrarySelectedCategory: () => librarySelectedCategory,
  });
  const handleSaveComponentToLibrary = _libraryHandlers.saveComponentToLibrary;
  const handleLibraryComponentSelect = _libraryHandlers.insertComponent;
  const handleLibraryComponentDelete = _libraryHandlers.deleteComponent;
  const handleLibraryExport = _libraryHandlers.exportLibrary;
  const handleLibraryImport = _libraryHandlers.importLibrary;

  // Bridge for the Shape Library plugin. Library state + handlers all
  // live in App.svelte (handlers wire into scene mutation +
  // persistence); plugin owns only the panel UI.
  const shapeLibraryBridge: ShapeLibraryBridge = {
    get components() { return libraryComponents; },
    get categories() { return libraryCategories; },
    get selectedCategoryId() { return librarySelectedCategory; },
    get searchQuery() { return librarySearchQuery; },
    setSelectedCategory: (id) => { librarySelectedCategory = id; },
    setSearchQuery: (q) => { librarySearchQuery = q; },
    onSelectComponent: handleLibraryComponentSelect,
    onDeleteComponent: handleLibraryComponentDelete,
    onExport: handleLibraryExport,
    onImport: handleLibraryImport,
  };
  registerCtx(SHAPE_LIBRARY_BRIDGE_KEY, shapeLibraryBridge);

  // ── Phase 16 Feature 3: Presentation Mode ──────────────────────────
  // Implementation in ./presentation/handlers.ts.
  const _presentationHandlers = createPresentationHandlers({
    getScene: () => scene,
    appState,
    getBinaryFiles: () => binaryFiles,
    getFrames: () => deriveFramesFromScene(),
    presentationConfig,
    setSlides: (s) => { presentationSlides = s; },
    setSlideSvgs: (s) => { presentationSlideSvgs = s; },
    setCurrentIndex: (i) => { presentationCurrentIndex = i; },
    setIsPlaying: (p) => { presentationIsPlaying = p; },
    setActive: (a) => { presentationActive = a; },
    getSlides: () => presentationSlides,
    getCurrentIndex: () => presentationCurrentIndex,
    getIsPlaying: () => presentationIsPlaying,
  });
  const handleStartPresentation = _presentationHandlers.start;
  const handlePresentationNextSlide = _presentationHandlers.next;
  const handlePresentationPreviousSlide = _presentationHandlers.prev;
  const handlePresentationTogglePlayPause = _presentationHandlers.togglePlayPause;
  const handlePresentationExit = _presentationHandlers.exit;
  const handlePresentationSlideJump = _presentationHandlers.jumpToSlide;

  // ── Phase 16 Feature 4: Export Enhancements ──────────────────────────
  // Pipeline lives in ./export/handleExport.ts; the modal UI + options
  // state migrated to the export-panel plugin (Tier 3 wave 3). The
  // probe surface still exposes `handleExport(opts)` so puppeteer tests
  // can trigger the export pipeline without driving the panel UI; we
  // route through the plugin store's close() so the panel hides if it
  // happened to be open.
  const handleExport = (options: ExportOptions) =>
    handleExportImpl(options, {
      scene,
      appState,
      binaryFiles,
      onComplete: () => {
        pluginRegistry.getStore<ExportPanelStore>(EXPORT_STORE_KEY)?.close();
      },
    });

  // ── Z-order: bring forward / send backward / to front / to back ─────
  // Original's shiftElementsByOne returns the full reordered array;
  // replaceAllElements with skipValidation bypasses fractional-index
  // validation since original sync happens inside replaceAllElements.
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
  // Thin wrappers over original `@sveltedraw/utils/export`. Those helpers
  // call `restoreAppState` + `restoreElements` defensively, so we can pass
  // our $state proxy cast to any — they migrate/normalize what they need.
  // Download helper extracted to ./data/download.ts.

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

  // ── .sveltedraw JSON file open/save ────────────────────────────
  // Implementation in ./data/sveltedrawFile.ts.
  const saveAsSveltedrawFile = () =>
    saveSveltedrawFileImpl({ scene, appState, binaryFiles });
  const loadFromSveltedrawFile = () =>
    openSveltedrawFilePickerImpl({
      scene,
      appState,
      clearSelection,
      pushHistory,
      bumpSceneRepaint: () => bumpSceneRepaint(),
    });

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
    // Font inlining enabled — with `SVELTEDRAW_ASSET_PATH = location.origin`
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

  // ── Font loading ────────────────────────────────────────────────
  // Original Sveltedraw uses a Fonts class instance tied to the scene. It
  // scans text elements, loads the woff2 files from the registry, and
  // re-renders once document.fonts.ready resolves. Without this, picking
  // Virgil / Nunito / etc. from the popover changes element.fontFamily but
  // the canvas keeps rendering in the fallback.
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
  // Original has a much richer pipeline (async progressive load, image
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

  // Scene-mutation helpers (insert image / embed / frame, paste / drop / PNG
  // restore) live in ./data/sceneInserts.ts. App.svelte owns the cache + binary
  // record so the renderer + exports can read them directly.
  const _sceneInserts = createSceneInserts({
    getScene: () => scene,
    appState,
    pushHistory,
    bumpSceneRepaint: () => bumpSceneRepaint(),
    imageCacheMap,
    binaryFiles,
    getFrameCount: () => deriveFramesFromScene().size,
    toSceneCoords: (clientX, clientY) => toSceneCoords(clientX, clientY),
    isTextEditing: () => !!textEditor,
  });
  const insertImageFromBlob = _sceneInserts.insertImageFromBlob;
  const insertEmbed = _sceneInserts.insertEmbed;
  const createFrameAtCenter = _sceneInserts.createFrameAtCenter;
  const tryRestoreSceneFromPng = _sceneInserts.tryRestoreSceneFromPng;
  const onContainerPaste = _sceneInserts.onContainerPaste;
  const onContainerDragOver = _sceneInserts.onContainerDragOver;
  const onContainerDrop = _sceneInserts.onContainerDrop;
  const rehydrateImagesFromIdb = _sceneInserts.rehydrateImagesFromIdb;

  // ── Style editor ────────────────────────────────────────────────────
  //
  // Changes `strokeColor` / `backgroundColor` / `strokeWidth` / `opacity`
  // on either the current selection (all of them) or `currentItem*`
  // (defaults for next-drawn). Single pushHistory per style click.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyStyle = (patch: Record<string, any>) => {
    // Map the raw element-style key to its `currentItem*` counterpart
    // (original convention). Any key without a mapping falls through
    // unchanged (e.g. fontSize → currentItemFontSize via pass-through below
    // would be wrong, so missing keys are intentionally NOT written).
    const currentItemKeyMap: Record<string, string> = {
      strokeColor: "currentItemStrokeColor",
      backgroundColor: "currentItemBackgroundColor",
      strokeWidth: "currentItemStrokeWidth",
      strokeStyle: "currentItemStrokeStyle",
      fillStyle: "currentItemFillStyle",
      opacity: "currentItemOpacity",
      roughness: "currentItemRoughness",
      roundness: "currentItemRoundness",
      fontFamily: "currentItemFontFamily",
      fontSize: "currentItemFontSize",
      textAlign: "currentItemTextAlign",
      fontWeight: "currentItemFontWeight",
      fontStyle: "currentItemFontStyle",
      textDecoration: "currentItemTextDecoration",
      textColor: "currentItemTextColor",
      startArrowhead: "currentItemStartArrowhead",
      endArrowhead: "currentItemEndArrowhead",
      arrowType: "currentItemArrowType",
    };

    // Always persist to currentItem* defaults so the next-drawn element
    // inherits the style the user just picked. This matches user intent:
    // "pick color → switch to tool → draw" should use the picked color.
    // Previously we only wrote currentItem* when the selection was empty,
    // so selecting something + restyling + picking a tool lost the style.
    for (const [k, v] of Object.entries(patch)) {
      const targetKey = currentItemKeyMap[k];
      if (targetKey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any)[targetKey] = v;
      }
    }

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
  // PresetIconRow expects {value, name} — inline numbers get wrapped once here.
  const OPACITY_PRESETS = [25, 50, 75, 100].map((n) => ({
    value: n, name: String(n),
  }));
  // Font size quick-picks — matches the engine 4 canonical
  // sizes. DEFAULT_FONT_SIZE = 20 (Medium).
  const FONT_SIZE_PRESETS = [
    { name: "Small", value: 16, icon: "FontSizeSmallIcon" },
    { name: "Medium", value: 20, icon: "FontSizeMediumIcon" },
    { name: "Large", value: 28, icon: "FontSizeLargeIcon" },
    { name: "Extra large", value: 36, icon: "FontSizeExtraLargeIcon" },
  ];
  // Arrowhead quick-picks — full original Arrowhead enum minus
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
  const pickerElements = $derived.by<any[]>(() => {
    void sceneReady;
    if (!scene) return [];
    const selected = getSelectedElements();
    // Cast through `as any[]`: ColorRow's prop typing is mutable any[]; the
    // engine helpers return readonly arrays, but ColorRow only reads from
    // them, so relaxing the variance here is safe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (selected.length > 0 ? selected : scene.getNonDeletedElements()) as any[];
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

  // Reactive version of getSelectedElements() for prop-passing to child
  // components. Inline getSelectedElements() call sites don't track ID
  // changes across the function boundary, so props derived from them
  // go stale. Use this whenever a child component needs the live list.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedElementsReactive = $derived.by<any[]>(() => {
    void sceneReady;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = (appState as any).selectedElementIds ?? {};
    if (!scene) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (scene.getNonDeletedElements() as any[]).filter((el) => ids[el.id]);
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

  // Roundness type per element type (original ROUNDNESS constants):
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
  // unlocked. Matches original's element.locked boolean field.
  // C2: mirror selected elements. For a single selection, mirror around
  // the element's own bbox (symmetric shapes are no-ops visually). For
  // multi-select, mirror around the COMBINED bounding box of the
  // selection — each element's points + position get reflected so the
  // group as a whole flips rigidly, matching the engine UX.
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
  // Semantics mirror original `getStateForZoom` so scene coords stay stable
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
  // canvas; original uses a non-passive addEventListener on the container
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
      // Exponential step for smooth pinch/scroll; matches original feel.
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
      // Matches original keybindings.
      if (event.key === "g" || event.key === "G") {
        if (event.shiftKey) ungroupSelected();
        else groupSelected();
        event.preventDefault();
        return;
      }

      // Template selector: Ctrl+N — delegated to the templates plugin.
      if (!event.shiftKey && (event.key === "n" || event.key === "N")) {
        const store = pluginRegistry.getStore<{ open(): void }>(
          TEMPLATES_STORE_KEY,
        );
        if (store) {
          store.open();
          event.preventDefault();
        }
        return;
      }

      // Recent files: Ctrl+R — delegated to the recent-files plugin via
      // its published store. If the plugin is disabled the hotkey
      // becomes a no-op.
      if (!event.shiftKey && (event.key === "r" || event.key === "R")) {
        const store = pluginRegistry.getStore<{ open(): void }>(
          RECENT_FILES_STORE_KEY,
        );
        if (store) {
          store.open();
          event.preventDefault();
        }
        return;
      }

      // Settings: Ctrl+, — delegated to the settings plugin.
      if (!event.shiftKey && event.key === ",") {
        const store = pluginRegistry.getStore<{ open(): void }>(
          SETTINGS_STORE_KEY,
        );
        if (store) {
          store.open();
          event.preventDefault();
        }
        return;
      }

      // Connector tool: Ctrl+Shift+C — delegated to plugin store.
      if (event.shiftKey && (event.key === "c" || event.key === "C")) {
        const store = pluginRegistry.getStore<ConnectorStore>(CONNECTOR_STORE_KEY);
        if (store) {
          store.toggle();
          event.preventDefault();
        }
        return;
      }

      // Measurement panel: Ctrl+M — delegated to plugin store.
      if (!event.shiftKey && (event.key === "m" || event.key === "M")) {
        const store = pluginRegistry.getStore<{ toggle(): void }>(
          MEASUREMENT_PANEL_STORE_KEY,
        );
        if (store) {
          store.toggle();
          event.preventDefault();
        }
        return;
      }

      // Auto-Layout panel: Ctrl+L — delegated to plugin store.
      if (!event.shiftKey && (event.key === "l" || event.key === "L")) {
        const store = pluginRegistry.getStore<{ toggle(): void }>(
          AUTOLAYOUT_PANEL_STORE_KEY,
        );
        if (store) {
          store.toggle();
          event.preventDefault();
        }
        return;
      }

      // A1: Edit-link dialog: Ctrl+K (original keybinding). Only opens when
      // exactly one element is selected.
      if (!event.shiftKey && (event.key === "k" || event.key === "K")) {
        openLinkDialog();
        event.preventDefault();
        return;
      }

      // Z-order: Ctrl+] / Ctrl+[ (one step), Ctrl+Shift+] / Ctrl+Shift+[
      // (to front / to back). Matches original keybindings.
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
      // Esc cancels the laser pointer if active (delegated to plugin).
      pluginRegistry.getStore<LaserStore>(LASER_STORE_KEY)?.cancel();
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

    // Show comprehensive help on F1 — delegated to the help plugin.
    if (event.key === "F1") {
      const store = pluginRegistry.getStore<{ open(): void }>(HELP_STORE_KEY);
      if (store) {
        store.open();
        event.preventDefault();
      }
      return;
    }

    // Bare F (no modifiers) — insert a frame at viewport center.
    // Matches the engine single-key `F` shortcut convention;
    // sveltedraw currently dispatches "insert at center" rather than
    // original's drag-to-draw frame tool (we don't have a frame factory
    // in the pointerdown handler yet). Follow-up: wire `f` into
    // TOOL_HOTKEYS + add a frame branch to the tool factory so users
    // can drag out frames at arbitrary positions/sizes.
    if (event.key === "f" || event.key === "F") {
      createFrameAtCenter();
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
  //
  // Also calls scene.triggerUpdate() to bump `sceneNonce`, the ONLY cache-bust
  // signal for `Renderer.getRenderableElements`. Call sites that mutate with
  // `{ informMutation: false }` skip Scene's internal triggerUpdate, so without
  // this the canvas paints stale elements. Also fires imperativeAPI.notifyChange()
  // so all callers reach onChange subscribers without per-call wiring.
  const bumpSceneRepaint = () => {
    scene?.triggerUpdate();
    sceneReady++;
    imperativeAPI.notifyChange();
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
  // element.angle. Shift held = snap to 15° steps (matches Sveltedraw).
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
  // Matches original: top-center, offset above by ROTATION_RESIZE_HANDLE_GAP /
  // zoom. Applies the element's rotation around its center so the handle
  // rotates with it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getRotationHandlePos = (el: any): { x: number; y: number } => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomV = (appState.zoom as any).value || 1;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    // Unrotated handle position (top-center above bbox).
    const ROT_GAP = 16; // matches original ROTATION_RESIZE_HANDLE_GAP
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
    // @sveltedraw/math's pointFrom returns `GlobalPoint | LocalPoint`
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
  // on canvas — the textarea IS the preview. Original has a more elaborate
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
      // it (standard Sveltedraw behavior). New text with no content →
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
    // ghost under the textarea overlay. Original's Renderer skips any
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
  // Original UX:
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
    // Duplicate through original helper so ids / group-ids rewire
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

  // Open context menu at viewport (clientX/Y) coordinates. Shared by the
  // right-click handler and the touch long-press handler so the mobile
  // gesture gets the same behavior (hit-test + select-or-clear + menu).
  const openContextMenuAtClient = (clientX: number, clientY: number) => {
    if (!scene) return;
    const { x: sx, y: sy } = toSceneCoords(clientX, clientY);
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
      vpX: clientX - (appState.offsetLeft as number),
      vpY: clientY - (appState.offsetTop as number),
      hasSelection: Object.keys(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appState as any).selectedElementIds ?? {},
      ).length > 0,
    };
  };

  const onContainerContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    openContextMenuAtClient(event.clientX, event.clientY);
  };

  // ── Marquee (rubber-band) state ───────────────────────────────────
  // Represented as 4 scene-coords + a shiftHeld flag (additive vs replace
  // on commit). Rendered in the DOM overlay, not the canvas, to avoid
  // touching original renderer configs.
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

    // ── Connector tool — delegated to builtin/connector-tool plugin ──
    // The plugin owns the active flag + first-pick state. We hit-test
    // here (it needs the live event + canvas coords), then hand the
    // result to the plugin's store. handlePick returns true when the
    // event was consumed; on true we preventDefault + return so the
    // selection/draw fall-through doesn't run.
    {
      const connector = pluginRegistry.getStore<ConnectorStore>(CONNECTOR_STORE_KEY);
      if (connector?.isActive()) {
        const { x: cx, y: cy } = toSceneCoords(event.clientX, event.clientY);
        const hit = hitTestAt(cx, cy);
        if (connector.handlePick(hit?.id ?? null)) {
          event.preventDefault();
          return;
        }
      }
    }

    // ── Pan gesture (middle mouse OR space held OR left+Alt via original)
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
        // every member of the outermost group — matches original UX.
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
      // drag the DUPLICATES. Matches Sveltedraw original UX. The
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
      // moves as a container — original group-drag UX.
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
      // another editor. Matches Sveltedraw UX.
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

      // Pull style from `currentItem*` so shapes drawn after the user picks
      // a color / stroke in the StylePanel inherit that style. Previously
      // this hardcoded DEFAULT_ELEMENT_PROPS.* and the user saw "pick pink
      // fill + blue stroke → switch to rectangle → draw → comes out black"
      // because the tool factory never read the panel-chosen defaults.
      // `currentItem*` is kept in sync by `applyStyle` (see ~line 2150).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ap = appState as any;
      const baseOpts = {
        x,
        y,
        width: 1,
        height: 1,
        strokeColor: ap.currentItemStrokeColor ?? DEFAULT_ELEMENT_PROPS.strokeColor,
        backgroundColor: ap.currentItemBackgroundColor ?? DEFAULT_ELEMENT_PROPS.backgroundColor,
        fillStyle: ap.currentItemFillStyle ?? DEFAULT_ELEMENT_PROPS.fillStyle,
        strokeWidth: ap.currentItemStrokeWidth ?? DEFAULT_ELEMENT_PROPS.strokeWidth,
        strokeStyle: ap.currentItemStrokeStyle ?? DEFAULT_ELEMENT_PROPS.strokeStyle,
        roughness: ap.currentItemRoughness ?? DEFAULT_ELEMENT_PROPS.roughness,
        opacity: ap.currentItemOpacity ?? DEFAULT_ELEMENT_PROPS.opacity,
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
    // Phase 17 / A2: piggyback on native pointermove for cursor gossip.
    // Cheap (early-returns when collab is off; throttled when on) so
    // it never gates the rest of this hot path.
    broadcastCursor(event);

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
    // Laser pointer trail sample — delegated to plugin store. The plugin
    // owns the active flag + RAF loop + trail array; this hot-path
    // call early-returns when inactive (single boolean check) so no
    // perf cost when off. Container-relative coords because the
    // laser-pointer overlay is also container-relative.
    if (containerEl) {
      const laser = pluginRegistry.getStore<LaserStore>(LASER_STORE_KEY);
      if (laser?.isActive()) {
        const r = containerEl.getBoundingClientRect();
        laser.recordSample(event.clientX - r.left, event.clientY - r.top);
      }
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
        // Snap to 15° increments — matches original rotate-with-shift UX.
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((el: any) => !draggingIds.has(el.id))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((el: any) => ({
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
        // has "tool lock" on — original Q shortcut) or switch back
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
  // (matches Sveltedraw's UX: double-click is a quick way to add text
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
  // `sveltedraw--view-mode` also flips true for the element-link dialog per
  // original logic (dialog makes the canvas non-editable).
  const containerClass = $derived(
    [
      "sveltedraw",
      "sveltedraw-container",
      "notranslate",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState as any).theme === "dark" ? "theme--dark" : "",
      appState.viewModeEnabled ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (appState.openDialog as any)?.name === "elementLinkSelector"
        ? "sveltedraw--view-mode"
        : "",
      editorInterface.formFactor === "phone" ? "sveltedraw--mobile" : "",
      // Crosshair cursor while laser tool is active. Reads through
      // the plugin's LASER_REACTIVE_KEY view (returns a getter-backed
      // object so reading `.active` from inside this $derived tracks
      // through Svelte's $state proxy).
      pluginRegistry.getStore<LaserReactive>(LASER_REACTIVE_KEY)?.active ? "sveltedraw--laser" : "",
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

  // Toggle theme. Matches original's semantic: appState.theme is
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
     Same pattern as original React's `AppRenderHelpers.tsx:688` (`tabIndex=0`). -->
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

  <div class="sveltedraw-textEditorContainer"></div>
  <div class="sveltedraw-contextMenuContainer"></div>
  <div class="sveltedraw-eye-dropper-container"></div>

  <!-- Top-right utility bar: theme toggle + language picker. Kept
       minimal; original-style MainMenu is a Phase 7 concern. -->
  <!-- Main menu burger + dropdown — see components/MainMenu.svelte.
       Outside-click / Escape handling for `mainMenuOpen` lives below in
       the $effect; keep the .sveltedraw-main-menu / .sveltedraw-main-menu-trigger
       class names in sync with that code. -->
  <MainMenu
    bind:open={mainMenuOpen}
    theme={(appState as any).theme}
    gridEnabled={!!(appState as any).gridModeEnabled}
    onLoad={loadFromSveltedrawFile}
    onSave={saveAsSveltedrawFile}
    onExportPng={downloadPng}
    onExportSvg={downloadSvg}
    onToggleGrid={toggleGrid}
    onToggleTheme={toggleTheme}
    onOpenHelp={() => (helpDialogOpen = true)}
    onClearCanvas={clearCanvas}
  />

  <!-- Help dialog — keyboard shortcut reference. See components/HelpDialog.svelte. -->
  <HelpDialog open={helpDialogOpen} onClose={() => (helpDialogOpen = false)} />

  <!-- Welcome screen + tool-hint strip — see components/CanvasHintOverlay.svelte. -->
  <CanvasHintOverlay
    isEmptyScene={!!scene && scene.getNonDeletedElements().length === 0}
    activeToolType={(appState.activeTool as any)?.type}
    onOpenHelp={() => (helpDialogOpen = true)}
  />

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

  <!-- Zoom controls — see components/ZoomControls.svelte. -->
  <ZoomControls
    zoom={((appState.zoom as any).value || 1)}
    onZoomIn={() => zoomCentered(((appState.zoom as any).value || 1) + ZOOM_STEP)}
    onZoomOut={() => zoomCentered(((appState.zoom as any).value || 1) - ZOOM_STEP)}
    onReset={resetZoom}
  />

  <!-- Top-right utility bar — see components/UtilityBar.svelte. -->
  <UtilityBar
    libraryPanelOpen={libraryPanelOpen}
    theme={(appState as any).theme}
    libraryLabel={t("toolBar.library")}
    currentLangCode={currentLangCode}
    availableLanguages={availableLanguages}
    onToggleLibraryPanel={() => (libraryPanelOpen = !libraryPanelOpen)}
    onCreateFrame={createFrameAtCenter}
    onStartPresentation={handleStartPresentation}
    onToggleTheme={toggleTheme}
    onSetLanguage={setLanguage}
  />

  <!-- Phase 17: Live collaboration trigger. Tucked under the utility bar
       on the top-right. Click toggles join/leave; if no collab server is
       configured (VITE_COLLAB_SERVER or ?collab=ws://...) the button
       logs a warning and otherwise does nothing — Commit 4 will surface
       the misconfig as a toast. The collaborator badge mirrors the
       awareness Map size, populated from store.users (built via the
       awareness "change" listener inside joinRoom). -->
  <div class="sveltedraw-collab-trigger">
    <LiveCollaborationTrigger
      isCollaborating={collabStore.status === "connected"}
      onSelect={handleCollabButtonClick}
      width={appState.width}
      collaboratorCount={collabStore.users.size}
    />
    <!-- Phase 17 / A4: status pill. Shown only for transient/error
         states; idle hides it (no session) and connected hides it
         (the button itself already reads as active via its .active
         class). Putting the dot color in CSS rather than inline keeps
         theme overrides simple. -->
    {#if collabStore.status === "connecting"}
      <div class="sveltedraw-collab-status sveltedraw-collab-status--connecting">
        <span class="sveltedraw-collab-status__dot"></span>
        Connecting…
      </div>
    {:else if collabStore.status === "disconnected"}
      <div class="sveltedraw-collab-status sveltedraw-collab-status--disconnected">
        <span class="sveltedraw-collab-status__dot"></span>
        Disconnected
      </div>
    {/if}
  </div>

  <!-- Phase 17 / A3: identity capture dialog. Mounted only while open
       (avoids paying the Modal/portal cost when collab is dormant).
       pendingAnonId is always set when the dialog opens — see
       handleCollabButtonClick — so the `??` fallback is defensive only. -->
  {#if collabDialogOpen}
    <CollabIdentityDialog
      palette={COLLAB_PALETTE}
      suggestedId={pendingAnonId ?? makeAnonIdentity().id}
      onSubmit={onCollabIdentitySubmit}
      onCancel={onCollabIdentityCancel}
    />
  {/if}

  <!-- Phase 17 / A2: peer cursor overlay. Reads collab users from
       context; renders nothing when no peers have a cursor. We pass
       the appState slice the conversion needs as a prop so $derived
       tracks pan/zoom without round-tripping through context. -->
  <CollabCursors
    appState={{
      zoom: appState.zoom as { value: number },
      offsetLeft: appState.offsetLeft as number,
      offsetTop: appState.offsetTop as number,
      scrollX: appState.scrollX as number,
      scrollY: appState.scrollY as number,
    }}
  />

  <!-- Phase 17 / A4: connection status toast. Appears bottom-center
       on mid-session drop / reconnect; auto-dismisses on default 5s.
       Tone classes pick the background color via CSS. -->
  {#if collabToast}
    <div
      class="sveltedraw-collab-toast"
      class:sveltedraw-collab-toast--warn={collabToast.tone === "warn"}
      class:sveltedraw-collab-toast--ok={collabToast.tone === "ok"}
    >
      <Toast
        message={collabToast.message}
        onClose={() => (collabToast = null)}
        closable
      />
    </div>
  {/if}

  <!-- Connector tool indicator now lives in builtin/connector-tool
       plugin's PanelHost. Pointerdown handler routes through the
       plugin's store; the indicator panel mounts when the tool is
       active. -->

  <!-- Alignment / Measurement / Auto-Layout panels are now plugins:
       builtin/alignment-panel, builtin/measurement-panel,
       builtin/autolayout-panel. Each owns its toolbar button + side
       panel; App.svelte publishes a bridge so the plugins can call
       handleAlign / handleDistribute / handleAutoLayout and read
       measurementConfig. -->



  <!-- Grid & Snap, Layer, ShapeLibrary panels are now plugins:
       builtin/grid-panel, builtin/layer-panel, builtin/shape-library-
       panel. App.svelte publishes bridges (GRID_BRIDGE_KEY,
       LAYER_BRIDGE_KEY, SHAPE_LIBRARY_BRIDGE_KEY) so the plugins read
       reactive state + invoke handlers without owning them. -->

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

  <!-- Export panel mounts via the export-panel plugin (Tier 3 wave 3).
       The plugin registers a side panel with PanelHost as the component;
       App.svelte's `pluginRegistry.sidePanels` each-block (further down)
       mounts it. The PanelHost gates rendering on its own `state.active`. -->


  <!-- Floating bottom-left library panel — see components/FloatingLibraryPanel.svelte. -->
  {#if libraryPanelOpen}
    <FloatingLibraryPanel
      items={libraryItems}
      onInsert={(item) => insertLibraryItem(item as any)}
      onDelete={deleteLibraryItem}
      onClose={() => (libraryPanelOpen = false)}
    />
  {/if}

  <!-- Template selector — modal for choosing pre-made templates. -->
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

  <!-- Settings panel — user preferences. -->
  <!-- Help panel — comprehensive documentation. -->

  <!-- Plugin-contributed side panels. Each plugin owns its own open
       state internally, so we always mount its component (the plugin
       decides whether to render anything). Items are keyed by id so a
       plugin re-registering keeps the same DOM subtree. -->
  {#each pluginRegistry.sidePanels as panel (panel.id)}
    {@const PanelComponent = panel.component}
    <div class="sveltedraw-plugin-side-panel" data-panel-id={panel.id}>
      <PanelComponent />
    </div>
  {/each}

  <!-- Style panel. Shown whenever the editor is mounted; changes apply
       to the current selection OR to currentItem* defaults if none. -->
  <div class="sveltedraw-style-panel">
    <ColorRow
      label={t("labels.stroke")}
      type="elementStroke"
      color={panelStyle.strokeColor}
      elements={pickerElements}
      open={strokePickerOpen}
      onToggle={() => {
        strokePickerOpen = !strokePickerOpen;
        if (strokePickerOpen) bgPickerOpen = false;
      }}
      onClose={() => (strokePickerOpen = false)}
      onChange={(c) => applyStyle({ strokeColor: c })}
      container={containerEl}
    />

    {#if !allSelectedAreText && !allSelectedAreLinear}
      <ColorRow
        label={t("labels.background")}
        type="elementBackground"
        color={panelStyle.backgroundColor}
        elements={pickerElements}
        open={bgPickerOpen}
        onToggle={() => {
          bgPickerOpen = !bgPickerOpen;
          if (bgPickerOpen) strokePickerOpen = false;
        }}
        onClose={() => (bgPickerOpen = false)}
        onChange={(c) => applyStyle({ backgroundColor: c })}
        container={containerEl}
      />
    {/if}

    {#if !allSelectedAreText}
      <PresetIconRow
        label={t("labels.strokeWidth")}
        presets={STROKE_WIDTHS}
        current={panelStyle.strokeWidth}
        btnClass="sp-width"
        dataPreset="width"
        ariaLabelPrefix="Stroke width"
        onSelect={(v) => applyStyle({ strokeWidth: v })}
      >
        {#snippet iconFor(w)}
          <span style="display: inline-block; width: 18px; height: {w.value}px; background: #1e1e1e; border-radius: 1px;"></span>
        {/snippet}
      </PresetIconRow>

      <PresetIconRow
        label={t("labels.strokeStyle")}
        presets={STROKE_STYLES}
        current={panelStyle.strokeStyle}
        dataPreset="strokeStyle"
        ariaLabelPrefix="Stroke style"
        onSelect={(v) => applyStyle({ strokeStyle: v })}
      >
        {#snippet iconFor(s)}
          {#if s.value === "solid"}
            <StrokeStyleSolidIcon />
          {:else}
            <Icon name={s.icon} />
          {/if}
        {/snippet}
      </PresetIconRow>
    {/if}

    {#if !allSelectedAreText && !allSelectedAreLinear}
      <PresetIconRow
        label={t("labels.fill")}
        presets={FILL_STYLES}
        current={panelStyle.fillStyle}
        dataPreset="fillStyle"
        ariaLabelPrefix="Fill style"
        onSelect={(v) => applyStyle({ fillStyle: v })}
      />
    {/if}

    {#if !allSelectedAreText}
      <PresetIconRow
        label={t("labels.sloppiness")}
        presets={ROUGHNESS_PRESETS}
        current={panelStyle.roughness}
        dataPreset="roughness"
        ariaLabelPrefix="Roughness"
        onSelect={(v) => applyStyle({ roughness: v })}
      />
    {/if}

    {#if hasRoundableSelected}
      <EdgesRow
        hasRoundness={!!panelStyle.roundness}
        onSelect={applyRoundnessToSelection}
      />
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
      <PresetIconRow
        label="Start arrow"
        presets={ARROWHEAD_PRESETS}
        current={panelStyle.startArrowhead}
        dataPreset="startArrowhead"
        ariaLabelPrefix="Start arrow"
        onSelect={(v) => applyStyle({ startArrowhead: v })}
      >
        {#snippet iconFor(a)}{@render arrowheadIcon(a.value, true)}{/snippet}
      </PresetIconRow>
      <PresetIconRow
        label="End arrow"
        presets={ARROWHEAD_PRESETS}
        current={panelStyle.endArrowhead}
        dataPreset="endArrowhead"
        ariaLabelPrefix="End arrow"
        onSelect={(v) => applyStyle({ endArrowhead: v })}
      >
        {#snippet iconFor(a)}{@render arrowheadIcon(a.value, false)}{/snippet}
      </PresetIconRow>
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

      <FormatRow
        fontWeight={panelStyle.fontWeight}
        fontStyle={panelStyle.fontStyle}
        textDecoration={panelStyle.textDecoration}
        onApply={applyStyle}
      />

      <PresetIconRow
        label={t("labels.textAlign")}
        presets={TEXT_ALIGN_PRESETS}
        current={panelStyle.textAlign}
        dataPreset="textAlign"
        ariaLabelPrefix="Text align"
        onSelect={(v) => applyStyle({ textAlign: v })}
      />
      <PresetIconRow
        label="Vertical"
        presets={VERTICAL_ALIGN_PRESETS}
        current={panelStyle.verticalAlign}
        dataPreset="verticalAlign"
        ariaLabelPrefix="Vertical align"
        onSelect={(v) => applyStyle({ verticalAlign: v })}
      >
        {#snippet iconFor(v)}
          {@render verticalAlignIcon(v.value)}
        {/snippet}
      </PresetIconRow>
    {/if}

    <PresetIconRow
      label={t("labels.opacity")}
      presets={OPACITY_PRESETS}
      current={panelStyle.opacity}
      btnClass="sp-opacity"
      dataPreset="opacity"
      ariaLabelPrefix="Opacity"
      onSelect={(v) => applyStyle({ opacity: v })}
    >
      {#snippet iconFor(o)}{o.value}{/snippet}
    </PresetIconRow>

    {#if hasTextSelected}
      <!-- Font size — Small / Medium / Large / Extra large.
           Original's canonical values are 16 / 20 / 28 / 36. -->
      <PresetIconRow
        label={t("labels.fontSize")}
        presets={FONT_SIZE_PRESETS}
        current={panelStyle.fontSize}
        dataPreset="fontSize"
        ariaLabelPrefix=""
        onSelect={(v) => applyStyle({ fontSize: v })}
      />
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

    <!-- C1: drop shadow — extracted to ShadowPresetsRow.svelte. -->
    {#if Object.keys((appState as any).selectedElementIds ?? {}).length > 0}
      <ShadowPresetsRow
        current={panelStyle.shadow}
        onApply={(shadow) => applyStyle({ shadow })}
      />
    {/if}

    <!-- A9: line-height slider (text-only). Migrated from TextEditorPanel.
         Original stores lineHeight as a float multiplier (≈1.25 default). -->
    <!-- A9: line-height (text only) + rotation sliders — reuse StyleSliderRow. -->
    {#if hasTextSelected}
      <StyleSliderRow
        label="Line height"
        ariaLabel="Line height"
        min={1} max={3} step={0.05}
        value={panelStyle.lineHeight ?? 1.25}
        display={Number(panelStyle.lineHeight ?? 1.25).toFixed(2)}
        onInput={(v) => applyStyle({ lineHeight: v })}
      />
    {/if}
    {#if selectedElementsReactive.length === 1}
      {@const deg = Math.round(((panelStyle.angle ?? 0) * 180) / Math.PI)}
      <StyleSliderRow
        label="Rotation"
        ariaLabel="Rotation angle"
        min={0} max={360} step={1}
        value={deg}
        display={`${deg}°`}
        onInput={(v) => applyStyle({ angle: (v * Math.PI) / 180 })}
      />
    {/if}

    <!-- Lock + flip — extracted to ActionsRow.svelte. anyLocked reads
         via the reactive selection so the lock glyph stays in sync. -->
    {#if selectedElementsReactive.length > 0}
      <ActionsRow
        anyLocked={selectedElementsReactive.some((el: any) => el.locked)}
        onToggleLock={toggleLockSelected}
        onFlip={flipSelected}
      />
    {/if}
  </div>

  <StaticCanvas
    canvas={staticCanvas}
    {scale}
    appState={{ width: appState.width, height: appState.height }}
    renderConfig={undefined}
    render={noopRender}
  />

  <!-- A1: link chip overlay — extracted to LinkChip.svelte. -->
  <LinkChip
    linked={linkedSelected}
    zoom={(appState.zoom as any).value ?? 1}
    scrollX={((appState.scrollX as any) ?? 0)}
    scrollY={((appState.scrollY as any) ?? 0)}
  />

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

  <!-- A5: measurement overlays — extracted to MeasurementOverlay.svelte.
       Uses selectedElementsReactive (a $derived) so prop updates track
       selection + scene mutations across the component boundary. -->
  <MeasurementOverlay
    config={measurementConfig}
    selected={selectedElementsReactive}
    zoom={(appState.zoom as any).value ?? 1}
    scrollX={((appState.scrollX as any) ?? 0)}
    scrollY={((appState.scrollY as any) ?? 0)}
    gridSize={gridConfig.size}
    width={appState.width}
    height={appState.height}
    sceneNonce={sceneReady}
  />

  <!-- Laser pointer overlay now mounts via the laser-pointer plugin's
       canvas-overlay registration (z-index 20, decorative). -->

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

  <!-- Plugin-contributed canvas overlays. Stacked above the three canvas
       layers; pointer-events default off so plugins explicitly opt in.
       Sorted by zIndex so plugins can establish a deterministic order
       independent of registration time. The sort happens inside a
       $derived (canvasOverlaysSorted) so re-iteration only fires when
       the registry array mutates, not per render tick. -->
  {#each canvasOverlaysSorted as overlay (overlay.id)}
    {@const OverlayComponent = overlay.component}
    <div
      class="sveltedraw-plugin-canvas-overlay"
      data-overlay-id={overlay.id}
      style:z-index={overlay.zIndex}
      style:pointer-events={overlay.pointerEvents ? "auto" : "none"}
    >
      <OverlayComponent />
    </div>
  {/each}

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
        // is roughly accurate. Original uses a hidden span for exact
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
       to avoid touching original renderer configs. Position is in VIEWPORT
       coords; marqueeRect derivation factors zoom + scroll + offset. -->
  <!-- Canvas right-click context menu — see components/CanvasContextMenu.svelte.
       Outside-click / Escape closing is wired via the $effect above that
       watches `contextMenu`. -->
  {#if contextMenu}
    <CanvasContextMenu
      menu={contextMenu}
      clipboardEmpty={clipboardBuffer.length === 0}
      selectedCount={getSelectedElements().length}
      selectedHasLink={!!getSelectedElements()[0]?.link}
      onClose={closeContextMenu}
      onCopy={copySelectedToBuffer}
      onCut={() => { copySelectedToBuffer(); deleteSelected(); }}
      onPaste={() => {
        if (contextMenu) {
          const { x, y } = toSceneCoords(
            contextMenu.vpX + (appState.offsetLeft as number),
            contextMenu.vpY + (appState.offsetTop as number),
          );
          pasteFromBuffer(x, y);
        }
      }}
      onOpenLink={openLinkDialog}
      onDuplicate={duplicateSelected}
      onGroup={groupSelected}
      onUngroup={ungroupSelected}
      onSaveToLibrary={saveSelectionToLibrary}
      onBringForward={() => reorderSelected("forward")}
      onBringToFront={() => reorderSelected("front")}
      onSendBackward={() => reorderSelected("backward")}
      onSendToBack={() => reorderSelected("back")}
      onDelete={deleteSelected}
    />
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
  :global(.sveltedraw.theme--dark) .sveltedraw-link-modal {
    background: #1a1a1e;
    color: #e5e7ea;
  }

  /* A1: link chip — shown over a selected linked element so the user can
     jump to the URL without opening the dialog. */
  /* .sveltedraw-link-chip styles live in LinkChip.svelte now. */

  /* A2: laser overlay pinned over the canvas. pointer-events: none so the
     trail never blocks clicks on the underlying canvas. Z-index above the
     canvas layer but below side panels. */
  /* .sveltedraw-laser-overlay styles live in LaserOverlay.svelte now. */
  :global(.sveltedraw--laser) { cursor: crosshair; }
  :global(.sveltedraw--eraser) { cursor: crosshair; }

  /* D1: dark-mode overrides for orphan original components whose SCSS
     sidecars don't ship with theme--dark rules. Targets visible white-on-
     white patterns: dialogs, buttons, color pickers, dropdowns, menus. */
  :global(.sveltedraw.theme--dark .sveltedraw-button) {
    background: #2e2e36;
    color: #e5e7ea;
    border-color: #363636;
  }
  :global(.sveltedraw.theme--dark .sveltedraw-button:hover) {
    background: #363644;
  }
  :global(.sveltedraw.theme--dark .sveltedraw-button.selected) {
    background: #6965db;
    color: #fff;
  }
  :global(.sveltedraw.theme--dark .Dialog),
  :global(.sveltedraw.theme--dark .Dialog__content) {
    background: #232329;
    color: #e5e7ea;
    border-color: #363636;
  }
  :global(.sveltedraw.theme--dark .Dialog__title) { color: #e5e7ea; }
  :global(.sveltedraw.theme--dark .context-menu),
  :global(.sveltedraw.theme--dark .dropdown-menu-container) {
    background: #232329;
    color: #e5e7ea;
    border-color: #363636;
  }
  :global(.sveltedraw.theme--dark .context-menu-option),
  :global(.sveltedraw.theme--dark .dropdown-menu-item) {
    color: #e5e7ea;
  }
  :global(.sveltedraw.theme--dark .context-menu-option:hover),
  :global(.sveltedraw.theme--dark .dropdown-menu-item:hover),
  :global(.sveltedraw.theme--dark .dropdown-menu-item[data-highlighted]) {
    background: #2e2e36;
  }
  :global(.sveltedraw.theme--dark .color-picker-container),
  :global(.sveltedraw.theme--dark .color-picker-popover-content),
  :global(.sveltedraw.theme--dark .color-picker-content),
  :global(.sveltedraw.theme--dark .Picker),
  :global(.sveltedraw.theme--dark .picker-heading),
  :global(.sveltedraw.theme--dark .shade-list),
  :global(.sveltedraw.theme--dark .top-picks) {
    background: #232329;
    color: #e5e7ea;
    border-color: #363636;
  }
  :global(.sveltedraw.theme--dark .color-input-container),
  :global(.sveltedraw.theme--dark .color-input) {
    background: #2e2e36;
    color: #e5e7ea;
    border-color: #363636;
  }
  :global(.sveltedraw.theme--dark .active-confirm-dialog) {
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

  .sveltedraw-container {
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

  /* Canvas context menu styles live with components/CanvasContextMenu.svelte. */

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
  :global(.sveltedraw.theme--dark) .sveltedraw-toolbox {
    background: #232329;
    border-color: #363636;
  }
  .sveltedraw-toolbox .tb-sep {
    width: 1px;
    height: 22px;
    background: #e5e7ea;
    margin: 0 4px;
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-toolbox .tb-sep {
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
  :global(.sveltedraw.theme--dark) .sveltedraw-toolbox .sveltedraw-tool-btn {
    color: #e5e7ea;
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-toolbox .sveltedraw-tool-btn:hover {
    background: #2e2e36;
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-toolbox .sveltedraw-tool-btn.active {
    background: #3b3a66;
    border-color: #6965db;
    color: #b5b2ee;
  }
  :global(.sveltedraw-toolbox .sveltedraw-tool-btn svg) {
    width: 20px;
    height: 20px;
  }

  /* Zoom controls styles live with components/ZoomControls.svelte. */

  /* Main menu styles live with the component at components/MainMenu.svelte. */

  /* Help dialog styles live with the component at components/HelpDialog.svelte.
     The shared kbd styles below still apply to help/hint/welcome via :global. */
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
  :global(.sveltedraw.theme--dark .sveltedraw-help-card kbd),
  :global(.sveltedraw.theme--dark .sveltedraw-hint kbd),
  :global(.sveltedraw.theme--dark .sveltedraw-welcome kbd) {
    background: #2e2e36;
    border-color: #464651;
    color: #e5e7ea;
  }

  /* Welcome / tool-hint styles live with components/CanvasHintOverlay.svelte.
     Shared :global(kbd) rules above still target .sveltedraw-hint and
     .sveltedraw-welcome elements rendered by that component. */

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

  /* Utility bar styles live with components/UtilityBar.svelte. */

  /* FloatingLibraryPanel styles live with components/FloatingLibraryPanel.svelte. */

  /* Phase 17: LiveCollaborationTrigger placement. Sits below the utility
     bar (top: 56px ≈ utility bar bottom + 8px gap) so it doesn't overlap
     the language/theme controls. Button visuals come from the component's
     own SCSS sidecar; this rule is purely about position + z-index. */
  .sveltedraw-collab-trigger {
    position: absolute;
    top: 56px;
    right: 20px;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    /* Pill follows the button to its left so the row reads:
       [ status pill ] [ button ]. flex-direction reverse keeps the
       button anchored to the right edge of the trigger box. */
    flex-direction: row-reverse;
  }

  /* Phase 17 / A4: connection status pill. Sits next to the collab
     button while the session is in a non-steady state. The dot color
     is the only difference between connecting/disconnected; the rest
     of the box is theme-driven. */
  .sveltedraw-collab-status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--island-bg-color, #fff);
    border: 1px solid var(--border-color-medium, #d1d4da);
    color: var(--text-primary-color, #1b1b1f);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    white-space: nowrap;
    user-select: none;
  }

  .sveltedraw-collab-status__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .sveltedraw-collab-status--connecting .sveltedraw-collab-status__dot {
    background: #f59f00; /* amber */
    /* Pulse so users can tell connecting from "stuck" at a glance. */
    animation: sveltedraw-collab-pulse 1.2s ease-in-out infinite;
  }

  .sveltedraw-collab-status--disconnected .sveltedraw-collab-status__dot {
    background: #e03131; /* red */
  }

  @keyframes sveltedraw-collab-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  /* Phase 17 / A4: collab status toast container. Bottom-center
     placement matches typical app-level toast convention; the inner
     Toast component handles its own padding/typography. We only own
     positioning + the tone-driven background ring. */
  .sveltedraw-collab-toast {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
  }

  .sveltedraw-collab-toast--warn :global(.Toast) {
    border-left: 4px solid #f59f00;
  }

  .sveltedraw-collab-toast--ok :global(.Toast) {
    border-left: 4px solid #2f9e44;
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
  :global(.sveltedraw.theme--dark) .sveltedraw-connector-panel {
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
  :global(.sveltedraw.theme--dark) .sveltedraw-alignment-panel {
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
  :global(.sveltedraw.theme--dark) .sveltedraw-measurement-panel {
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
  :global(.sveltedraw.theme--dark) .sveltedraw-autolayout-panel {
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
  :global(.sveltedraw.theme--dark) .sveltedraw-grid-panel {
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
  :global(.sveltedraw.theme--dark) .sveltedraw-layer-panel {
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
  :global(.sveltedraw.theme--dark) .sveltedraw-history-panel {
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
  :global(.sveltedraw.theme--dark) .sveltedraw-shape-library-panel {
    background: #232329;
    border-color: #363636;
  }

  /* Plugin-contributed side panels. Container is a positioned slot so the
     plugin's own component can use absolute/fixed positioning relative to
     the editor root. The plugin controls all visual styling of its
     content; this rule establishes the stacking context only. */
  .sveltedraw-plugin-side-panel {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 40;
  }
  .sveltedraw-plugin-side-panel > :global(*) {
    pointer-events: auto;
  }

  /* Plugin-contributed canvas overlays. Sit between the canvas layers
     and the panel layer. z-index is set inline per overlay (style:z-index)
     so plugins control ordering without arbitrary CSS hacks. */
  .sveltedraw-plugin-canvas-overlay {
    position: absolute;
    inset: 0;
  }
</style>

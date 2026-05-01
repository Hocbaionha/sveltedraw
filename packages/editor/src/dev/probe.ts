// DEV-only test probe. Smoke scripts read `window.__sveltedrawProbe` to
// inspect live scene + appState and call helpers directly (avoids having to
// intercept blob downloads in headless Chrome). Tree-shaken in production.

// @ts-ignore
import { exportToBlob } from "@sveltedraw/utils/export";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;

export type ProbeBindings = {
  // Live state refs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
  getScene: () => AnyEl | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  binaryFiles: Record<string, AnyEl>;

  // Export helpers.
  exportAsPng: () => Promise<Blob | null>;
  exportAsSvg: () => Promise<SVGSVGElement | null>;

  // Library (legacy panel + Phase 16 component manager).
  saveSelectionToLibrary: () => void;
  insertLibraryItem: (item: AnyEl) => void;
  deleteLibraryItem: (id: string) => void;
  getLibraryItems: () => AnyEl[];
  getLibraryComponents: () => AnyEl[];
  saveComponentToLibrary: () => void;
  insertLibraryComponent: (c: AnyEl) => void;

  // Side panels (mutual-exclusion toggling).
  toggleSidePanel: (name: string) => void;
  closeAllSidePanels: () => void;
  isSidePanelOpen: (name: string) => boolean;

  // Export pipeline.
  handleExport: (opts: AnyEl) => Promise<void> | void;

  // Presentation.
  startPresentation: () => Promise<void> | void;
  exitPresentation: () => void;
  getPresentationSlides: () => AnyEl[];
  getPresentationSlideSvgs: () => string[];
  isPresentationActive: () => boolean;
  setAutoAdvanceDuration: (ms: number) => void;
  setPresentationPlaying: (v: boolean) => void;
  getPresentationCurrentIndex: () => number;
  /** Test-only: seed N fake slides bypassing handleStartPresentation. */
  forcePresentationSlides: (n: number) => void;

  // History.
  getEditorHistory: () => AnyEl[];
  getHistoryCurrentIndex: () => number;
  getHistoryLen: () => number;
  jumpHistory: (i: number) => void;
  clearHistory: () => void;
  pushHistory: () => void;

  // Bound-arrow test helper: force-route arrows after moving a shape.
  updateBoundElementsHook: (el: AnyEl) => void;

  // Repaint trigger (for tests that mutate scene outside the pointer-event path).
  bumpSceneRepaint: () => void;

  // Snap / grid config (A4/A6).
  getSnapConfig: () => AnyEl;
  getGridConfig: () => AnyEl;
  setSnapConfig: (patch: AnyEl) => void;
  setGridConfig: (patch: AnyEl) => void;

  // A1 link dialog.
  openLinkDialog: () => void;
  closeLinkDialog: () => void;
  confirmLinkDialog: (v: string | null) => void;
  isLinkDialogOpen: () => boolean;

  // Wave B.1 — z-order. Bypasses the action predicate (which gates
  // on selection size) so smokes can exercise the plugin's own
  // defense-in-depth guards.
  reorderSelected: (direction: "forward" | "backward" | "front" | "back") => void;
  // Wave B.2 — group / ungroup. Same probe-bypass rationale.
  groupSelected: () => void;
  ungroupSelected: () => void;

  // A2 laser.
  toggleLaser: () => void;
  isLaserActive: () => boolean;
  getLaserTrailLen: () => number;

  // A5 measurement.
  setMeasurementConfig: (patch: AnyEl) => void;
  getMeasurementConfig: () => AnyEl;

  // B4 PNG metadata round-trip.
  tryRestoreSceneFromPng: (b: Blob) => Promise<boolean> | boolean;

  // C2 flip.
  flipSelected: (axis: "horizontal" | "vertical") => void;

  // B1 frame creation.
  createFrameAtCenter: () => string | undefined;

  // Style-panel dispatch (same function the real <ColorPicker> / stroke
  // buttons call). Used by honest-tests/style-persists-to-next-drawn.mjs
  // to drive the exact `applyStyle` code path without simulating clicks.
  applyStyle: (patch: Record<string, unknown>) => void;

  // Toolbar dispatch: switches `appState.activeTool` via the same path the
  // toolbar buttons use. Exposed for honest-tests that drive tool-switching
  // flows (style → tool → draw).
  setActiveTool: (type: string) => void;

  // Phase 17 — collab session inspector. Returns a JSON-safe snapshot so
  // CDP-driven tests can read connection state without tunneling live
  // reactive proxies through Runtime.evaluate.
  getCollabState: () => {
    status: string;
    userCount: number;
    myUserId: string | null;
    roomId: string | null;
  };

  // ActionManager handle. Smoke scripts use this to introspect the
  // registered action set + dispatch by id without going through the
  // keyboard handler. Returned object exposes only the safe surface
  // (execute / list / executeKey / get) — not the internal hotkey index.
  getActionManager: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    list: () => any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: (id: string, payload?: any) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executeKey: (event: KeyboardEvent) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (id: string) => any;
  };
};

export function installSveltedrawProbe(b: ProbeBindings): void {
  if (typeof window === "undefined") return;

  // B4: generate a PNG blob with embedded Sveltedraw scene metadata.
  // Mirrors the export pipeline but adds the tEXt chunk so the paste
  // round-trip test can verify restoration without touching the UI.
  const exportPngWithMetadata = async (): Promise<Blob | null> => {
    const scene = b.getScene();
    if (!scene) return null;
    const elements = scene.getNonDeletedElements();
    const blob = await exportToBlob({
      elements,
      appState: { ...b.appState, exportBackground: true, exportScale: 1 },
      files: b.binaryFiles,
      mimeType: "image/png",
      quality: 0.92,
      exportPadding: 10,
    });
    const { encodePngMetadata } = await import("@sveltedraw/engine/data/image");
    return encodePngMetadata({
      blob,
      metadata: JSON.stringify({
        type: "sveltedraw",
        version: 2,
        source: window.location.origin,
        elements,
        appState: { viewBackgroundColor: b.appState.viewBackgroundColor },
        files: b.binaryFiles,
      }),
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__sveltedrawProbe = {
    appState: b.appState,
    get scene() {
      return b.getScene();
    },
    exportAsPng: b.exportAsPng,
    exportAsSvg: b.exportAsSvg,
    saveSelectionToLibrary: b.saveSelectionToLibrary,
    insertLibraryItem: b.insertLibraryItem,
    deleteLibraryItem: b.deleteLibraryItem,
    getLibraryItems: b.getLibraryItems,
    toggleSidePanel: b.toggleSidePanel,
    closeAllSidePanels: b.closeAllSidePanels,
    isSidePanelOpen: b.isSidePanelOpen,
    handleExport: b.handleExport,
    startPresentation: b.startPresentation,
    exitPresentation: b.exitPresentation,
    getPresentationSlides: b.getPresentationSlides,
    getPresentationSlideSvgs: b.getPresentationSlideSvgs,
    isPresentationActive: b.isPresentationActive,
    getLibraryComponents: b.getLibraryComponents,
    saveComponentToLibrary: b.saveComponentToLibrary,
    insertLibraryComponent: b.insertLibraryComponent,
    getEditorHistory: b.getEditorHistory,
    getHistoryCurrentIndex: b.getHistoryCurrentIndex,
    jumpHistory: b.jumpHistory,
    clearHistory: b.clearHistory,
    pushHistory: b.pushHistory,
    updateBoundElements: b.updateBoundElementsHook,
    bumpSceneRepaint: b.bumpSceneRepaint,
    getSnapConfig: b.getSnapConfig,
    getGridConfig: b.getGridConfig,
    setSnapConfig: b.setSnapConfig,
    setGridConfig: b.setGridConfig,
    openLinkDialog: b.openLinkDialog,
    closeLinkDialog: b.closeLinkDialog,
    confirmLinkDialog: b.confirmLinkDialog,
    isLinkDialogOpen: b.isLinkDialogOpen,
    reorderSelected: b.reorderSelected,
    groupSelected: b.groupSelected,
    ungroupSelected: b.ungroupSelected,
    toggleLaser: b.toggleLaser,
    isLaserActive: b.isLaserActive,
    getLaserTrailLen: b.getLaserTrailLen,
    setMeasurementConfig: b.setMeasurementConfig,
    getMeasurementConfig: b.getMeasurementConfig,
    exportPngWithMetadata,
    tryRestoreSceneFromPng: b.tryRestoreSceneFromPng,
    flipSelected: b.flipSelected,
    setAutoAdvanceDuration: b.setAutoAdvanceDuration,
    setPresentationPlaying: b.setPresentationPlaying,
    getPresentationCurrentIndex: b.getPresentationCurrentIndex,
    createFrameAtCenter: b.createFrameAtCenter,
    forcePresentationSlides: b.forcePresentationSlides,
    applyStyle: b.applyStyle,
    setActiveTool: b.setActiveTool,
    getCollabState: b.getCollabState,
    getActionManager: b.getActionManager,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__sveltedrawHistoryLen = b.getHistoryLen;
}

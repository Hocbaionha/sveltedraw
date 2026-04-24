// Phase 16 Feature 2 — shape library / component manager handlers.
// Save selection → component, insert component into the scene at viewport
// center, delete, JSON export/import.

// @ts-ignore — upstream
import { deepCopyElement } from "@excalidraw/element";
// @ts-ignore — upstream
import { randomId } from "@excalidraw/common";
import {
  createLibraryComponent,
  type LibraryComponent,
} from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;
type SceneLike = {
  getElementsIncludingDeleted: () => AnyEl[];
  replaceAllElements: (els: AnyEl[], opts?: { skipValidation?: boolean }) => void;
};

export type LibraryDeps = {
  getScene: () => SceneLike | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
  pushHistory: () => void;
  bumpSceneRepaint: () => void;
  getSelectedElements: () => AnyEl[];
  getLibraryComponents: () => LibraryComponent[];
  setLibraryComponents: (components: LibraryComponent[]) => void;
  /** Mutate-in-place is fine for the usage counter. */
  bumpComponentUsage: (componentId: string) => void;
  getLibrarySelectedCategory: () => string;
};

export type LibraryHandlers = {
  saveComponentToLibrary: () => void;
  insertComponent: (component: LibraryComponent) => void;
  deleteComponent: (componentId: string) => void;
  exportLibrary: () => void;
  importLibrary: () => void;
};

export function createLibraryHandlers(deps: LibraryDeps): LibraryHandlers {
  const {
    getScene,
    appState,
    pushHistory,
    bumpSceneRepaint,
    getSelectedElements,
    getLibraryComponents,
    setLibraryComponents,
    bumpComponentUsage,
    getLibrarySelectedCategory,
  } = deps;

  const saveComponentToLibrary = () => {
    const selected = getSelectedElements();
    if (selected.length === 0) return;

    const components = getLibraryComponents();
    const name = window.prompt("Component name", `Component ${components.length + 1}`);
    if (name === null) return;

    const selectedCategory = getLibrarySelectedCategory();
    const category = selectedCategory === "all" ? "custom" : selectedCategory;
    const component = createLibraryComponent(name, category, selected);
    setLibraryComponents([...components, component]);
  };

  const insertComponent = (component: LibraryComponent) => {
    const scene = getScene();
    if (!scene) return;
    if (!Array.isArray(component.elements) || component.elements.length === 0) {
      return;
    }

    // Translate to viewport center: compute min(x,y) of the component's bbox
    // and shift so the component lands where the user is looking.
    let minX = Infinity;
    let minY = Infinity;
    for (const el of component.elements as AnyEl[]) {
      if (typeof el.x === "number" && el.x < minX) minX = el.x;
      if (typeof el.y === "number" && el.y < minY) minY = el.y;
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      minX = 0;
      minY = 0;
    }
    const zoomV = appState.zoom?.value || 1;
    const scrollX = appState.scrollX ?? 0;
    const scrollY = appState.scrollY ?? 0;
    const targetSceneX = appState.width / 2 / zoomV - scrollX;
    const targetSceneY = appState.height / 2 / zoomV - scrollY;
    const tx = targetSceneX - minX;
    const ty = targetSceneY - minY;

    // Fresh ids so repeat inserts don't collide. Preserve intra-component
    // group relations by remapping groupIds consistently within this insert.
    const idRemap = new Map<string, string>();
    const groupRemap = new Map<string, string>();
    for (const el of component.elements as AnyEl[]) {
      idRemap.set(el.id, randomId());
      for (const gid of (el.groupIds as string[]) ?? []) {
        if (!groupRemap.has(gid)) groupRemap.set(gid, randomId());
      }
    }

    const fresh = component.elements.map((el: AnyEl) => ({
      ...deepCopyElement(el),
      id: idRemap.get(el.id)!,
      x: (el.x ?? 0) + tx,
      y: (el.y ?? 0) + ty,
      groupIds: ((el.groupIds as string[]) ?? []).map(
        (g) => groupRemap.get(g) ?? g,
      ),
      // Re-index so fractionalIndices regenerate fresh on replaceAllElements.
      index: null,
      version: 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: Date.now(),
    }));

    const existing = scene.getElementsIncludingDeleted();
    scene.replaceAllElements([...existing, ...fresh], { skipValidation: true });
    const nextSel: Record<string, true> = {};
    for (const el of fresh) nextSel[el.id] = true;
    appState.selectedElementIds = nextSel;

    bumpComponentUsage(component.id);

    pushHistory();
    bumpSceneRepaint();
  };

  const deleteComponent = (componentId: string) => {
    const components = getLibraryComponents();
    setLibraryComponents(components.filter((c) => c.id !== componentId));
  };

  const exportLibrary = () => {
    const json = JSON.stringify(getLibraryComponents(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shape-library-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importLibrary = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target?.result as string);
          if (Array.isArray(imported)) {
            setLibraryComponents([...getLibraryComponents(), ...imported]);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("Failed to import library:", err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return {
    saveComponentToLibrary,
    insertComponent,
    deleteComponent,
    exportLibrary,
    importLibrary,
  };
}

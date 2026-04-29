// Phase 15 layer-management handlers (panel + sync). App.svelte owns the
// `layers` / `selectedLayerId` / `expandedGroups` $state vars; this factory
// receives them via getters/setters/refs so reactivity stays in the host.

// @ts-ignore — upstream
import { randomId } from "@excalidraw/common";
import { getLayerName, type LayerItem } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;

type SceneLike = {
  getNonDeletedElements: () => AnyEl[];
  getNonDeletedElementsMap: () => Map<string, AnyEl>;
  replaceAllElements: (els: AnyEl[], opts?: { skipValidation?: boolean }) => void;
};

export type LayerDeps = {
  getScene: () => SceneLike | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
  pushHistory: () => void;
  bumpSceneRepaint: () => void;
  getSelectedElements: () => AnyEl[];
  getLayers: () => LayerItem[];
  setLayers: (layers: LayerItem[]) => void;
  setSelectedLayerId: (id: string | null) => void;
  /** Set is mutated in place (.add/.delete) — passing the proxy is fine. */
  expandedGroups: Set<string>;
};

export type LayerHandlers = {
  syncLayersFromScene: () => void;
  syncSelectionFromCanvas: () => void;
  handleLayerSelect: (layerId: string) => void;
  handleReorderLayers: (fromId: string, toId: string) => void;
  handleLayerVisibilityChange: (layerId: string, visible: boolean) => void;
  handleLayerLockChange: (layerId: string, locked: boolean) => void;
  handleLayerOpacityChange: (layerId: string, opacity: number) => void;
  handleCreateGroup: () => void;
  handleDeleteGroup: (groupId: string) => void;
};

export function createLayerHandlers(deps: LayerDeps): LayerHandlers {
  const {
    getScene,
    appState,
    pushHistory,
    bumpSceneRepaint,
    getSelectedElements,
    getLayers,
    setLayers,
    setSelectedLayerId,
    expandedGroups,
  } = deps;

  const syncLayersFromScene = () => {
    const scene = getScene();
    if (!scene) return;
    const elements = scene.getNonDeletedElements();
    const layers = getLayers();

    // Skip rebuild if element membership is unchanged.
    const currentElementIds = new Set(
      layers.filter((l) => l.type === "element").map((l) => l.id),
    );
    const newElementIds = new Set(elements.map((el) => el.id));

    let hasChanges = currentElementIds.size !== newElementIds.size;
    if (!hasChanges) {
      for (const id of newElementIds) {
        if (!currentElementIds.has(id)) {
          hasChanges = true;
          break;
        }
      }
    }
    if (!hasChanges) return;

    const newLayers: LayerItem[] = [];

    // Carry existing groups forward.
    for (const layer of layers) {
      if (layer.type === "group") newLayers.push(layer);
    }

    // Ungrouped elements first.
    for (let idx = 0; idx < elements.length; idx++) {
      const el = elements[idx];
      const groupId = (el as AnyEl).__layerGroupId;
      if (!groupId) {
        newLayers.push({
          id: el.id,
          name: (el as AnyEl).customLayerName || getLayerName(el),
          visible: el.opacity !== 0,
          locked: el.locked || false,
          opacity: (el as AnyEl).__hiddenOpacity ?? el.opacity ?? 100,
          type: "element" as const,
          order: idx,
        });
      }
    }

    // Group children appended after their group entry.
    for (const layer of newLayers) {
      if (layer.type === "group" && layer.children) {
        for (const childId of layer.children) {
          const el = elements.find((e) => e.id === childId);
          if (el) {
            newLayers.push({
              id: el.id,
              name: (el as AnyEl).customLayerName || getLayerName(el),
              visible: el.opacity !== 0,
              locked: el.locked || false,
              opacity: (el as AnyEl).__hiddenOpacity ?? el.opacity ?? 100,
              type: "element" as const,
              parentId: layer.id,
              order: newLayers.length,
            });
          }
        }
      }
    }

    setLayers(newLayers);
  };

  const handleLayerSelect = (layerId: string) => {
    setSelectedLayerId(layerId);
    const scene = getScene();
    if (!scene) return;
    const element = scene.getNonDeletedElementsMap().get(layerId);
    if (element) {
      appState.selectedElementIds = { [layerId]: true };
      bumpSceneRepaint();
    }
  };

  const syncSelectionFromCanvas = () => {
    const selected = getSelectedElements();
    if (selected.length === 0) {
      setSelectedLayerId(null);
    } else {
      setSelectedLayerId(selected[0].id);
    }
  };

  const handleReorderLayers = (fromId: string, toId: string) => {
    const scene = getScene();
    if (!scene || fromId === toId) return;

    const elements = scene.getNonDeletedElements();
    const fromIndex = elements.findIndex((el) => el.id === fromId);
    const toIndex = elements.findIndex((el) => el.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    if (fromIndex < toIndex) {
      // Move down (towards lower z-order).
      for (let i = fromIndex; i < toIndex; i++) {
        const temp = elements[i];
        elements[i] = elements[i + 1];
        elements[i + 1] = temp;
      }
    } else {
      // Move up (towards higher z-order).
      for (let i = fromIndex; i > toIndex; i--) {
        const temp = elements[i];
        elements[i] = elements[i - 1];
        elements[i - 1] = temp;
      }
    }

    scene.replaceAllElements(elements, { skipValidation: true });
    pushHistory();
    bumpSceneRepaint();
    syncLayersFromScene();
  };

  const handleLayerVisibilityChange = (layerId: string, visible: boolean) => {
    const scene = getScene();
    if (!scene) return;
    // Use opacity=0 instead of isDeleted so the element is still exported,
    // participates in selection, and is tracked by getNonDeletedElements().
    const element = scene.getNonDeletedElementsMap().get(layerId);
    if (!element) return;
    if (!visible) {
      // Stash the real opacity so we can restore it on re-show.
      if (element.__hiddenOpacity === undefined) {
        element.__hiddenOpacity = element.opacity ?? 100;
      }
      element.opacity = 0;
    } else {
      element.opacity = element.__hiddenOpacity ?? 100;
      delete element.__hiddenOpacity;
    }
    pushHistory();
    bumpSceneRepaint();
    syncLayersFromScene();
  };

  const handleLayerLockChange = (layerId: string, locked: boolean) => {
    const scene = getScene();
    if (!scene) return;
    const element = scene.getNonDeletedElementsMap().get(layerId);
    if (!element) return;
    element.locked = locked;
    pushHistory();
    bumpSceneRepaint();
    syncLayersFromScene();
  };

  const handleLayerOpacityChange = (layerId: string, opacity: number) => {
    const scene = getScene();
    if (!scene) return;
    const element = scene.getNonDeletedElementsMap().get(layerId);
    if (!element) return;
    element.opacity = Math.max(0, Math.min(1, opacity));
    pushHistory();
    bumpSceneRepaint();
    syncLayersFromScene();
  };

  const handleCreateGroup = () => {
    const scene = getScene();
    if (!scene) return;
    const selected = getSelectedElements();
    if (selected.length === 0) return;

    const groupId = randomId();
    const layers = getLayers();
    const groupName = `Group ${layers.filter((l) => l.type === "group").length + 1}`;

    for (const el of selected) {
      (el as AnyEl).__layerGroupId = groupId;
    }

    setLayers([
      {
        id: groupId,
        name: groupName,
        visible: true,
        locked: false,
        opacity: 1,
        type: "group" as const,
        children: selected.map((el) => el.id),
        order: 0,
      },
      ...layers,
    ]);

    pushHistory();
    bumpSceneRepaint();
    expandedGroups.add(groupId);
  };

  const handleDeleteGroup = (groupId: string) => {
    const scene = getScene();
    if (!scene) return;
    const layers = getLayers();
    const groupIndex = layers.findIndex(
      (l) => l.id === groupId && l.type === "group",
    );
    if (groupIndex === -1) return;

    for (const el of scene.getNonDeletedElements()) {
      if ((el as AnyEl).__layerGroupId === groupId) {
        delete (el as AnyEl).__layerGroupId;
      }
    }

    setLayers(layers.filter((l) => l.id !== groupId));
    expandedGroups.delete(groupId);

    pushHistory();
    bumpSceneRepaint();
  };

  return {
    syncLayersFromScene,
    syncSelectionFromCanvas,
    handleLayerSelect,
    handleReorderLayers,
    handleLayerVisibilityChange,
    handleLayerLockChange,
    handleLayerOpacityChange,
    handleCreateGroup,
    handleDeleteGroup,
  };
}

// Bridge for the Layer panel. The layers + selectedLayerId + handlers
// all live in App.svelte (the layer factory needs scene + appState +
// pushHistory + bumpSceneRepaint, all owned by the editor). Plugin
// reads layers + invokes handlers through this bridge.

import type { LayerItem } from "../../../layers/types.js";

export const LAYER_BRIDGE_KEY: unique symbol = Symbol("layerPanelBridge");

export type LayerBridge = {
  /** Reactive: current layer tree. */
  readonly layers: readonly LayerItem[];
  /** Reactive: id of the currently-selected layer (null = none). */
  readonly selectedLayerId: string | null;
  onLayerSelect(id: string): void;
  onLayerVisibilityChange(id: string, visible: boolean): void;
  onLayerLockChange(id: string, locked: boolean): void;
  onLayerOpacityChange(id: string, opacity: number): void;
  onCreateGroup(): void;
  onDeleteGroup(id: string): void;
  onReorderLayers(fromId: string, toId: string): void;
};

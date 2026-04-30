// Bridge for the Grid + Snap panel. The configs live in App.svelte
// because snap config drives runtime drag math (pointer-move handler
// reads snapConfig + gridConfig.size). Plugin owns the panel UI but
// reads/writes through this bridge.

import type { GridConfig, SnapConfig } from "../../../snap/types.js";

export const GRID_BRIDGE_KEY: unique symbol = Symbol("gridPanelBridge");

export type GridBridge = {
  /** Reactive: current grid config snapshot. */
  readonly gridConfig: GridConfig;
  /** Reactive: current snap config snapshot. */
  readonly snapConfig: SnapConfig;
  setGridConfig(next: GridConfig): void;
  setSnapConfig(next: SnapConfig): void;
};

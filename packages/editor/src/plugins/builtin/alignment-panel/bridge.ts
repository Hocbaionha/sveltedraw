// Bridge App.svelte publishes so the alignment panel plugin can
// invoke the editor's existing alignment handlers (which are also
// driven by keyboard shortcuts inside App.svelte). The factory lives
// at ./alignment/handlers in the editor package; the plugin reads
// it through this bridge to avoid duplicating the wiring.

import type { AlignmentType, DistributionType } from "../../../alignment/types.js";

export const ALIGNMENT_BRIDGE_KEY: unique symbol =
  Symbol("alignmentPanelBridge");

export type AlignmentBridge = {
  /** Reactive: number of currently selected elements. */
  readonly selectedCount: number;
  align(type: AlignmentType): void;
  distribute(type: DistributionType): void;
};

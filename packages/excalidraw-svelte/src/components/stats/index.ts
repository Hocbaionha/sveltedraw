// Barrel for Stats primitives.
// Per-property components (Position/Dimension/Angle/FontSize + Multi*) are
// deferred to Phase 6 — they're ~2,000 lines of Scene mutation logic that
// would have nothing to wire to before App.svelte exists.

export { default as StatsDragInput } from "./DragInput.svelte";
export type {
  DragInputCallbackArgs,
  DragFinishedCallbackArgs,
} from "./DragInput.svelte";

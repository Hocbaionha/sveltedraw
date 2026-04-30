// Bridge between App.svelte and the laser-pointer plugin.
//
// width/height come from App.svelte's appState — the SVG overlay
// uses them for its viewBox. Container-rect math stays in App.svelte's
// pointermove handler since that's where event.clientX/Y live; the
// plugin's recordSample(x, y) takes already-container-relative coords.

export const LASER_BRIDGE_KEY: unique symbol = Symbol("laserBridge");

export type LaserBridge = {
  /** Reactive: editor canvas width (for the SVG viewBox). */
  readonly width: number;
  /** Reactive: editor canvas height. */
  readonly height: number;
};

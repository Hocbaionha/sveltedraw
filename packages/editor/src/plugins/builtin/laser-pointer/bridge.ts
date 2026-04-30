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

/**
 * Reactive view published BY the laser plugin (not by App.svelte).
 * Lets App.svelte read the active flag inside reactive contexts
 * ($derived, $effect) — calling pluginRegistry.getStore<LaserStore>()
 * .isActive() doesn't track the underlying $state because the
 * function call boundary swallows the reactive read.
 *
 * The plugin's install() publishes a getter that returns state.active
 * directly off the $state proxy, so any consumer reading
 * `view.active` from inside a $derived gets proper tracking.
 */
export const LASER_REACTIVE_KEY: unique symbol = Symbol("laserReactive");

export type LaserReactive = {
  /** Reactive: true when the laser tool is on. Read inside $derived /
   *  $effect to get reactivity through the property access. */
  readonly active: boolean;
};

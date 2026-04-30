// Built-in plugin: Laser pointer.
//
// Tier 3 migration. The plugin owns:
//   - active flag + trail array + frame counter (drives overlay opacity)
//   - RAF loop pruning samples older than LASER_FADE_MS
//   - toolbar button + canvas overlay registration via the registry
//   - LASER_STORE_KEY for App.svelte's pointermove handler to call
//     recordSample(x, y) with container-relative coords.
//
// App.svelte keeps the pointermove handler integration because it's
// the one with access to event.clientX/Y + container.getBoundingClient
// Rect(). The plugin handles all timing + state + render.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState, type LaserPoint } from "./state.svelte.js";
import { LASER_BRIDGE_KEY, type LaserBridge } from "./bridge.js";
import Overlay, { bindOverlay } from "./Overlay.svelte";
import LaserIcon from "./Icon.svelte";

export const LASER_STORE_KEY: unique symbol = Symbol("laserStore");

const LASER_FADE_MS = 800;

export type LaserStore = {
  /** Reactive read: returns true while the laser tool is on. Reads
   *  the underlying $state proxy directly, so consumers calling this
   *  inside a $derived/$effect get tracked. (Combined with the
   *  registry's storesVersion counter, the very first call after a
   *  plugin install is also reactive.) */
  isActive(): boolean;
  /** Toggle on/off. Re-arms the RAF loop on enable; clears the trail
   *  on disable. */
  toggle(): void;
  /** Cancel: turn off + clear trail. */
  cancel(): void;
  /** App.svelte calls this from pointermove with container-relative
   *  coords. Cheap when inactive (early-returns). */
  recordSample(x: number, y: number): void;
  /** Current trail sample count — for honest-tests / smoke probes. */
  trailLength(): number;
};

export { LASER_BRIDGE_KEY };
export type { LaserBridge };

export const laserPointerPlugin: SveltedrawPlugin = {
  id: "builtin/laser-pointer",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    const bridge = ctx.getStore<LaserBridge>(LASER_BRIDGE_KEY) ?? null;

    bindOverlay({ state, bridge, fadeMs: LASER_FADE_MS });

    // RAF loop — prunes samples older than LASER_FADE_MS, bumps frame
    // so LaserOverlay re-renders even when the pointer is stationary.
    // Loop self-cancels when active flag turns off AND trail empties.
    let rafId: number | null = null;

    const prune = (): void => {
      const cutoff = performance.now() - LASER_FADE_MS;
      let i = 0;
      while (i < state.trail.length && state.trail[i].t < cutoff) i++;
      if (i > 0) state.trail = state.trail.slice(i);
      state.frame++;
      if (state.active || state.trail.length > 0) {
        rafId = requestAnimationFrame(prune);
      } else {
        rafId = null;
      }
    };

    const startRaf = (): void => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(prune);
    };

    const cancel = (): void => {
      state.active = false;
      state.trail = [];
      // Don't kill the RAF here — let the loop's own self-cancel run
      // after the current frame so the fade-out animation completes.
    };

    const store: LaserStore = {
      isActive: () => state.active,
      toggle: () => {
        state.active = !state.active;
        if (state.active) {
          startRaf();
        } else {
          state.trail = [];
        }
      },
      cancel,
      recordSample: (x: number, y: number) => {
        if (!state.active) return;
        const sample: LaserPoint = { x, y, t: performance.now() };
        state.trail = [...state.trail, sample];
        startRaf();
      },
      trailLength: () => state.trail.length,
    };
    const releaseStore = ctx.provideStore(LASER_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "toggle",
      icon: LaserIcon,
      title: "Laser pointer (K)",
      group: "drawing",
      isActive: () => state.active,
      onActivate: () => store.toggle(),
    });

    const removeCanvasOverlay = ctx.addCanvasOverlay({
      id: "overlay",
      component: Overlay,
      // SVG laser overlay sits above the static/interactive canvases
      // (z-index 1-10) but below side panels (40+).
      zIndex: 20,
      // Decorative — never intercepts pointer events.
      pointerEvents: false,
    });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      releaseStore();
      removeToolbarItem();
      removeCanvasOverlay();
    };
  },
};

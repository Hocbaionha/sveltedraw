// Built-in plugin: Measurement panel. Exclusive side panel.
//
// The plugin owns the open/closed flag; reads selection + config
// (and writes config back) through MeasurementBridge published by
// App.svelte. The editor keeps the canonical measurementConfig
// $state because other code (snap math, probe surface) reads it
// too — bridging avoids duplicating ownership.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import {
  MEASUREMENT_BRIDGE_KEY,
  type MeasurementBridge,
} from "./bridge.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import MeasurementIcon from "./Icon.svelte";

export const MEASUREMENT_PANEL_STORE_KEY: unique symbol =
  Symbol("measurementPanelStore");

export type MeasurementPanelStore = {
  open(): void;
  close(): void;
  toggle(): void;
};

export { MEASUREMENT_BRIDGE_KEY };
export type { MeasurementBridge };

export const measurementPanelPlugin: SveltedrawPlugin = {
  id: "builtin/measurement-panel",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    const bridge = ctx.getStore<MeasurementBridge>(MEASUREMENT_BRIDGE_KEY) ?? null;
    bindPanelHost({ state, bridge });

    const store: MeasurementPanelStore = {
      open: () => {
        if (!state.open) ctx.toggleExclusiveSidePanel("panel");
      },
      close: () => (state.open = false),
      toggle: () => {
        ctx.toggleExclusiveSidePanel("panel");
      },
    };
    const releaseStore = ctx.provideStore(MEASUREMENT_PANEL_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: MeasurementIcon,
      title: "Measurement",
      group: "view",
      isActive: () => state.open,
      onActivate: () => store.toggle(),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Measurement",
      triggerIcon: MeasurementIcon,
      component: PanelHost,
      exclusive: true,
      isOpen: () => state.open,
      setOpen: (v) => {
        state.open = v;
      },
    });

    return () => {
      releaseStore();
      removeToolbarItem();
      removeSidePanel();
    };
  },
};

// Built-in plugin: Connector tool.
//
// First Tier 3 plugin — pointer-handler-coupled. The plugin owns the
// active flag + first-pick state, but App.svelte's pointerdown handler
// still drives the actual hit-test loop because it has direct access
// to hitTestAt + toSceneCoords + the event. The pointerdown handler
// queries the plugin store via pluginRegistry.getStore(CONNECTOR_STORE_KEY)
// when it sees the tool is active, then calls store.handlePick(id) to
// advance the state machine.
//
// State machine inside the plugin:
//   active=false → activate via toolbar button or Ctrl+Shift+C
//   active=true, firstPickId=null  → first hit: store firstPickId
//   active=true, firstPickId=X     → second hit: createArrow(X, hitId), reset

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import { CONNECTOR_BRIDGE_KEY, type ConnectorBridge } from "./bridge.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import ConnectorIcon from "./Icon.svelte";

export const CONNECTOR_STORE_KEY: unique symbol = Symbol("connectorStore");

export type ConnectorStore = {
  isActive(): boolean;
  /** Toggle the tool on/off via the registry-coordinated path so the
   *  toolbar `.active` class flips and the panel mounts/unmounts. */
  toggle(): void;
  /** Cancel: turn off the tool and clear the first pick. */
  cancel(): void;
  /**
   * Called by App.svelte's pointerdown handler when the tool is
   * active. Pass the hit element id, or null when the user clicked
   * empty space (which cancels the tool per the original UX).
   * Returns true when the event was consumed (caller should
   * preventDefault + return).
   */
  handlePick(elementId: string | null): boolean;
};

export { CONNECTOR_BRIDGE_KEY };
export type { ConnectorBridge };

export const connectorToolPlugin: SveltedrawPlugin = {
  id: "builtin/connector-tool",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    const bridge = ctx.getStore<ConnectorBridge>(CONNECTOR_BRIDGE_KEY) ?? null;

    const cancel = (): void => {
      state.active = false;
      state.firstPickId = null;
      bridge?.setHighlight(null);
    };

    bindPanelHost({ state, onCancel: cancel });

    const store: ConnectorStore = {
      isActive: () => state.active,
      toggle: () => {
        if (state.active) {
          cancel();
        } else {
          state.active = true;
          state.firstPickId = null;
        }
      },
      cancel,
      handlePick: (elementId) => {
        if (!state.active) return false;

        // Click on empty space → cancel tool (mirrors the inline
        // behavior the pointerdown handler had previously).
        if (elementId === null) {
          cancel();
          return true;
        }

        // First pick: store + highlight, wait for second click.
        if (state.firstPickId === null) {
          state.firstPickId = elementId;
          bridge?.setHighlight(elementId);
          return true;
        }

        // Same element clicked twice — ignore (can't self-connect).
        if (state.firstPickId === elementId) {
          return true;
        }

        // Second pick: build the arrow, reset.
        bridge?.createArrow(state.firstPickId, elementId);
        cancel();
        return true;
      },
    };
    const releaseStore = ctx.provideStore(CONNECTOR_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "toggle",
      icon: ConnectorIcon,
      title: "Connector tool (Ctrl+Shift+C)",
      group: "drawing",
      isActive: () => state.active,
      onActivate: () => store.toggle(),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Connector tool",
      triggerIcon: ConnectorIcon,
      component: PanelHost,
      // Not exclusive — the connector tool's panel is a small bottom-
      // right indicator, not a right-side dock. It can coexist with an
      // open exclusive side panel without visual conflict.
    });

    return () => {
      releaseStore();
      removeToolbarItem();
      removeSidePanel();
    };
  },
};

// Built-in plugin: group / ungroup.
//
// Migrates the inline groupSelected + ungroupSelected helpers from
// App.svelte. Group membership is stored as `element.groupIds:
// string[]` where groups nest outward (index -1 is the outermost).
// Ctrl+G adds a fresh groupId to every selected element; Ctrl+Shift+G
// pops the outermost groupId from each selected element.
//
// Hooks consumed:
//   - provideStore(GROUP_STORE_KEY) → exposes group + ungroup so the
//     host's ops + UI buttons + actions all route through one place
//
// Bridge consumed:
//   - GROUP_BRIDGE_KEY (host-published): scene access + pushHistory +
//     bumpSceneRepaint + randomId
//
// What the plugin does NOT own:
//   - The Ctrl+G / Ctrl+Shift+G hotkeys. Those live in actions/core.ts
//     and fire via ops which delegate here.
//   - The "expand selection to group on click" behavior. That lives
//     in App.svelte's pointerdown flow because it's part of the
//     selection state machine, not the group-mutation surface.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { GROUP_BRIDGE_KEY, type GroupBridge } from "./bridge.js";

export const GROUP_STORE_KEY: unique symbol = Symbol("groupStore");

export type GroupStore = {
  /** Add a fresh groupId to every selected element. No-op when
   *  fewer than 2 elements are selected — a one-element "group"
   *  is a contradiction and matches the original semantics. */
  group: () => void;
  /** Pop the outermost groupId from every selected element. No-op
   *  when no selected element has any group membership. */
  ungroup: () => void;
};

export { GROUP_BRIDGE_KEY };
export type { GroupBridge };

export const groupPlugin: SveltedrawPlugin = {
  id: "builtin/group",
  install(ctx: SveltedrawPluginContext): () => void {
    const bridge = ctx.getStore<GroupBridge>(GROUP_BRIDGE_KEY);
    if (!bridge) {
      throw new Error(
        `[plugin:builtin/group] GROUP_BRIDGE_KEY not in context — host must publish via registerCtx before plugin install`,
      );
    }

    const group = () => {
      const scene = bridge.getScene();
      if (!scene) return;
      const selected = ctx.api.getSelectedElements();
      // Need ≥ 2 elements to form a group. Matches original semantics.
      if (selected.length < 2) return;
      const newGroupId = bridge.randomId();
      for (const el of selected) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cur = ((el as any).groupIds as string[]) ?? [];
        const nextGroupIds = [...cur, newGroupId];
        scene.mutateElement(
          el,
          { groupIds: nextGroupIds },
          { informMutation: false, isDragging: false },
        );
      }
      bridge.pushHistory();
      bridge.bumpSceneRepaint();
    };

    const ungroup = () => {
      const scene = bridge.getScene();
      if (!scene) return;
      const selected = ctx.api.getSelectedElements();
      if (selected.length === 0) return;
      let changed = false;
      for (const el of selected) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ids = ((el as any).groupIds as string[]) ?? [];
        if (ids.length === 0) continue;
        // Pop the outermost group (last entry).
        const nextGroupIds = ids.slice(0, -1);
        scene.mutateElement(
          el,
          { groupIds: nextGroupIds },
          { informMutation: false, isDragging: false },
        );
        changed = true;
      }
      // Skip pushHistory + repaint when nothing actually changed —
      // calling ungroup on already-ungrouped elements should not
      // pollute the undo stack.
      if (changed) {
        bridge.pushHistory();
        bridge.bumpSceneRepaint();
      }
    };

    const store: GroupStore = { group, ungroup };
    return ctx.provideStore(GROUP_STORE_KEY, store);
  },
};

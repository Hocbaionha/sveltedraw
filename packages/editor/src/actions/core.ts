// Core action set. Registered by App.svelte at editor construction.
//
// We don't lift the action implementations out of App.svelte — they
// close over many editor-local helpers (getSelectedElements, scene refs,
// the selection map, etc.) and moving them would mean a much bigger
// surface change. Instead App.svelte hands `registerCoreActions` an `ops`
// bundle of its existing functions; this file builds the Action records
// and wires them through the manager.
//
// The win is still meaningful: any caller (keyboard, command palette,
// plugin) now invokes `actionManager.execute('edit.delete')` instead of
// reaching into the App.svelte handler tree directly. Hotkeys live on
// the action records, so adding a new shortcut means adding one line in
// the registration array — not editing the App keydown switch.

import type { ActionManager } from "./manager.svelte.js";
import type { Action } from "./types.js";

export interface CoreActionOps {
  // Predicates
  hasSelection: () => boolean;
  hasMultipleSelection: () => boolean;
  // Edit
  deleteSelected: () => void;
  duplicateSelected: () => void;
  selectAll: () => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;
  // View
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  toggleGrid: () => void;
  toggleTheme: () => void;
  // Arrange — z-order
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  // Arrange — group
  groupSelected: () => void;
  ungroupSelected: () => void;
  // Tool
  setActiveTool: (type: string) => void;
}

export function registerCoreActions(
  mgr: ActionManager,
  ops: CoreActionOps,
): () => void {
  const hasSel = () => ops.hasSelection();
  const hasMulti = () => ops.hasMultipleSelection();

  const defs: Action[] = [
    // ── Edit ─────────────────────────────────────────────────────────
    {
      id: "edit.selectAll",
      label: "Select all",
      category: "select",
      hotkey: "CmdOrCtrl+A",
      perform: () => {
        ops.selectAll();
        return { consumed: true };
      },
    },
    {
      id: "edit.clearSelection",
      label: "Clear selection",
      category: "select",
      // Esc is also handled in App.svelte's keydown for tool-cancel side
      // effects. The action is here so the command palette and any
      // future "deselect" button can dispatch through the same path.
      perform: () => {
        ops.clearSelection();
        return { consumed: true };
      },
    },
    {
      id: "edit.deleteSelected",
      label: "Delete selection",
      category: "edit",
      hotkey: ["Delete", "Backspace"],
      predicate: () => hasSel(),
      perform: () => {
        ops.deleteSelected();
        // Note: the existing deleteSelected already calls pushHistory
        // internally. We don't want a double-push, so don't return
        // mutated:true. The action just consumes the event.
        return { consumed: true };
      },
    },
    {
      id: "edit.duplicateSelected",
      label: "Duplicate",
      category: "edit",
      hotkey: "CmdOrCtrl+D",
      predicate: () => hasSel(),
      perform: () => {
        ops.duplicateSelected();
        return { consumed: true };
      },
    },
    {
      id: "edit.undo",
      label: "Undo",
      category: "edit",
      hotkey: "CmdOrCtrl+Z",
      perform: () => {
        ops.undo();
        return { consumed: true };
      },
    },
    {
      id: "edit.redo",
      label: "Redo",
      category: "edit",
      // Both common bindings — Y on Windows/Linux, Shift+Z on macOS.
      hotkey: ["CmdOrCtrl+Y", "CmdOrCtrl+Shift+Z"],
      perform: () => {
        ops.redo();
        return { consumed: true };
      },
    },

    // ── View ─────────────────────────────────────────────────────────
    {
      id: "view.zoomIn",
      label: "Zoom in",
      category: "view",
      // Both `=` and `+` show up on different keyboards for the same key.
      hotkey: ["CmdOrCtrl+=", "CmdOrCtrl++"],
      perform: () => {
        ops.zoomIn();
        return { consumed: true };
      },
    },
    {
      id: "view.zoomOut",
      label: "Zoom out",
      category: "view",
      hotkey: "CmdOrCtrl+-",
      perform: () => {
        ops.zoomOut();
        return { consumed: true };
      },
    },
    {
      id: "view.resetZoom",
      label: "Reset zoom (100%)",
      category: "view",
      hotkey: "CmdOrCtrl+0",
      perform: () => {
        ops.resetZoom();
        return { consumed: true };
      },
    },
    {
      id: "view.toggleGrid",
      label: "Toggle grid",
      category: "view",
      hotkey: "CmdOrCtrl+'",
      perform: () => {
        ops.toggleGrid();
        return { consumed: true };
      },
    },
    {
      id: "view.toggleTheme",
      label: "Toggle dark mode",
      category: "view",
      hotkey: "Alt+Shift+D",
      perform: () => {
        ops.toggleTheme();
        return { consumed: true };
      },
    },

    // ── Arrange — z-order ────────────────────────────────────────────
    {
      id: "arrange.bringForward",
      label: "Bring forward",
      category: "arrange",
      hotkey: "CmdOrCtrl+]",
      predicate: () => hasSel(),
      perform: () => {
        ops.bringForward();
        return { consumed: true };
      },
    },
    {
      id: "arrange.sendBackward",
      label: "Send backward",
      category: "arrange",
      hotkey: "CmdOrCtrl+[",
      predicate: () => hasSel(),
      perform: () => {
        ops.sendBackward();
        return { consumed: true };
      },
    },
    {
      id: "arrange.bringToFront",
      label: "Bring to front",
      category: "arrange",
      hotkey: "CmdOrCtrl+Shift+]",
      predicate: () => hasSel(),
      perform: () => {
        ops.bringToFront();
        return { consumed: true };
      },
    },
    {
      id: "arrange.sendToBack",
      label: "Send to back",
      category: "arrange",
      hotkey: "CmdOrCtrl+Shift+[",
      predicate: () => hasSel(),
      perform: () => {
        ops.sendToBack();
        return { consumed: true };
      },
    },

    // ── Arrange — group ──────────────────────────────────────────────
    {
      id: "arrange.group",
      label: "Group selection",
      category: "arrange",
      hotkey: "CmdOrCtrl+G",
      predicate: () => hasMulti(),
      perform: () => {
        ops.groupSelected();
        return { consumed: true };
      },
    },
    {
      id: "arrange.ungroup",
      label: "Ungroup",
      category: "arrange",
      hotkey: "CmdOrCtrl+Shift+G",
      predicate: () => hasSel(),
      perform: () => {
        ops.ungroupSelected();
        return { consumed: true };
      },
    },

    // ── Tools ────────────────────────────────────────────────────────
    // Tool switches don't get hotkeys here — the existing single-letter
    // tool hotkeys (V, R, D, O, A, L, P, T, E) are handled in App.svelte
    // because they're context-sensitive (skipped while a text input is
    // focused). Once we have a more sophisticated context-gating layer
    // in actions, we can pull them in. Until then the action records
    // exist for command-palette discoverability.
    ...(["selection", "rectangle", "diamond", "ellipse", "arrow", "line", "freedraw", "text", "eraser"] as const).map(
      (tool): Action => ({
        id: `tool.${tool}`,
        label: `${tool[0].toUpperCase()}${tool.slice(1)} tool`,
        category: "tool",
        perform: () => {
          ops.setActiveTool(tool);
          return { consumed: true };
        },
      }),
    ),
  ];

  const disposers = defs.map((d) => mgr.register(d));
  return () => {
    for (const d of disposers) d();
  };
}

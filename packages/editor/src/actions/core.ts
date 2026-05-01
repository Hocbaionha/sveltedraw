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
  isPolylineActive: () => boolean;
  // Edit
  deleteSelected: () => void;
  duplicateSelected: () => void;
  selectAll: () => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;
  toggleLockSelected: () => void;
  clearCanvas: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  // View
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  toggleGrid: () => void;
  toggleTheme: () => void;
  toggleToolLock: () => void;
  showHelpDialog: () => void;
  // Arrange — z-order
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  // Arrange — group
  groupSelected: () => void;
  ungroupSelected: () => void;
  // Arrange — align / distribute
  align: (mode: "left" | "right" | "top" | "bottom" | "centerH" | "centerV") => void;
  distribute: (mode: "distributeEvenlyH" | "distributeEvenlyV") => void;
  // Tool
  setActiveTool: (type: string) => void;
  // File
  downloadPng: () => Promise<void> | void;
  downloadSvg: () => Promise<void> | void;
  // Frame
  createFrameAtCenter: () => string | undefined;
  // Hyperlink
  openLinkDialog: () => void;
  // Polyline / new-element commit + cancel
  commitPolyline: () => void;
  cancelInProgress: () => void; // Esc behavior — also routes through tool/laser/connector cancel
  // Step nudge size for arrow keys (depends on Shift held)
  nudgeStep: { normal: number; shift: number };
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

    // ── Edit (more) ──────────────────────────────────────────────────
    {
      id: "edit.toggleLock",
      label: "Toggle lock on selection",
      category: "edit",
      hotkey: "CmdOrCtrl+Shift+L",
      predicate: () => hasSel(),
      perform: () => {
        ops.toggleLockSelected();
        return { consumed: true };
      },
    },
    {
      id: "edit.clearCanvas",
      label: "Clear canvas",
      category: "edit",
      // Both Ctrl+Shift+Delete AND Ctrl+Shift+Backspace bind in legacy.
      hotkey: ["CmdOrCtrl+Shift+Delete", "CmdOrCtrl+Shift+Backspace"],
      perform: () => {
        ops.clearCanvas();
        return { consumed: true };
      },
    },
    // Arrow-key nudge: 4 actions, one per direction. The shift-modifier
    // variants resolve to the same action with a different step size,
    // so we register both Arrow and Shift+Arrow combos for each.
    ...(
      [
        ["edit.nudgeLeft",  "Nudge left",  "ArrowLeft",  -1, 0],
        ["edit.nudgeRight", "Nudge right", "ArrowRight",  1, 0],
        ["edit.nudgeUp",    "Nudge up",    "ArrowUp",     0, -1],
        ["edit.nudgeDown",  "Nudge down",  "ArrowDown",   0,  1],
      ] as const
    ).map(([id, label, key, dx, dy]): Action => ({
      id,
      label,
      category: "edit",
      hotkey: [key, `Shift+${key}`],
      predicate: () => hasSel(),
      perform: (_ctx, payload) => {
        // executeKey forwards the original event as payload.event;
        // programmatic callers can also pass `{ shift: true }` directly.
        const shift = payload?.event?.shiftKey ?? payload?.shift ?? false;
        const step = shift ? ops.nudgeStep.shift : ops.nudgeStep.normal;
        ops.nudgeSelected(dx * step, dy * step);
        return { consumed: true };
      },
    })),
    {
      id: "edit.cancel",
      label: "Cancel / dismiss",
      category: "edit",
      hotkey: "Escape",
      perform: () => {
        ops.cancelInProgress();
        return { consumed: true };
      },
    },
    {
      id: "edit.commitPolyline",
      label: "Commit polyline",
      category: "edit",
      hotkey: "Enter",
      predicate: () => ops.isPolylineActive(),
      perform: () => {
        ops.commitPolyline();
        // Caller switches back to selection tool — that lives in
        // App.svelte close to the polyline state, not here.
        return { consumed: true };
      },
    },

    // ── View (more) ──────────────────────────────────────────────────
    {
      id: "view.toggleToolLock",
      label: "Toggle tool lock",
      category: "view",
      hotkey: "Q",
      perform: () => {
        ops.toggleToolLock();
        return { consumed: true };
      },
    },
    {
      id: "view.helpDialog",
      label: "Show keyboard shortcuts",
      category: "view",
      // Shift+/ produces "?" on US/Intl layouts; both forms register so
      // either keymap works. F1 goes to the Help plugin's full dialog.
      hotkey: ["?", "Shift+/"],
      perform: () => {
        ops.showHelpDialog();
        return { consumed: true };
      },
    },

    // ── Arrange — align ──────────────────────────────────────────────
    ...(
      [
        ["arrange.alignLeft",    "Align left",     "L", "left"],
        ["arrange.alignRight",   "Align right",    "R", "right"],
        ["arrange.alignTop",     "Align top",      "T", "top"],
        ["arrange.alignBottom",  "Align bottom",   "B", "bottom"],
        ["arrange.alignCenterH", "Center horizontally", "C", "centerH"],
        ["arrange.alignCenterV", "Center vertically",   "M", "centerV"],
      ] as const
    ).map(([id, label, key, mode]): Action => ({
      id,
      label,
      category: "arrange",
      hotkey: `CmdOrCtrl+Alt+${key}`,
      predicate: () => hasMulti(),
      perform: () => {
        ops.align(mode);
        return { consumed: true };
      },
    })),

    // ── Arrange — distribute ─────────────────────────────────────────
    {
      id: "arrange.distributeH",
      label: "Distribute horizontally",
      category: "arrange",
      hotkey: "CmdOrCtrl+Shift+H",
      predicate: () => hasMulti(),
      perform: () => {
        ops.distribute("distributeEvenlyH");
        return { consumed: true };
      },
    },
    {
      id: "arrange.distributeV",
      label: "Distribute vertically",
      category: "arrange",
      hotkey: "CmdOrCtrl+Shift+V",
      predicate: () => hasMulti(),
      perform: () => {
        ops.distribute("distributeEvenlyV");
        return { consumed: true };
      },
    },

    // ── File ─────────────────────────────────────────────────────────
    {
      id: "file.savePng",
      label: "Export as PNG",
      category: "file",
      hotkey: "CmdOrCtrl+S",
      perform: () => {
        ops.downloadPng();
        return { consumed: true };
      },
    },
    {
      id: "file.saveSvg",
      label: "Export as SVG",
      category: "file",
      hotkey: "CmdOrCtrl+Shift+S",
      perform: () => {
        ops.downloadSvg();
        return { consumed: true };
      },
    },

    // ── Frame ────────────────────────────────────────────────────────
    {
      id: "frame.create",
      label: "Insert frame",
      category: "edit",
      hotkey: "F",
      perform: () => {
        ops.createFrameAtCenter();
        return { consumed: true };
      },
    },

    // ── Hyperlink dialog ─────────────────────────────────────────────
    {
      id: "edit.editLink",
      label: "Edit link",
      category: "edit",
      hotkey: "CmdOrCtrl+K",
      predicate: () => hasSel(),
      perform: () => {
        ops.openLinkDialog();
        return { consumed: true };
      },
    },

    // ── Tools ────────────────────────────────────────────────────────
    // Tool hotkeys (single letters). L is intentionally NOT bound to the
    // line tool here — the laser plugin owns L's variant K, but historic
    // muscle-memory uses L for laser; we keep the line tool reachable
    // via "6" only. Same for `s` (rectangle would conflict; s already
    // is selection in legacy).
    ...(
      [
        ["selection",  ["V", "1"]],
        ["rectangle",  ["R", "2"]],
        ["diamond",    ["D", "3"]],
        ["ellipse",    ["O", "4"]],
        ["arrow",      ["A", "5"]],
        ["line",       ["6"]],
        ["freedraw",   ["P", "7", "X"]],
        ["text",       ["T", "8"]],
        ["eraser",     ["E", "9"]],
      ] as const
    ).map(([tool, hotkeys]): Action => ({
      id: `tool.${tool}`,
      label: `${tool[0].toUpperCase()}${tool.slice(1)} tool`,
      category: "tool",
      hotkey: hotkeys,
      perform: () => {
        ops.setActiveTool(tool);
        return { consumed: true };
      },
    })),
  ];

  const disposers = defs.map((d) => mgr.register(d));
  return () => {
    for (const d of disposers) d();
  };
}

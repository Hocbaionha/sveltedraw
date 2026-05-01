// ActionManager — the architectural piece this codebase was missing.
//
// Excalidraw's `ActionManager` is the single dispatch point for every user
// command (cut/copy/zoom/group/align/undo/...). Each command is an Action
// object with a stable id, a perform function, an optional predicate, and
// an optional hotkey. Toolbar buttons, the keyboard handler, the context
// menu, and the command palette ALL go through `actionManager.execute(id)`.
// That gives:
//   - One place to define / discover commands
//   - Consistent predicate-gating (e.g. "Delete" disabled when no selection)
//   - Hotkey routing without hard-coding key combos in the keydown switch
//   - Plugin-extensible: a new feature registers an action and immediately
//     gets a hotkey, a command-palette entry, and (if it adds a toolbar
//     item) a button — all going through the same dispatcher.
//
// The previous Sveltedraw layout had actions scattered:
//   - Hard-coded in App.svelte's keydown switch (Esc, Delete, hotkeys)
//   - Inside feature modules (alignment/handlers.ts, presentation/handlers.ts)
//   - On plugin store methods (connector.toggle(), laser.cancel(), ...)
// That made the command palette a hard-coded list and hotkey extension
// impossible from plugins without modifying App.svelte. This module fixes
// that.

import type { Component, Snippet } from "svelte";
import type { SveltedrawAPI } from "../api/types.js";
import type { PluginRegistry } from "../plugins/registry.svelte.js";

/**
 * Context passed to every action's predicate and perform function.
 * Held by the ActionManager and supplied at execute() time so action
 * definitions can stay small.
 */
export interface ActionContext {
  /** The editor's imperative API surface (scene mutators, history, etc.). */
  api: SveltedrawAPI;
  /** Live appState proxy. Reads in `predicate` track reactively. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
  /** Plugin registry — actions can fetch published stores by key. */
  pluginRegistry: PluginRegistry;
  /** Force the static-canvas re-render (drag/drop/scene-mutation paths). */
  bumpSceneRepaint: () => void;
  /** Push a history snapshot (call after mutating actions). */
  pushHistory: () => void;
}

/**
 * What an action returns. Both fields are optional — actions that don't
 * mutate scene state can return nothing.
 */
export interface ActionResult {
  /** True if the action mutated scene/appState in a way that should
   *  push history. The dispatcher records the snapshot. */
  mutated?: boolean;
  /** True if the action handled the originating event and the caller
   *  should not propagate it further (e.g. preventDefault on keydown). */
  consumed?: boolean;
}

/** Categories drive grouping in the command palette + main menu. */
export type ActionCategory =
  | "edit"     // undo, redo, delete, duplicate
  | "select"   // select all, select none, invert selection
  | "view"     // zoom in/out, reset zoom, toggle grid
  | "arrange"  // align, distribute, reorder, group
  | "tool"     // switch active tool (rectangle, ellipse, ...)
  | "file"     // new, open, save, export
  | "plugin";  // anything contributed by a plugin

/**
 * An Action is a self-describing command. Defining it with this shape
 * unlocks: keyboard hotkey, command-palette entry, predicate-driven
 * gating in toolbar isActive(), and plugin extensibility.
 */
export interface Action {
  /**
   * Stable, dotted id — convention is `<category>.<verb>`. Must be unique
   * across the registered set; second register() call with a colliding
   * id throws. Plugin-contributed actions should prefix with the plugin
   * id (e.g. `builtin/laser-pointer.toggle`).
   */
  id: string;

  /** Human-readable label. Shown in command palette / context menu. */
  label: string;

  /** Optional category — drives grouping in command palette. */
  category?: ActionCategory;

  /** Optional Svelte 5 component / snippet for icon rendering. */
  icon?: Component | Snippet;

  /**
   * Hotkey string in the canonical format. Grammar:
   *   `(Ctrl|Meta|Shift|Alt|CmdOrCtrl)+Key` joined by `+`.
   * Modifiers normalized lowercase, key letters case-insensitive.
   * Examples: `Ctrl+Z`, `Shift+Alt+L`, `CmdOrCtrl+Shift+P`, `Escape`, `?`.
   * On macOS, `CmdOrCtrl` resolves to Meta; elsewhere to Ctrl.
   * Multiple bindings: pass an array.
   */
  hotkey?: string | readonly string[];

  /**
   * Whether the action is currently invocable. Defaults to always-true.
   * Reads inside this function track reactively when called from a
   * `$derived` (e.g. toolbar button isActive).
   */
  predicate?: (ctx: ActionContext) => boolean;

  /**
   * The actual command. Mutate scene/appState through `ctx.api`. Return
   * `{ mutated: true }` to trigger history push + repaint, `{ consumed:
   * true }` to signal the originating event was fully handled. Both
   * default to false.
   */
  perform: (
    ctx: ActionContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any,
  ) => ActionResult | void;
}

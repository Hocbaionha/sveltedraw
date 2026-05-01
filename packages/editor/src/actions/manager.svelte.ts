// ActionManager — central dispatch + hotkey routing for editor commands.

import type { Action, ActionContext, ActionResult } from "./types.js";

export const ACTION_MANAGER_KEY: unique symbol = Symbol("actionManager");

/**
 * Normalize a KeyboardEvent into the canonical key-combo string used
 * by Action.hotkey definitions. Order: Ctrl, Meta, Shift, Alt, then
 * the printable key. Modifier names are lowercase; the key portion
 * preserves a single canonical form (single letters uppercased).
 *
 * Examples:
 *   Ctrl+Z keydown → "Ctrl+Z"
 *   Shift+Alt+L    → "Shift+Alt+L"
 *   Escape         → "Escape"
 *   ?              → "?" (Shift+? collapses since the printable char is ?)
 */
export function normalizeKey(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.metaKey) parts.push("Meta");
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");
  const k = event.key;
  // Single printable character → upper-case it so "z" and "Z" map the
  // same. Multi-char keys (Escape, ArrowLeft, F1, ...) stay as-is.
  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join("+");
}

/**
 * Normalize an Action.hotkey string the same way we normalize keyboard
 * events, so registration and dispatch index by the same shape.
 *   - Splits on `+`, trims each token
 *   - Modifier order rewritten to canonical (Ctrl, Meta, Shift, Alt)
 *   - `CmdOrCtrl` resolves to `Meta` on macOS, else `Ctrl`
 *   - Single-letter key uppercased
 */
export function normalizeHotkey(combo: string): string {
  const isMac = typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const tokens = combo.split("+").map((t) => t.trim()).filter(Boolean);
  const mods = new Set<string>();
  let key = "";
  for (const t of tokens) {
    const lc = t.toLowerCase();
    if (lc === "ctrl" || lc === "control") mods.add("Ctrl");
    else if (lc === "meta" || lc === "cmd" || lc === "command") mods.add("Meta");
    else if (lc === "shift") mods.add("Shift");
    else if (lc === "alt" || lc === "option") mods.add("Alt");
    else if (lc === "cmdorctrl") mods.add(isMac ? "Meta" : "Ctrl");
    else key = t.length === 1 ? t.toUpperCase() : t;
  }
  const canonical: string[] = [];
  if (mods.has("Ctrl")) canonical.push("Ctrl");
  if (mods.has("Meta")) canonical.push("Meta");
  if (mods.has("Shift")) canonical.push("Shift");
  if (mods.has("Alt")) canonical.push("Alt");
  if (key) canonical.push(key);
  return canonical.join("+");
}

export class ActionManager {
  /**
   * Action registry, reactive so consumers ($derived) re-list when
   * actions register/unregister (e.g. command palette filter).
   */
  actions = $state<Map<string, Action>>(new Map());

  /**
   * Hotkey → action id index. Maintained alongside `actions`. We keep
   * a separate Map (not derived) because dispatch is on the keydown
   * hot path; rebuilding a Map per event would be wasteful.
   */
  private hotkeyIndex = new Map<string, string>();

  constructor(private readonly contextProvider: () => ActionContext) {}

  /**
   * Register an action. Returns a dispose fn that unregisters it.
   * Throws if `action.id` collides with an already-registered action —
   * surface the bug at install time instead of letting one action
   * silently shadow another.
   */
  register(action: Action): () => void {
    if (this.actions.has(action.id)) {
      throw new Error(
        `[actions] id "${action.id}" already registered`,
      );
    }
    const next = new Map(this.actions);
    next.set(action.id, action);
    this.actions = next;
    const hotkeys = this.collectHotkeys(action);
    for (const h of hotkeys) this.hotkeyIndex.set(h, action.id);
    return () => {
      const removed = new Map(this.actions);
      removed.delete(action.id);
      this.actions = removed;
      for (const h of hotkeys) {
        if (this.hotkeyIndex.get(h) === action.id) this.hotkeyIndex.delete(h);
      }
    };
  }

  private collectHotkeys(action: Action): string[] {
    if (!action.hotkey) return [];
    const arr = Array.isArray(action.hotkey) ? action.hotkey : [action.hotkey];
    return arr.map(normalizeHotkey).filter((k) => k.length > 0);
  }

  /** Look up an action by id. */
  get(id: string): Action | undefined {
    return this.actions.get(id);
  }

  /**
   * Snapshot of registered actions, optionally filtered by category.
   * Allocation per call — caller should derive sparingly.
   */
  list(category?: Action["category"]): Action[] {
    const out: Action[] = [];
    for (const a of this.actions.values()) {
      if (category && a.category !== category) continue;
      out.push(a);
    }
    return out;
  }

  /**
   * Test the predicate. Returns true when the action has no predicate
   * (i.e. always-on). Reactive when called inside a $derived.
   */
  isEnabled(id: string): boolean {
    const action = this.actions.get(id);
    if (!action) return false;
    if (!action.predicate) return true;
    return action.predicate(this.contextProvider());
  }

  /**
   * Dispatch by id. Returns the action's result so callers can decide
   * whether to preventDefault / propagate. Records history if the
   * action signaled `{ mutated: true }` and triggers a repaint.
   *
   * Returns undefined when the action does not exist or its predicate
   * fails — caller should treat that as "not handled" and fall through
   * to the next dispatch source.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(id: string, payload?: any): ActionResult | undefined {
    const action = this.actions.get(id);
    if (!action) return undefined;
    const ctx = this.contextProvider();
    if (action.predicate && !action.predicate(ctx)) return undefined;
    const ret = action.perform(ctx, payload) ?? {};
    if (ret.mutated) {
      ctx.pushHistory();
      ctx.bumpSceneRepaint();
    }
    return ret;
  }

  /**
   * Resolve a KeyboardEvent to an action and dispatch. Returns the
   * action result on hit (so the caller can preventDefault), or
   * undefined when no action claimed the combo (caller falls through
   * to its existing keydown handling). The event is forwarded as
   * `payload.event` so actions that care about modifier state (e.g.
   * arrow-key nudge with Shift = larger step) can read it without
   * needing a separate dispatch path.
   */
  executeKey(event: KeyboardEvent): ActionResult | undefined {
    const combo = normalizeKey(event);
    const id = this.hotkeyIndex.get(combo);
    if (!id) return undefined;
    return this.execute(id, { event });
  }
}

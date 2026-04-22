# Phase 6 — Interactive editor complete

Tag: `phase-6-done`
Date: 2026-04-23

## Scope

React → Svelte 5 port of Excalidraw. Phase 6 closes the interactive
editor: `packages/excalidraw-svelte/src/App.svelte` (3,840 lines) now
ships every core drawing/editing surface the upstream app provides,
minus a handful of explicitly-deferred features (collab, library UI,
mobile gestures).

## What works

**7 element types:** rectangle, diamond, ellipse, line, arrow,
freedraw, text, image.

**Selection + manipulation:** single-click, shift-click, marquee;
drag, resize (all 8 handles, including rotated bbox), rotate, linear
endpoint editor, multi-point polyline (click-to-add-vertex +
Enter/dblclick commit), Alt-drag duplicate.

**Editing:** double-click to edit text (overlay matches font/color
/rotation of canvas element), Ctrl+A/D, arrow nudge (+shift for
bigger), undo/redo (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y — snapshot-based,
history floor at initial state), context menu (right-click: copy/
cut/paste/duplicate/bring forward/send to front/send backward/send
to back/delete), Ctrl+]/Ctrl+[ z-order.

**Style panel (floating top-left):**

| Group     | Controls                                          |
|-----------|---------------------------------------------------|
| Colors    | Stroke + fill (ColorPicker — TopPicks + popover)  |
| Stroke    | Width, style (solid/dashed/dotted)                |
| Fill      | Style (hachure/cross-hatch/solid)                 |
| Shape     | Roughness (architect/artist/cartoonist), opacity  |
| Font      | FontPicker (3 quick-picks + popover w/ search)    |
| Text-only | Text align, vertical align                        |
| Linear    | Start arrowhead, end arrowhead                    |

**Persistence:** localStorage (scene + appState subset, 500ms debounce)
+ IndexedDB for image binaries (survives reload).

**Export:** PNG (blob) + SVG (fonts inlined as base64 @font-face).

**Canvas & view:** zoom (Ctrl+wheel/Ctrl+0/+/-), pan (space-drag/
middle-click-drag/wheel/arrow), grid mode.

**Vietnamese text:** Patrick Hand aliased under "Excalifont" family
for the U+1EA0–U+1EF9 unicode-range, so tone marks render in the
same hand-drawn aesthetic.

## Deliberately not ported

- Real-time collaboration (socket.io + CRDT)
- Library / reusable elements UI
- Group/ungroup (Ctrl+G) — selection & edit logic, deferred
- Mobile touch gestures (pinch-zoom, two-finger pan)
- Shape cropping, embed URLs, flowchart autolayout
- Eye-dropper interaction (trigger wired, canvas sampling isn't)

## Testing

`sveltedraw-app/scripts/smoke-app-mount.mjs` — headless Chrome CDP
harness. Spawns a real browser, wipes localStorage + IndexedDB, walks
through every core interaction in one session. **111/111 assertions**
pass at tag.

`svelte-check --threshold error`: 31 errors (all pre-existing —
unrelated `@excalidraw/element/types` module-not-found warnings in
dynamic icon Svelte files + 1 showcase type error). Zero regressions
since Phase 6 started.

Vite production build: 8.6s, 0 warnings on App.svelte.

## Architectural notes (for future work)

- **Upstream `engine/` modules are not reused.** They couple to React
  (flushSync, jotai atoms in .tsx, actions/ system); wrapping would
  need a parallel shadow-monorepo. Each tool's lifecycle is ported
  fresh as Svelte-idiomatic code.
- **Scene & Renderer are reused** from `@excalidraw/element` and
  `@excalidraw/excalidraw/scene` — pure logic, no React.
- **Memoize gotcha:** `Renderer.getRenderableElements` memoizes on
  argument identity. Mutating nested `appState.zoom.value` keeps the
  same object ref → stale cache. Always spread-copy.
- **History invariant:** `history[historyIndex]` equals current state;
  push AFTER mutation, not before.
- **Svelte 5 $derived tracking:** reads proxy state through closure
  function calls can drop reactivity. Inline the `appState.*` access
  inside the derived body. See `memory/feedback_svelte5_derived_tracking.md`.

## Post-tag audit findings (fixed after phase-6-done)

A ~30-minute targeted audit caught two bugs hidden behind the passing
smoke suite:

1. **Unbounded history growth.** `history: HistorySnapshot[]` appended
   a deep-cloned snapshot per mutation with no cap. At 100 elements +
   1KB each + 1000 edits, the scene-history retention balloons to
   ~100MB. Fixed: `MAX_HISTORY = 500` FIFO cap; `while
   (history.length > MAX_HISTORY) { history.shift(); historyIndex--; }`
   after each push.

2. **Alt-click leaked duplicates out of the undo stack.** Alt + press
   + release without moving created duplicates in `appState.newElement`
   but the drag-finalize branch only pushed history `if (moved)` — so
   the duplicate stranded in scene with no Ctrl+Z path to remove it.
   Smoke probe before fix: before=10, afterClick=11, afterUndo=9
   (undo reverted an *earlier* unrelated change). Fix: track
   `altDragHadDuplicate` across pointerdown→pointerup, force
   pushHistory on release even when cursor didn't move.

Both verified via new smoke probes (`history-capped-below-max`,
`alt-click-no-drag-is-undoable`). 113/113 assertions pass.

## Known growth paths (not fixed; documented)

- **IndexedDB binary store (`sveltedraw/files`)** grows monotonically
  — every pasted image writes a record, nothing deletes. A proper
  compaction pass would GC fileIds unreachable from `history[0..n]`;
  deferred because it's coupled to history semantics (deleted images
  must survive soft-delete + undo).
- **`imageCacheMap` / `binaryFiles`** (in-memory siblings of IDB)
  same concern.
- **`idbPut` opens a fresh IDB connection per call.** Browsers treat
  idle connections cheaply; only matters at very high paste volume.

## Next (not committed to a timeline)

1. Image-GC compaction tied to history cap eviction.
2. Group/ungroup + shape library UI.
3. Mobile/touch polish.
4. Cut over `excalidraw-app/` (the original React app) to use
   `@sveltedraw/excalidraw` — the port's actual payoff.

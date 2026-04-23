# Post-Phase-16 Gap Plan

**Created:** 2026-04-23
**Baseline commit:** `51f7ae2f` (real text styling)
**Source:** Comprehensive code scan of `packages/excalidraw-svelte/src/` + `packages/element/src/` + `packages/excalidraw/renderer/` + all `components/*.svelte`. Individual claims cite file:line. Items flagged **[verified]** were sanity-checked by the author; others rely on the agent-scan report (`Explore` subagent, 2026-04-23 session) and should be re-verified before work begins.

## Context

Phase 16's honest rewrite (`a4e28bdb`) + subsequent polish (`b31054f3`, `b10faa3a`, `51f7ae2f`) closed the four original Phase 16 features. The honest test suite is `76/76`. But a deeper scan surfaced **21 items** — many of them toolbar buttons / panels that render but don't drive real behavior (same class of bug the user called "tởm" earlier).

User has explicitly ruled out shortcuts: *"chọn cách nào chất lượng tốt nhất cho tao. những cách nhanh cách tắt vứt hết mẹ nó đi"*. This plan therefore:

- Proves every fix with byte-level or pixel-level assertions, not just UI clicks.
- Does not introduce new UI for capabilities the renderer doesn't honor (the fontWeight facade mistake is not repeated).
- Adds each item's tests to `test-phase16-honest.js` so regressions are caught.

## Tracks

- **Track A — Facade cleanup.** UI exists but does nothing or misleads. Highest pain, bounded scope. Items A1–A9.
- **Track B — Missing upstream features.** Excalidraw ships these; sveltedraw doesn't. Larger scope, users expect them if they know Excalidraw. Items B1–B4.
- **Track C — New visual features.** Drop shadow (the author's earlier proposal). Real renderer work; fits text-styling pattern. Items C1–C2.
- **Track D — Polish / infra.** Dark mode, i18n, small FIXMEs. Items D1–D5.

---

## Track A — Facade Cleanup (HIGH)

### A1. Wire Element Links

**Files:** `packages/element/src/types.ts:79` (field), `packages/excalidraw-svelte/src/components/ElementLinkDialog.svelte` (component, orphan **[verified — no import in App.svelte]**).

**Status now:** `element.link` is persisted; `ElementLinkDialog.svelte` is a complete dialog component; **nothing in App.svelte imports or mounts it**. Users cannot set or click links.

**Work:**
1. Import `ElementLinkDialog` in App.svelte.
2. Add context-menu item "Edit link" on single-element selection → open dialog.
3. Add `Ctrl+K` shortcut (upstream keybinding).
4. On element hover, if `element.link` is set, show a small chip with the URL near the top-right corner of the selection bounding box.
5. Click the chip (or Cmd+click the element) → `window.open(link, "_blank")`.

**Acceptance:**
- Set link via dialog → `element.link` persists through save/reload.
- Hover chip appears only when link is set.
- Export SVG embeds link as `<a href=...><g>...</g></a>` wrapping the element group (upstream behavior).
- Honest test: set link, export SVG, assert SVG contains `<a href="<url>"`.

**Effort:** M (1–2 h).
**Risk:** Context menu wiring in Svelte 5 may need testing; right-click handler exists already.

---

### A2. Implement Laser Pointer

**Files:** `packages/excalidraw-svelte/src/components/LaserPointerButton.svelte` (orphan **[verified — no import in App.svelte]**).

**Status now:** Button component renders, toggle state exists, no handler. No laser line ever appears.

**Work:**
1. Mount `LaserPointerButton` in toolbar next to other tool buttons (or under a "presentation tools" cluster).
2. Add `activeTool.type === "laser"` mode; when active, pointermove emits a fading trail of `{x, y, timestamp}` points.
3. Overlay SVG layer (absolutely positioned over the canvas, z-index above canvas but below property panels) draws the trail as a smooth polyline with stroke-opacity fading from 1 → 0 over ~800ms.
4. Laser mode auto-exits on Esc or tool switch.
5. Works in presentation mode (already-popular use-case): during presentation, L key toggles laser.

**Acceptance:**
- Click laser button → cursor changes to crosshair, pointermove draws red fading trail.
- Points older than 800ms are removed from the state array.
- Trail renders in presentation mode.
- Honest test: enable laser, simulate pointermove events at 5 points, assert an `<svg>` overlay with `<polyline>` exists and has >= 5 points.

**Effort:** M (2 h).
**Risk:** 60fps trail rendering under Svelte 5 reactivity — may need `requestAnimationFrame` loop instead of $state array.

---

### A3. Render Connector Paths to Canvas

**Files:** `packages/excalidraw-svelte/src/App.svelte:~1978-2017` (createConnector stores but no render), `components/ConnectorTool.svelte`, `connectors/types.ts` **[verified — no `renderConnector` / `drawConnector` function anywhere]**.

**Status now:** Connector tool (⚡) lets user click two shapes; a `Connector` object is pushed into the `connectors` state array. `ConnectorTool.svelte` shows the count. **No canvas/SVG rendering.** The connector is invisible.

**Work:**
1. Decide shape of connector: upstream Excalidraw uses `ExcalidrawArrowElement` with `startBinding` / `endBinding` pointing at the two shapes. Consider **replacing** the custom `connectors[]` array with real arrow elements that use the binding mechanism — this automatically gets rendering, hit testing, export, undo for free.
2. If keeping custom connectors: add `renderConnector(connector, ctx)` in renderElement.ts (canvas) and mirror in staticSvgScene.ts (SVG export). Compute path based on `routingStyle` (straight | orthogonal | curved).
3. Connectors auto-update position when bound shapes move (reactive via $effect or pointer up handler).

**Acceptance:**
- Click two rectangles → visible line/arrow between them.
- Move one rectangle → connector follows.
- Export SVG contains the connector as `<path>` or `<line>`.
- Delete either endpoint → connector auto-deletes.
- Honest test: create 2 rects, create connector, move rect, assert connector endpoint updated.

**Effort:** L (4–6 h) if custom; M (2 h) if replacing with arrow+binding.
**Recommendation:** Replace with arrow+binding. Less code, more compatible with upstream export/import.
**Risk:** Existing `connectors[]` state + ConnectorTool UI would be deleted or repurposed.

---

### A4. Make Snap-to-Grid Actually Snap

**Files:** `packages/excalidraw-svelte/src/App.svelte:~1652-1661` (snapConfig state), `snap/types.ts`, `GridPanel.svelte`.

**Status now:** `snapConfig` editable via GridPanel (threshold, snapToGrid, snapToElements, snapEdges, snapCenters booleans). **Drag handlers (`onInteractivePointerMove`) never read snapConfig.** Moving an element with snap enabled behaves identically to snap disabled.

**Work:**
1. In pointermove drag handler, if `snapConfig.enabled && snapConfig.snapToGrid`, round drag position to nearest `gridConfig.size` within `snapConfig.threshold`.
2. If `snapConfig.snapToElements`, find other elements within threshold on same x/y axis → snap to their edges/centers (per `snapEdges`/`snapCenters` toggles).
3. Render visual guide line (dotted) at the snap target during drag (this is the "Smart Guides" the alignment panel mentions — see A6).
4. Shift-key override to bypass snap temporarily (upstream behavior).

**Acceptance:**
- Enable snap-to-grid at size 20 → drag a rectangle, it snaps in 20px increments.
- Disable snap → same drag moves freely.
- Enable snap-to-elements → drag near another rectangle's left edge → x snaps to match.
- Honest test: set gridConfig.size=50, snap enabled, simulate drag of 37px, assert final position mod 50 == 0.

**Effort:** L (4 h).
**Risk:** Interaction with existing drag code is tight; easy to break free-drag for users who want it.

---

### A5. Measurement Panel Render Rulers / Distances / Dimensions

**Files:** `packages/excalidraw-svelte/src/components/MeasurementPanel.svelte:32-42`, `App.svelte` (no ruler/dimension renderer).

**Status now:** Three toggles (Show Rulers, Show Distances, Show Dimensions) exist; changing them flips boolean state; **nothing consumes the state**. Facade.

**Work:**
1. `Show Rulers`: SVG overlay with two bars (top + left), tick marks at gridConfig.size intervals, labels (0, 100, 200, …). Respects scene zoom/scroll.
2. `Show Dimensions`: When an element is selected, overlay its width/height numbers near top+left edges (e.g. "240 × 140"). Updates during resize.
3. `Show Distances`: When two elements are selected, draw dotted line between centers with distance label (e.g. "d=173px"). For 3+, pairwise distances between bounding-box corners.
4. All three respect `measurementConfig.unit` ("px" | "cm" | "in") and `precision`.

**Acceptance:**
- Toggle rulers → SVG bar appears, with labels that update on zoom.
- Select resized rectangle → "W × H" updates in real time during resize handle drag.
- Honest test: add rect, enable Show Dimensions, assert `.sveltedraw-measurement-dimension` element exists with text matching `${width} × ${height}`.

**Effort:** L (6 h) — three subfeatures.
**Risk:** Zoom/scroll math is error-prone; need precise scene-to-viewport conversion.

---

### A6. Alignment Smart Guides Actually Render

**Files:** `packages/excalidraw-svelte/src/App.svelte:~2072-2088` (updateAlignmentGuides calculates, `alignmentGuides` state is populated), no renderer reads it.

**Status now:** Guide lines are computed into `alignmentGuides[]` but no SVG/canvas layer draws them.

**Work:**
1. Add an SVG overlay layer that reads `alignmentGuides` and renders each guide as `<line stroke="#6965db" stroke-dasharray="4 4">`.
2. Guides appear during drag/resize; clear on pointerup.
3. Snap-to-elements (A4) and alignment guides share the same "align to neighbors" computation — consolidate into one module `src/snap/guides.ts` so both features stay in sync.

**Acceptance:**
- Drag a rectangle near another's left edge → dotted vertical line appears at the shared x.
- Release → guide disappears.
- Honest test: seed two rects, simulate drag of one to align, assert `.sveltedraw-guide-line` SVG element count == 1 at the expected x.

**Effort:** M (2 h) if built on A4's computation.
**Dependency:** A4 (snap-to-elements) — do these together.

---

### A7. PDF Export

**Files:** `packages/excalidraw-svelte/src/App.svelte:~2719-2728` (window.alert stub from commit `a4e28bdb`).

**Status now:** Correct bail-out with honest alert. Not broken, just not supported.

**Work:**
1. Add `jspdf` dependency (~350 KB minified, lazy-loaded).
2. PDF export flow: render to canvas (reuse exportToBlob pipeline from Task 2 of original plan), embed PNG as image in a single-page PDF with dimensions = options.width × options.height (mm or pt converted from px at 96 dpi).
3. Multi-page: if scene has multiple frames, one page per frame; else one page.
4. Dynamic import (`const { jsPDF } = await import('jspdf')`) so PDF code only loads when user clicks PDF.

**Acceptance:**
- Click Export → PDF → real PDF file downloads.
- PDF opens in browser / Preview / Adobe — shows the drawing.
- Honest test: trigger PDF export, intercept blob, assert first 4 bytes are `%PDF`.

**Effort:** M (2 h).
**Risk:** Bundle size impact. Lazy loading mitigates.

---

### A8. Locked Elements Truly Lock

**Files:** `packages/excalidraw-svelte/src/App.svelte:~3541-3554` (toggle), `~5217` (filter in getSelectedElements).

**Status now:** Lock toggle works for UI, LayerPanel shows lock icon. **But** direct pointerdown on a locked element still moves it (drag-select respects lock, direct hit does not).

**Work:**
1. In `onInteractivePointerDown`, when hit-testing, skip elements with `locked === true` OR treat them as transparent to pointer events (upstream behavior).
2. Locked elements still render a selection outline when the user clicks them (just a visual "this is locked" hint), but drag/resize handles don't appear.
3. Ctrl+Shift+L on a locked element unlocks it (already wired, verify).

**Acceptance:**
- Lock a rect → click-drag on it does nothing.
- Lock a rect → click it → outline appears with padlock icon, no handles.
- Honest test: seed a rect, set locked=true, simulate pointerdown at its center, assert element.x/y unchanged.

**Effort:** S (1 h).

---

### A9. Consolidate TextEditorPanel

**Files:** `packages/excalidraw-svelte/src/components/TextEditorPanel.svelte`, `App.svelte` (✏️ button toggles `texteditor` panel).

**Status now:** After the Format row was added to the style panel (`51f7ae2f`), TextEditorPanel duplicates B/I/U/S + alignment + color. It still has line-height slider + rotation slider that the style panel doesn't have.

**Work:** Two options:
- **Option A (delete):** Remove `TextEditorPanel.svelte`, remove ✏️ toolbar button, move the non-duplicate bits (line-height, rotation) into the style panel's text section. Simplest UI.
- **Option B (keep as advanced):** Keep it as "Text advanced" for typography nerds — remove the duplicated B/I/U/S/align from TextEditorPanel (keep only line-height, rotation, font-weight numeric slider). Two-tier system.

**Recommendation:** Option A. Two panels for same feature = confusion.

**Acceptance:**
- No ✏️ button in toolbar.
- Line-height slider visible in style panel when text selected; changing it alters `element.lineHeight`; SVG export reflects.
- Rotation slider (already present in text editor panel) moved to style panel's Actions row.
- Honest test: unchanged (no regression in text styling tests).

**Effort:** S (45 min).
**Dependency:** Verify renderer honors `lineHeight` (it does, already in use via `getLineHeightInPx`).

---

## Track B — Missing Upstream Features (HIGH)

### B1. Frame / Magic Frame

**Files:** `packages/element/src/types.ts:74` (frameId field), existing frame.ts logic in upstream `@excalidraw/element` imported but not surfaced.

**Status now:** `frameId` is a field on every element; Phase 11 created `frames = $state(new Map)` and helper functions (createFrame/renameFrame/addElementToFrame). No toolbar button, no rendering, no selection by frame, no drag-drop-into-frame.

**Work:**
1. Add Frame tool button (🖼 or similar) to toolbar. Click → drag to create frame.
2. Frames render as a labeled rectangular container on canvas (frame title bar at top).
3. Elements whose `frameId === frame.id` clip inside the frame bounds on export.
4. Drag element into frame → auto-bind.
5. Frames panel (separate sidebar, mutually exclusive like other side panels) lists frames, click-to-focus.
6. Presentation mode already segments by frames (see `handleStartPresentation`) — will Just Work.

**Acceptance:**
- Create a frame, drag a rectangle into it → rectangle's `frameId` updates.
- Export SVG of frame only (via frame context menu → Export).
- Honest test: create frame + 2 elements, assign 1 to frame, export frame only, assert SVG contains only 1 shape.

**Effort:** L (6 h).
**Risk:** Complex UX; test thoroughly.

---

### B2. Eraser Tool

**Files:** `packages/excalidraw-svelte/src/icons/icons.ts:127` (icon exists), no tool implementation.

**Status now:** Icon defined but not mounted in toolbar, `activeTool.type === "eraser"` never handled.

**Work:**
1. Add eraser button to toolbox (next to freedraw, upstream position).
2. When active: pointermove hit-tests elements under cursor; on hit, mark `isDeleted: true` (soft delete).
3. Drag-erase: every element crossed while pointer is down gets deleted.
4. Undo restores them (existing history system already handles).
5. Cursor shows eraser icon.

**Acceptance:**
- Select eraser, drag over 3 shapes → all 3 marked deleted.
- Undo → all 3 back.
- Honest test: seed 3 rects, activate eraser, simulate drag across, assert all isDeleted=true.

**Effort:** M (2 h).

---

### B3. Iframe / Embeddable Elements

**Files:** `packages/element/src/types.ts:100-125` (types), no UI.

**Status now:** Types exist; no insert button; upstream supports YouTube / Excalidraw+ / CodePen embeds.

**Work:**
1. Paste URL handler: if clipboard is a URL matching allowlist (YouTube, Vimeo, Excalidraw+), auto-create an Iframe element.
2. Menu item: Insert → Embed → URL input.
3. Renderer: Canvas shows a placeholder (thumbnail or icon); actual iframe renders as DOM overlay when element is in viewport (upstream pattern).

**Acceptance:**
- Paste a YouTube URL → iframe element appears, plays video.
- Export SVG shows static placeholder (iframes aren't valid in SVG).
- Honest test: dispatch paste event with YouTube URL, assert scene has new element with type `iframe`.

**Effort:** L (4 h).
**Risk:** Security — iframe sandbox is mandatory. URL allowlist.

---

### B4. PNG Paste Metadata

**Files:** `packages/excalidraw-svelte/src/App.svelte:~3167-3180` (onContainerPaste).

**Status now:** Generic image paste works (any image becomes an ExcalidrawImageElement). But Excalidraw's own PNGs contain embedded scene JSON in a private chunk (see upstream `encodePngMetadata`). Pasting an Excalidraw-exported PNG back into the editor should restore all elements, not insert a flat image.

**Work:**
1. On PNG paste, try `decodePngMetadata` (helper exists in `packages/excalidraw/data/image.ts`).
2. If metadata present → `restoreElements` + `replaceAllElements`. Skip creating an image.
3. Else → fall through to generic image paste.

**Acceptance:**
- Export scene to PNG with `exportEmbedScene: true`.
- Paste that PNG into a fresh instance → scene restored identically (not a flat image).
- Honest test: export 2 rects, inspect PNG for private chunk, simulate paste, assert scene has 2 rect elements again.

**Effort:** S (1 h).

---

## Track C — New Visual Feature

### C1. Drop Shadow

**Files to touch:** `packages/element/src/types.ts` (add `shadow?: ShadowConfig` to base element), `packages/element/src/renderElement.ts` (apply `ctx.shadowColor`/`shadowOffsetX`/`shadowOffsetY`/`shadowBlur` before stroke/fill), `packages/excalidraw/renderer/staticSvgScene.ts` (emit `<filter id="shadow-N"><feGaussianBlur><feOffset>…` and reference via `filter=url(#shadow-N)`), `App.svelte` (UI row).

**Scope mirrors the text-styling commit (`51f7ae2f`) that's already proven.**

**Work:**
1. Define `ShadowConfig = { color: string; offsetX: number; offsetY: number; blur: number } | null` in `_ExcalidrawElementBase`.
2. Canvas: in renderElement.ts, save context, set ctx.shadow*, draw, restore.
3. SVG: generate a unique `<filter>` per element with shadow, append to `<defs>`, reference via `filter=url(#...)` on the element's `<g>`.
4. UI: Shadow row with on/off toggle + 3 presets (None / Soft / Hard) + color picker. Presets: None=null, Soft={color:#0003, x:4, y:4, blur:8}, Hard={color:#000, x:6, y:6, blur:0}.

**Acceptance:**
- Toggle shadow on a rect → canvas shows shadow.
- Export SVG → contains `<filter>` with `feGaussianBlur`.
- Export PNG → byte-diff between shadow on/off (similar to text styling test).
- Honest test: 3 assertions (SVG filter present, PNG differs, upstream-only path has no filter).

**Effort:** M (2–3 h).
**Risk:** PNG export scale interaction — shadow blur in world units must scale with `options.scale` so 2× export matches 1× appearance.

---

### C2. Element Flip (H/V)

**Files:** `packages/excalidraw-svelte/src/App.svelte` (new action + style panel button), `packages/element/src/transformHandles.ts` (for visual flip during resize already handled).

**Status now:** Images have `scale: [sx, sy]` that can go negative, renderer may already respect it (verify). Shapes use width/height positive only — flip == swap point order for lines, mirror around bounding box for shapes.

**Work:**
1. Two buttons in style panel Actions row: ⇔ (Horizontal), ⇕ (Vertical).
2. For images: negate scale[0] or scale[1].
3. For lines/arrows/freedraw: mirror `points[]` around bounding box axis.
4. For rectangles/ellipses/diamonds/text: visually symmetric, no-op (skip or disable buttons).

**Acceptance:**
- Flip image horizontally → image visually mirrored on canvas + export.
- Flip arrow → arrowhead moves to the other end.
- Honest test: create arrow pointing right, flip H, assert endArrowhead now at startPoint.

**Effort:** M (2 h).

---

## Track D — Polish / Infra (MEDIUM / LOW)

### D1. Dark mode for 17 orphan components

**Files:** `ActiveConfirmDialog.svelte`, `Button.svelte`, `ButtonIcon.svelte`, `ColorInput.svelte`, `ColorPicker.svelte`, `ColorPickerTrigger.svelte`, `Picker.svelte`, `PickerColorList.svelte`, `PickerHeading.svelte`, `ShadeList.svelte`, `TopPicks.svelte`, `CommandPalette.svelte`, `ContextMenu.svelte`, `Dialog.svelte`, `DropdownMenu*.svelte` (≥ 8 files).

**Work:** Add `:global(.excalidraw.theme--dark) .class { ... }` selectors for backgrounds, borders, text colors. Reuse the palette from existing dark-mode styling (e.g., `#232329`, `#2e2e36`, `#e5e7ea`).

**Acceptance:** Switch to dark mode → every one of these components renders with dark background, light text, no white boxes.
**Honest test:** take a dark-mode screenshot of each panel, assert no pixels brighter than #666 except actual text/icons.

**Effort:** M (2 h).

---

### D2. i18n for utility panels

**Files:** `AlignmentPanel.svelte`, `AutoLayoutPanel.svelte`, `GridPanel.svelte`, `MeasurementPanel.svelte`, `ConnectorTool.svelte`, `LoadingMessage.svelte`.

**Work:** Replace hardcoded English ("Select 2+ shapes...", "Enable Grid", etc.) with `t(...)` calls. Add translation keys to locale files.

**Acceptance:** Switch to Vietnamese → labels translate. `grep -r 'Select 2+' packages/excalidraw-svelte/src/components/` returns no hits.
**Effort:** S (1 h).

---

### D3. Presentation auto-advance timer

**Files:** `App.svelte` (presentation state), `components/PresentationMode.svelte`.

**Work:** Add `$effect` that when `isPlaying && autoAdvanceDuration > 0`, sets a `setInterval` calling `handlePresentationNextSlide` every `autoAdvanceDuration` ms. Clear interval when `isPlaying` goes false or component unmounts.

**Acceptance:** Start presentation, click play → slide advances every N ms. Pause → stops. Honest test already has slide counter; add assertion after delay.

**Effort:** S (30 min).

---

### D4. Preferred language detection

**Files:** `packages/excalidraw-svelte/src/state/appStore.svelte.ts:59` (TODO).

**Work:** Call `i18next-browser-languagedetector` on init, use detected language as default (fall back to 'en').

**Acceptance:** Browser set to vi-VN → app loads in Vietnamese without user switching.
**Effort:** S (15 min).

---

### D5. EyeDropper viewport clip FIXME

**Files:** `packages/excalidraw-svelte/src/components/EyeDropper.svelte:94`.

**Work:** Read viewport dimensions, if preview would clip right edge, flip offset to left side.
**Effort:** S (15 min).

---

## Low-priority items (deferred)

These do not warrant attention until the above are done:

- **customData field** — no user-visible facade, just dormant data.
- **AutoLayout quality benchmark** — layouts work; whether they're optimal is a separate concern.
- **Group tracking "for now" comment** — workaround is functional.

---

## Recommended Sequencing

**Phase 17A (1–2 days):** Track A — facade cleanup. Biggest perceived quality jump per hour. Order within A1 → A9 by user-visibility:
1. A3 Connector (most visible facade)
2. A4 + A6 Snap + Guides (both needed, share math)
3. A5 Measurement (3 subfeatures)
4. A1 Element links
5. A2 Laser pointer
6. A7 PDF (adds jspdf dep; do last in this batch)
7. A8 Lock enforcement
8. A9 Consolidate TextEditorPanel

**Phase 17B (1 day):** Track B — high-value upstream ports. Order:
1. B4 PNG paste metadata (easy win)
2. B2 Eraser
3. B1 Frame (complex, do carefully)
4. B3 Iframe/embed (security work, do last)

**Phase 17C (0.5 day):** Track C — drop shadow + element flip. C1 first (bigger impact), C2 second.

**Phase 17D (ongoing):** Track D — polish as part of every future commit (not a discrete phase).

## Global acceptance criteria

- Every item shipped with an assertion in `test-phase16-honest.js` (or a renamed master test file).
- Every renderer change byte-verified against SVG + PNG (no fontWeight-style facades).
- Every new UI element renders correctly in dark mode (Track D1 is a blocker for the others' UI).
- Commit message names exactly what changed + cites the acceptance test.

## Unknowns / things to verify before starting each item

- A4 snap: exact pointermove hook to instrument. Read `onInteractivePointerMove` first.
- B1 frame: upstream import surface — does `@excalidraw/element` export frame render helpers that sveltedraw can reuse?
- C1 shadow: does `exportToCanvas`'s `getDimensions` override interact with `ctx.shadowBlur`? Probe.
- A3 connector: whether to replace custom connectors with arrow+binding depends on how many places the current `connectors[]` array is read. Grep first.

---

**Next action after user approves this plan:** pick a starting item and begin. Author will propose A3 (connector) first — it's the most visibly-broken feature and the work is self-contained.

// Phase 6 smoke: launch headless Chrome at /#app, collect console messages
// + runtime exceptions for SMOKE_TIMEOUT_MS (default 5000ms), exit non-zero
// on error or missing animation ticks.
//
// Why: App.svelte's engine-context factory returns a throwing Proxy. Only a
// browser mount fires those throws — svelte-check / vite build miss them.
// Batch 3 adds: `window.__sveltedrawInteractiveTicks` counter incremented
// on every AnimationController tick. Smoke asserts count > 0 to prove the
// RAF loop is actually running (not just "registered but silent").

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const CHROME =
  process.env.CHROME ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3002/#app";
const CDP_PORT = 9333;
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 5000);

const tmp = mkdtempSync(join(tmpdir(), "chrome-smoke-"));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmp}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1280,900",
    APP_URL,
  ],
  { stdio: "ignore", detached: false },
);

const cleanup = () => {
  try {
    chrome.kill("SIGKILL");
  } catch {}
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
};
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

async function waitForDevtools(port, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        const body = await res.json();
        return body.webSocketDebuggerUrl;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("devtools never came up");
}

async function findPage(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  const tabs = await res.json();
  const page = tabs.find(
    (t) => t.type === "page" && !t.url.startsWith("devtools://"),
  );
  if (!page) throw new Error("no page target");
  return page.webSocketDebuggerUrl;
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { perMessageDeflate: false });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

const consoleMsgs = [];
const exceptions = [];

async function main() {
  await waitForDevtools(CDP_PORT);
  const pageUrl = await findPage(CDP_PORT);
  const ws = await connect(pageUrl);

  let nextId = 1;
  const pending = new Map();
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === "Console.messageAdded") {
      consoleMsgs.push(msg.params.message);
    } else if (msg.method === "Runtime.consoleAPICalled") {
      consoleMsgs.push({
        level: msg.params.type,
        text: (msg.params.args || [])
          .map((a) => a.value ?? a.description ?? a.unserializableValue ?? "")
          .join(" "),
      });
    } else if (msg.method === "Runtime.exceptionThrown") {
      exceptions.push(msg.params.exceptionDetails);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, (m) => resolve(m.result));
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send("Runtime.enable");
  await send("Console.enable");
  await send("Page.enable");
  // Wipe localStorage BEFORE the reload so App.svelte's tryLoad() finds
  // nothing and mounts an empty scene. Batch 13 persists scene state, so
  // without this, the prior smoke run's 6 shapes would carry over and
  // break the "count=1" assertions.
  await send("Runtime.evaluate", {
    expression: `try { localStorage.removeItem('sveltedraw:scene:v1'); } catch {}`,
  });
  // Reload to re-capture initial mount (the initial page load may have
  // fired before we subscribed).
  await send("Page.reload", { ignoreCache: true });

  await new Promise((r) => setTimeout(r, TIMEOUT_MS));

  // ── Batch 4 interaction check ───────────────────────────────────────
  // Expose the editor's appState + scene on `window.__sveltedrawProbe` from
  // App.svelte (DEV-only) so the smoke can assert the draw flow worked.
  // Press "r" → tool switch, then simulate pointerdown/move/up → verify
  // scene has one rectangle element.
  await send("Runtime.evaluate", {
    expression: `(async () => {
      const container = document.querySelector('.excalidraw-container');
      const iv = document.querySelector('.excalidraw__canvas.interactive');
      if (!container || !iv) return { error: 'container or interactive canvas missing' };

      // 1) focus + press "r" to select rectangle tool
      container.focus();
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
      await new Promise(r => setTimeout(r, 50));

      // 2) simulate pointerdown/move/up at roughly center
      const rect = iv.getBoundingClientRect();
      const startX = rect.left + 200;
      const startY = rect.top + 200;
      const endX = startX + 150;
      const endY = startY + 100;

      const mk = (type, x, y) => new PointerEvent(type, {
        clientX: x, clientY: y, button: 0, pointerId: 1, bubbles: true, cancelable: true,
      });
      iv.dispatchEvent(mk('pointerdown', startX, startY));
      await new Promise(r => setTimeout(r, 30));
      iv.dispatchEvent(mk('pointermove', endX, endY));
      await new Promise(r => setTimeout(r, 30));
      iv.dispatchEvent(mk('pointerup', endX, endY));
      await new Promise(r => setTimeout(r, 100));

      const p = window.__sveltedrawProbe;
      if (!p) return { error: 'no __sveltedrawProbe exposed' };

      const afterDraw = {
        activeToolType: p.appState?.activeTool?.type,
        elementsCount: p.scene?.getNonDeletedElements?.()?.length ?? null,
        firstElementType: p.scene?.getNonDeletedElements?.()?.[0]?.type ?? null,
        firstElementW: p.scene?.getNonDeletedElements?.()?.[0]?.width ?? null,
        firstElementH: p.scene?.getNonDeletedElements?.()?.[0]?.height ?? null,
        firstElementX: p.scene?.getNonDeletedElements?.()?.[0]?.x ?? null,
        firstElementY: p.scene?.getNonDeletedElements?.()?.[0]?.y ?? null,
      };

      // ── Batch 6: switch to selection, click to select, drag to move ──
      container.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      await new Promise(r => setTimeout(r, 50));

      // Click near the center of the drawn rectangle.
      const el0 = p.scene?.getNonDeletedElements?.()?.[0];
      const origX = el0?.x ?? 0;
      const origY = el0?.y ?? 0;
      // Convert scene coords to viewport coords for the click.
      const zoom = p.appState?.zoom?.value ?? 1;
      const offsetLeft = p.appState?.offsetLeft ?? 0;
      const offsetTop = p.appState?.offsetTop ?? 0;
      const scrollX = p.appState?.scrollX ?? 0;
      const scrollY = p.appState?.scrollY ?? 0;
      const centerSceneX = origX + (el0?.width ?? 100) / 2;
      const centerSceneY = origY + (el0?.height ?? 100) / 2;
      const clickX = (centerSceneX + scrollX) * zoom + offsetLeft;
      const clickY = (centerSceneY + scrollY) * zoom + offsetTop;

      iv.dispatchEvent(mk('pointerdown', clickX, clickY));
      await new Promise(r => setTimeout(r, 30));
      iv.dispatchEvent(mk('pointerup', clickX, clickY));
      await new Promise(r => setTimeout(r, 50));

      const afterSelect = {
        selectedIds: Object.keys(p.appState?.selectedElementIds ?? {}),
      };

      // Drag: pointerdown → pointermove (+80, +40) → pointerup.
      iv.dispatchEvent(mk('pointerdown', clickX, clickY));
      await new Promise(r => setTimeout(r, 30));
      iv.dispatchEvent(mk('pointermove', clickX + 80, clickY + 40));
      await new Promise(r => setTimeout(r, 30));
      iv.dispatchEvent(mk('pointerup', clickX + 80, clickY + 40));
      await new Promise(r => setTimeout(r, 50));

      const el1 = p.scene?.getNonDeletedElements?.()?.[0];
      const afterDrag = {
        movedX: (el1?.x ?? 0) - origX,
        movedY: (el1?.y ?? 0) - origY,
      };

      // Click empty space (far outside the rectangle) → clear selection.
      iv.dispatchEvent(mk('pointerdown', rect.left + 10, rect.top + 10));
      iv.dispatchEvent(mk('pointerup', rect.left + 10, rect.top + 10));
      await new Promise(r => setTimeout(r, 50));

      const afterClickEmpty = {
        selectedIds: Object.keys(p.appState?.selectedElementIds ?? {}),
      };

      // ── Batch 7: keyboard shortcuts ──────────────────────────────────
      // Draw a second rectangle for select-all testing.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
      await new Promise(r => setTimeout(r, 30));
      const r2StartX = rect.left + 500;
      const r2StartY = rect.top + 300;
      iv.dispatchEvent(mk('pointerdown', r2StartX, r2StartY));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(mk('pointermove', r2StartX + 80, r2StartY + 60));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(mk('pointerup', r2StartX + 80, r2StartY + 60));
      await new Promise(r => setTimeout(r, 50));
      const afterSecondDraw = {
        count: p.scene?.getNonDeletedElements?.()?.length ?? 0,
      };

      // Ctrl+A select all
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterSelectAll = {
        selectedCount: Object.keys(p.appState?.selectedElementIds ?? {}).length,
      };

      // Arrow-right (no shift) → nudge both by 1px
      const el2BeforeNudge = p.scene?.getNonDeletedElements?.()?.[0];
      const xBeforeNudge = el2BeforeNudge?.x ?? 0;
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterNudge1 = {
        dx: ((p.scene?.getNonDeletedElements?.()?.[0]?.x ?? 0) - xBeforeNudge),
      };

      // Shift+ArrowRight → nudge by 5
      const xBeforeShiftNudge = p.scene?.getNonDeletedElements?.()?.[0]?.x ?? 0;
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterShiftNudge = {
        dx: ((p.scene?.getNonDeletedElements?.()?.[0]?.x ?? 0) - xBeforeShiftNudge),
      };

      // Ctrl+D duplicate (both selected)
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterDuplicate = {
        count: p.scene?.getNonDeletedElements?.()?.length ?? 0,
        selectedCount: Object.keys(p.appState?.selectedElementIds ?? {}).length,
      };

      // Delete — selection is now the duplicates; should remove those.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterDelete = {
        count: p.scene?.getNonDeletedElements?.()?.length ?? 0,
        selectedCount: Object.keys(p.appState?.selectedElementIds ?? {}).length,
      };

      // ── Batch 8: undo/redo ────────────────────────────────────────
      // State right now: 2 rectangles, selection empty (Delete cleared it).
      // Undo the delete → should restore 4 rectangles.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterUndoDelete = {
        count: p.scene?.getNonDeletedElements?.()?.length ?? 0,
      };

      // Redo the delete → back to 2 rectangles.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterRedoDelete = {
        count: p.scene?.getNonDeletedElements?.()?.length ?? 0,
      };

      // Undo the delete again, then Ctrl+Y (Windows redo) to re-delete.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterCtrlY = {
        count: p.scene?.getNonDeletedElements?.()?.length ?? 0,
      };

      // ── Batch 10: zoom + pan ──────────────────────────────────────
      // State snapshot before zoom fiddling.
      const zoomBefore = p.appState?.zoom?.value ?? 1;
      const scrollXBefore = p.appState?.scrollX ?? 0;
      const scrollYBefore = p.appState?.scrollY ?? 0;

      // Ctrl+wheel zoom in
      iv.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true,
        clientX: rect.left + 400, clientY: rect.top + 400,
      }));
      await new Promise(r => setTimeout(r, 30));
      const afterZoomIn = {
        zoom: p.appState?.zoom?.value ?? 0,
      };

      // Ctrl+0 reset
      container.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterZoomReset = {
        zoom: p.appState?.zoom?.value ?? 0,
      };

      // Plain wheel pan
      iv.dispatchEvent(new WheelEvent('wheel', {
        deltaX: 50, deltaY: 30, bubbles: true, cancelable: true,
        clientX: rect.left + 400, clientY: rect.top + 400,
      }));
      await new Promise(r => setTimeout(r, 30));
      const afterPan = {
        dx: (p.appState?.scrollX ?? 0) - scrollXBefore,
        dy: (p.appState?.scrollY ?? 0) - scrollYBefore,
      };

      // Ctrl+= zoom in via key
      container.dispatchEvent(new KeyboardEvent('keydown', { key: '=', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterKeyZoomIn = {
        zoom: p.appState?.zoom?.value ?? 0,
      };

      // Middle-mouse-button drag pan
      const mStart = { x: rect.left + 400, y: rect.top + 400 };
      const xBeforeMidPan = p.appState?.scrollX ?? 0;
      iv.dispatchEvent(new PointerEvent('pointerdown', { clientX: mStart.x, clientY: mStart.y, button: 1, pointerId: 5, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(new PointerEvent('pointermove', { clientX: mStart.x + 100, clientY: mStart.y + 0, pointerId: 5, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(new PointerEvent('pointerup', { clientX: mStart.x + 100, clientY: mStart.y, button: 1, pointerId: 5, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterMiddlePan = {
        dx: (p.appState?.scrollX ?? 0) - xBeforeMidPan,
      };

      // ── Batch 5: each shape tool draws its own element type ─────────
      // Reset to a clean slate via Ctrl+A → Delete so assertion numbers
      // don't drift due to earlier test state.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 20));
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 20));
      // Reset zoom so programmatic coords land where we expect.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 20));

      const drawShape = async (hotkey, sx, sy, ex, ey) => {
        container.dispatchEvent(new KeyboardEvent('keydown', { key: hotkey, bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 10));
        iv.dispatchEvent(mk('pointerdown', sx, sy));
        await new Promise(r => setTimeout(r, 10));
        iv.dispatchEvent(mk('pointermove', sx + (ex - sx) * 0.5, sy + (ey - sy) * 0.5));
        await new Promise(r => setTimeout(r, 10));
        iv.dispatchEvent(mk('pointermove', ex, ey));
        await new Promise(r => setTimeout(r, 10));
        iv.dispatchEvent(mk('pointerup', ex, ey));
        await new Promise(r => setTimeout(r, 30));
      };

      await drawShape('2', rect.left + 100, rect.top + 100, rect.left + 200, rect.top + 150);  // rectangle
      await drawShape('3', rect.left + 250, rect.top + 100, rect.left + 350, rect.top + 150);  // diamond
      await drawShape('4', rect.left + 400, rect.top + 100, rect.left + 500, rect.top + 150);  // ellipse
      await drawShape('5', rect.left + 100, rect.top + 250, rect.left + 200, rect.top + 300);  // arrow
      await drawShape('6', rect.left + 250, rect.top + 250, rect.left + 350, rect.top + 300);  // line

      // Freedraw — need multiple pointermoves to create a path.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      const fdStart = { x: rect.left + 400, y: rect.top + 250 };
      iv.dispatchEvent(mk('pointerdown', fdStart.x, fdStart.y));
      await new Promise(r => setTimeout(r, 10));
      for (let i = 1; i <= 10; i++) {
        iv.dispatchEvent(mk('pointermove', fdStart.x + i * 10, fdStart.y + Math.sin(i) * 20));
        await new Promise(r => setTimeout(r, 5));
      }
      iv.dispatchEvent(mk('pointerup', fdStart.x + 100, fdStart.y));
      await new Promise(r => setTimeout(r, 30));

      const allShapes = p.scene?.getNonDeletedElements?.() ?? [];
      const freedraw = allShapes.find(el => el.type === 'freedraw');
      const shapeTypes = allShapes.map(el => el.type);
      const afterShapes = {
        count: allShapes.length,
        types: shapeTypes,
        freedrawPointCount: freedraw?.points?.length ?? 0,
      };

      // ── Batch 13: localStorage persistence + clear canvas ─────────
      // Wait past the 500ms debounce so the save is flushed.
      await new Promise(r => setTimeout(r, 600));
      let storedRaw = localStorage.getItem('sveltedraw:scene:v1');
      let stored = null;
      try { stored = JSON.parse(storedRaw); } catch {}
      const afterSaveCheck = {
        hasKey: !!storedRaw,
        elementCount: stored?.elements?.length ?? 0,
        hasViewport: stored?.appState?.zoom?.value != null,
      };

      // Ctrl+Shift+Delete → clear canvas (undoable).
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterClearCanvas = {
        count: p.scene?.getNonDeletedElements?.()?.length ?? -1,
      };

      // Undo the clear → scene restored.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterUndoClear = {
        count: p.scene?.getNonDeletedElements?.()?.length ?? 0,
      };

      // ── Batch 14: resize ──────────────────────────────────────────
      // Select the first rectangle (back from the undo-clear), grab its SE
      // handle, drag it +60,+40. Verify width/height changed by ~60/40,
      // x/y unchanged (SE handle only moves the opposite corner).
      container.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true }));  // selection
      await new Promise(r => setTimeout(r, 20));

      const rectEl = p.scene?.getNonDeletedElements?.()?.find(el => el.type === 'rectangle');
      if (!rectEl) return { ...afterDraw, afterUndoClear, resizeErr: 'no rectangle' };

      const zoomR = p.appState?.zoom?.value ?? 1;
      const offLeft = p.appState?.offsetLeft ?? 0;
      const offTop = p.appState?.offsetTop ?? 0;
      const scrX = p.appState?.scrollX ?? 0;
      const scrY = p.appState?.scrollY ?? 0;
      const sceneToVp = (sx, sy) => ({
        x: (sx + scrX) * zoomR + offLeft,
        y: (sy + scrY) * zoomR + offTop,
      });

      // Click center to select
      const centerVp = sceneToVp(rectEl.x + rectEl.width / 2, rectEl.y + rectEl.height / 2);
      iv.dispatchEvent(mk('pointerdown', centerVp.x, centerVp.y));
      iv.dispatchEvent(mk('pointerup', centerVp.x, centerVp.y));
      await new Promise(r => setTimeout(r, 30));

      const origW = rectEl.width;
      const origH = rectEl.height;
      const origRectX = rectEl.x;
      const origRectY = rectEl.y;

      // SE handle in scene coords = (x + w, y + h).
      const seVp = sceneToVp(rectEl.x + rectEl.width, rectEl.y + rectEl.height);
      iv.dispatchEvent(mk('pointerdown', seVp.x, seVp.y));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(mk('pointermove', seVp.x + 60 * zoomR, seVp.y + 40 * zoomR));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(mk('pointerup', seVp.x + 60 * zoomR, seVp.y + 40 * zoomR));
      await new Promise(r => setTimeout(r, 30));

      const rectAfter = p.scene?.getNonDeletedElements?.()?.find(el => el.id === rectEl.id);
      const afterResizeSE = {
        dw: (rectAfter?.width ?? 0) - origW,
        dh: (rectAfter?.height ?? 0) - origH,
        dx: (rectAfter?.x ?? 0) - origRectX,
        dy: (rectAfter?.y ?? 0) - origRectY,
      };

      // Drag NW handle -20, -10 → x/y shrink, width/height GROW (since
      // NW moves the top-left corner outward).
      const nwVp = sceneToVp(rectAfter.x, rectAfter.y);
      const origW2 = rectAfter.width;
      const origH2 = rectAfter.height;
      const origX2 = rectAfter.x;
      const origY2 = rectAfter.y;
      iv.dispatchEvent(mk('pointerdown', nwVp.x, nwVp.y));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(mk('pointermove', nwVp.x - 20 * zoomR, nwVp.y - 10 * zoomR));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(mk('pointerup', nwVp.x - 20 * zoomR, nwVp.y - 10 * zoomR));
      await new Promise(r => setTimeout(r, 30));

      const rectAfterNW = p.scene?.getNonDeletedElements?.()?.find(el => el.id === rectEl.id);
      const afterResizeNW = {
        dx: (rectAfterNW?.x ?? 0) - origX2,
        dy: (rectAfterNW?.y ?? 0) - origY2,
        dw: (rectAfterNW?.width ?? 0) - origW2,
        dh: (rectAfterNW?.height ?? 0) - origH2,
      };

      // Undo the NW resize → back to post-SE dims.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const rectAfterUndoResize = p.scene?.getNonDeletedElements?.()?.find(el => el.id === rectEl.id);
      const afterUndoResize = {
        w: rectAfterUndoResize?.width ?? 0,
        h: rectAfterUndoResize?.height ?? 0,
      };

      // ── Batch 15: rotation handle ─────────────────────────────────
      // Select the first rectangle (fresh state after undo-of-resize),
      // grab its rotation handle, drag to 90°, verify element.angle.
      const rectForRot = p.scene?.getNonDeletedElements?.()?.find(el => el.type === 'rectangle');
      if (rectForRot) {
        // Click center to select (in case selection was cleared earlier).
        const rcCtr = sceneToVp(rectForRot.x + rectForRot.width / 2, rectForRot.y + rectForRot.height / 2);
        iv.dispatchEvent(mk('pointerdown', rcCtr.x, rcCtr.y));
        iv.dispatchEvent(mk('pointerup', rcCtr.x, rcCtr.y));
        await new Promise(r => setTimeout(r, 30));

        // Rotation handle position in scene coords (matches getRotationHandlePos
        // for an unrotated element: top-center, 16/zoom above bbox).
        const origAngle = rectForRot.angle || 0;
        const cxS = rectForRot.x + rectForRot.width / 2;
        const cyS = rectForRot.y + rectForRot.height / 2;
        const ROT_GAP = 16;
        const handleS = { x: cxS, y: rectForRot.y - ROT_GAP / zoomR };
        const handleVp = sceneToVp(handleS.x, handleS.y);

        // Start on the handle, drag to the RIGHT of the center (east) =
        // cursor angle 0, which when compared to start angle (-π/2, since
        // handle was above center) produces a delta of +π/2 = 90° clockwise.
        iv.dispatchEvent(mk('pointerdown', handleVp.x, handleVp.y));
        await new Promise(r => setTimeout(r, 20));
        const targetScene = { x: cxS + 80, y: cyS }; // east of center
        const targetVp = sceneToVp(targetScene.x, targetScene.y);
        iv.dispatchEvent(mk('pointermove', targetVp.x, targetVp.y));
        await new Promise(r => setTimeout(r, 20));
        iv.dispatchEvent(mk('pointerup', targetVp.x, targetVp.y));
        await new Promise(r => setTimeout(r, 30));

        const rotatedEl = p.scene?.getNonDeletedElements?.()?.find(el => el.id === rectForRot.id);
        var afterRotation = {
          origAngle,
          newAngle: rotatedEl?.angle ?? 0,
          deltaDeg: ((rotatedEl?.angle ?? 0) - origAngle) * 180 / Math.PI,
        };

        // Undo the rotation.
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 30));
        const restoredEl = p.scene?.getNonDeletedElements?.()?.find(el => el.id === rectForRot.id);
        var afterUndoRotation = {
          angle: restoredEl?.angle ?? 0,
        };
      } else {
        var afterRotation = { err: 'no rect for rotation test' };
        var afterUndoRotation = { err: 'skipped' };
      }

      // ── Batch 11: shift-click + marquee ───────────────────────────
      // Starting state: 6 shapes (after the batch 5 pass + subsequent
      // resize edits on the rectangle). Clear selection first.
      iv.dispatchEvent(mk('pointerdown', rect.left + 5, rect.top + 5));
      iv.dispatchEvent(mk('pointerup', rect.left + 5, rect.top + 5));
      await new Promise(r => setTimeout(r, 20));

      // Shift-click the rectangle → 1 selected.
      const rectNow = p.scene?.getNonDeletedElements?.()?.find(el => el.type === 'rectangle');
      const rectCtr = sceneToVp(rectNow.x + rectNow.width / 2, rectNow.y + rectNow.height / 2);
      iv.dispatchEvent(new PointerEvent('pointerdown', { clientX: rectCtr.x, clientY: rectCtr.y, button: 0, pointerId: 1, shiftKey: true, bubbles: true, cancelable: true }));
      iv.dispatchEvent(new PointerEvent('pointerup', { clientX: rectCtr.x, clientY: rectCtr.y, button: 0, pointerId: 1, shiftKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterShiftClick1 = {
        selectedCount: Object.keys(p.appState?.selectedElementIds ?? {}).length,
      };

      // Shift-click the diamond → 2 selected (additive).
      const diamondNow = p.scene?.getNonDeletedElements?.()?.find(el => el.type === 'diamond');
      const diaCtr = sceneToVp(diamondNow.x + diamondNow.width / 2, diamondNow.y + diamondNow.height / 2);
      iv.dispatchEvent(new PointerEvent('pointerdown', { clientX: diaCtr.x, clientY: diaCtr.y, button: 0, pointerId: 1, shiftKey: true, bubbles: true, cancelable: true }));
      iv.dispatchEvent(new PointerEvent('pointerup', { clientX: diaCtr.x, clientY: diaCtr.y, button: 0, pointerId: 1, shiftKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterShiftClick2 = {
        selectedCount: Object.keys(p.appState?.selectedElementIds ?? {}).length,
      };

      // Shift-click the diamond AGAIN → toggles off, 1 selected.
      iv.dispatchEvent(new PointerEvent('pointerdown', { clientX: diaCtr.x, clientY: diaCtr.y, button: 0, pointerId: 1, shiftKey: true, bubbles: true, cancelable: true }));
      iv.dispatchEvent(new PointerEvent('pointerup', { clientX: diaCtr.x, clientY: diaCtr.y, button: 0, pointerId: 1, shiftKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      const afterShiftClickToggleOff = {
        selectedCount: Object.keys(p.appState?.selectedElementIds ?? {}).length,
      };

      // Clear selection, then marquee around a region that contains at
      // least 3 of the 6 shapes. The shapes were drawn at:
      //   rectangle: (100,100)-(200,150)  -> then resized to include more
      //   diamond:   (250,100)-(350,150)
      //   ellipse:   (400,100)-(500,150)
      //   arrow:     (100,250)-(200,300)
      //   line:      (250,250)-(350,300)
      //   freedraw:  starting (400,250) zigzag
      // Marquee from (50,50) to (550,200) should hit rectangle+diamond+ellipse.
      iv.dispatchEvent(mk('pointerdown', rect.left + 5, rect.top + 5));
      iv.dispatchEvent(mk('pointerup', rect.left + 5, rect.top + 5));
      await new Promise(r => setTimeout(r, 20));

      const marqueeStart = sceneToVp(50, 50);
      const marqueeEnd = sceneToVp(550, 200);
      iv.dispatchEvent(mk('pointerdown', marqueeStart.x, marqueeStart.y));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(mk('pointermove', (marqueeStart.x + marqueeEnd.x) / 2, (marqueeStart.y + marqueeEnd.y) / 2));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(mk('pointermove', marqueeEnd.x, marqueeEnd.y));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(mk('pointerup', marqueeEnd.x, marqueeEnd.y));
      await new Promise(r => setTimeout(r, 50));
      const afterMarquee = {
        selectedCount: Object.keys(p.appState?.selectedElementIds ?? {}).length,
        selectedTypes: Object.keys(p.appState?.selectedElementIds ?? {})
          .map(id => p.scene?.getNonDeletedElementsMap?.()?.get(id)?.type)
          .sort(),
      };

      // Shift+marquee around the bottom row (y=250..300 area) → additive.
      const m2Start = sceneToVp(50, 240);
      const m2End = sceneToVp(230, 320);
      iv.dispatchEvent(new PointerEvent('pointerdown', { clientX: m2Start.x, clientY: m2Start.y, button: 0, pointerId: 1, shiftKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(new PointerEvent('pointermove', { clientX: m2End.x, clientY: m2End.y, pointerId: 1, shiftKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 20));
      iv.dispatchEvent(new PointerEvent('pointerup', { clientX: m2End.x, clientY: m2End.y, button: 0, pointerId: 1, shiftKey: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 50));
      const afterShiftMarquee = {
        selectedCount: Object.keys(p.appState?.selectedElementIds ?? {}).length,
      };

      // ── Batch 9: text tool ────────────────────────────────────────
      // Press "t", click on canvas, type into the textarea, Escape to
      // commit. Verify scene has a text element with the expected text.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 20));

      const textClickVp = sceneToVp(200, 400);
      iv.dispatchEvent(mk('pointerdown', textClickVp.x, textClickVp.y));
      iv.dispatchEvent(mk('pointerup', textClickVp.x, textClickVp.y));
      await new Promise(r => setTimeout(r, 100));

      const textarea = document.querySelector('.sveltedraw-text-editor');
      const afterTextOpen = {
        hasTextarea: !!textarea,
      };

      // Type by setting value + dispatching input (native keystrokes
      // in headless are flaky).
      if (textarea) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(textarea, 'hello world');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        // Dispatch Escape on the textarea directly → commit.
        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 50));
      }

      const textEls = (p.scene?.getNonDeletedElements?.() ?? []).filter(el => el.type === 'text');
      const afterTextCommit = {
        textareaGone: !document.querySelector('.sveltedraw-text-editor'),
        count: textEls.length,
        firstText: textEls[0]?.text ?? null,
      };

      // Vietnamese text roundtrip — exercises the Patrick Hand font fallback.
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 20));
      const vnClickVp = sceneToVp(200, 500);
      iv.dispatchEvent(mk('pointerdown', vnClickVp.x, vnClickVp.y));
      iv.dispatchEvent(mk('pointerup', vnClickVp.x, vnClickVp.y));
      await new Promise(r => setTimeout(r, 100));
      const vnTa = document.querySelector('.sveltedraw-text-editor');
      const vnPhrase = 'xin chào ả ẫ ặ đ ế';
      if (vnTa) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(vnTa, vnPhrase);
        vnTa.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        vnTa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 50));
      }
      const vnTextEl = (p.scene?.getNonDeletedElements?.() ?? []).find(el => el.type === 'text' && el.text === vnPhrase);
      const afterVnText = {
        found: !!vnTextEl,
        text: vnTextEl?.text ?? null,
      };

      // document.fonts.check(font, text) returns true iff at least one
      // loaded @font-face with matching family covers every codepoint
      // in text. Our @font-face Vietnamese alias for Excalifont should
      // make this return true for tone-mark chars.
      const fontCanRenderVn = {
        excalifont: document.fonts.check('20px Excalifont', 'ả ẫ ặ ế'),
        patrickhand: document.fonts.check('20px "Patrick Hand"', 'ả ẫ ặ ế'),
      };

      // ── Batch 12: export PNG + SVG ───────────────────────────────
      // Call probe helpers directly; avoids dealing with blob downloads
      // in headless. Asserts each returns a non-trivial output.
      let exportPng = null;
      let exportSvg = null;
      try {
        const pngBlob = await p.exportAsPng();
        exportPng = {
          isBlob: pngBlob instanceof Blob,
          size: pngBlob?.size ?? 0,
          type: pngBlob?.type ?? '',
        };
      } catch (err) {
        exportPng = { err: String(err) };
      }
      try {
        const svgEl = await p.exportAsSvg();
        exportSvg = {
          tag: svgEl?.tagName ?? '',
          childCount: svgEl?.querySelectorAll?.('*')?.length ?? 0,
          hasViewBox: !!svgEl?.getAttribute?.('viewBox'),
        };
      } catch (err) {
        exportSvg = { err: String(err) };
      }

      return {
        ...afterDraw,
        afterSelect, afterDrag, afterClickEmpty,
        afterSecondDraw, afterSelectAll, afterNudge1, afterShiftNudge,
        afterDuplicate, afterDelete,
        afterUndoDelete, afterRedoDelete, afterCtrlY,
        zoomBefore, afterZoomIn, afterZoomReset, afterPan, afterKeyZoomIn, afterMiddlePan,
        afterShapes, afterSaveCheck, afterClearCanvas, afterUndoClear,
        afterResizeSE, afterResizeNW, afterUndoResize,
        afterShiftClick1, afterShiftClick2, afterShiftClickToggleOff,
        afterMarquee, afterShiftMarquee,
        afterTextOpen, afterTextCommit,
        afterVnText, fontCanRenderVn,
        afterRotation, afterUndoRotation,
        exportPng, exportSvg,
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  }).then((r) => {
    // eslint-disable-next-line no-console
    console.log("=== Interaction probe ===");
    console.log(JSON.stringify(r.result?.value ?? r, null, 2));
    global.__probeResult = r.result?.value;
  });

  const domInfo = await send("Runtime.evaluate", {
    expression: `(() => {
      const canvases = [...document.querySelectorAll('canvas')];
      const pickBySel = (sel) => document.querySelector(sel);
      const checkCanvas = (canvas) => {
        if (!canvas) return { w: 0, h: 0, nonBlank: false };
        try {
          const w = Math.min(200, canvas.width);
          const h = Math.min(200, canvas.height);
          if (w <= 0 || h <= 0) return { w: canvas.width, h: canvas.height, nonBlank: false };
          const ctx = canvas.getContext('2d');
          const d = ctx.getImageData(0, 0, w, h).data;
          for (let i = 3; i < d.length; i += 4) {
            if (d[i] !== 0) return { w: canvas.width, h: canvas.height, nonBlank: true };
          }
          return { w: canvas.width, h: canvas.height, nonBlank: false };
        } catch (e) { return { w: canvas.width, h: canvas.height, nonBlank: false, err: String(e) }; }
      };
      const staticCanvas = pickBySel('.excalidraw__canvas.static');
      const interactiveCanvas = pickBySel('.excalidraw__canvas.interactive');
      // NewElement canvas is third <canvas>, no class marker.
      const newElementCanvas = canvases.find(c => !c.classList.contains('static') && !c.classList.contains('interactive'));
      const container = document.querySelector('.excalidraw-container');
      return {
        title: document.title,
        hasContainer: !!container,
        containerClasses: container ? container.className : null,
        containerTabIndex: container ? container.tabIndex : null,
        containerTranslate: container ? container.getAttribute('translate') : null,
        hasLayerUI: !!document.querySelector('.layer-ui__wrapper'),
        canvasCount: canvases.length,
        staticCanvas: checkCanvas(staticCanvas),
        interactiveCanvas: checkCanvas(interactiveCanvas),
        newElementCanvas: checkCanvas(newElementCanvas),
        interactiveTicks: window.__sveltedrawInteractiveTicks ?? 0,
        htmlLen: document.documentElement.outerHTML.length,
      };
    })()`,
    returnByValue: true,
  });

  // ── Batch 13 load-side test: reload page, verify scene restored ──
  // MUST run before ws.close() — we still need the CDP session.
  console.log("[smoke] reloading via window.location to test persistence...");
  await send("Runtime.evaluate", {
    expression: `window.location.reload()`,
  });
  await new Promise((r) => setTimeout(r, 2500));
  let afterReload = null;
  try {
    const afterReloadRes = await send("Runtime.evaluate", {
      expression: `(() => {
        const p = window.__sveltedrawProbe;
        if (!p?.scene) return { error: 'no probe' };
        const els = p.scene.getNonDeletedElements();
        return {
          count: els.length,
          types: els.map(el => el.type).sort(),
        };
      })()`,
      returnByValue: true,
    });
    afterReload = afterReloadRes?.result?.value;
    console.log("[smoke] afterReload:", JSON.stringify(afterReload));
  } catch (e) {
    console.log("[smoke] reload probe failed:", e?.message);
  }

  ws.close();
  cleanup();

  console.log("=== DOM snapshot ===");
  console.log(JSON.stringify(domInfo.result?.value ?? domInfo, null, 2));

  // Known-benign errors upstream logs: Excalidraw's Fonts class fetches
  // woff2 files from a broken esm.sh URL that doesn't resolve in this
  // dev setup. Export succeeds (text renders with system-font fallback).
  // Filter them out so they don't mask real regressions.
  const isBenignFontError = (text) =>
    typeof text === "string" &&
    (text.includes("Failed to load font") ||
      text.includes("Failed to fetch font family"));
  const errors = consoleMsgs.filter(
    (m) =>
      (m.level === "error" || m.level === "severe") &&
      !isBenignFontError(m.text),
  );
  console.log(`\n=== Console: ${consoleMsgs.length} messages, ${errors.length} errors, ${exceptions.length} exceptions ===`);
  for (const m of consoleMsgs) {
    console.log(`  [${m.level}] ${m.text?.slice(0, 400)}`);
  }
  for (const ex of exceptions) {
    console.log(
      `  EXCEPTION: ${ex.exception?.description ?? ex.text ?? JSON.stringify(ex)}`,
    );
  }

  const domResult = domInfo.result?.value;
  const assertions = [];
  const pass = (name, cond, detail = "") =>
    assertions.push({ name, ok: !!cond, detail });
  pass("container-mounted", domResult?.hasContainer);
  pass("layer-ui-mounted", domResult?.hasLayerUI);
  pass("three-canvases", domResult?.canvasCount === 3);
  pass(
    "static-canvas-painted",
    domResult?.staticCanvas?.nonBlank === true,
    `${domResult?.staticCanvas?.w}x${domResult?.staticCanvas?.h}`,
  );
  pass(
    "animation-ticking",
    (domResult?.interactiveTicks ?? 0) > 0,
    `ticks=${domResult?.interactiveTicks}`,
  );
  pass(
    "container-tabindex",
    domResult?.containerTabIndex === 0,
    `tabIndex=${domResult?.containerTabIndex}`,
  );
  pass(
    "container-translate-no",
    domResult?.containerTranslate === "no",
    `translate="${domResult?.containerTranslate}"`,
  );
  pass(
    "container-has-notranslate",
    (domResult?.containerClasses ?? "").includes("notranslate"),
    `class="${domResult?.containerClasses}"`,
  );

  // Batch 4 interaction assertions.
  const probe = global.__probeResult;
  pass(
    "keydown-r-switches-tool",
    probe?.activeToolType === "rectangle",
    `activeTool=${probe?.activeToolType}`,
  );
  pass(
    "draw-creates-element",
    probe?.elementsCount === 1,
    `count=${probe?.elementsCount}`,
  );
  pass(
    "drawn-element-is-rectangle",
    probe?.firstElementType === "rectangle",
    `type=${probe?.firstElementType}`,
  );
  pass(
    "drawn-element-has-size",
    (probe?.firstElementW ?? 0) > 10 && (probe?.firstElementH ?? 0) > 10,
    `${probe?.firstElementW}x${probe?.firstElementH}`,
  );

  // Batch 6: select + drag + clear.
  pass(
    "click-selects-element",
    (probe?.afterSelect?.selectedIds?.length ?? 0) === 1,
    `selectedIds=${JSON.stringify(probe?.afterSelect?.selectedIds)}`,
  );
  pass(
    "drag-moves-element-x",
    Math.abs((probe?.afterDrag?.movedX ?? 0) - 80) < 5,
    `movedX=${probe?.afterDrag?.movedX} (expected ~80)`,
  );
  pass(
    "drag-moves-element-y",
    Math.abs((probe?.afterDrag?.movedY ?? 0) - 40) < 5,
    `movedY=${probe?.afterDrag?.movedY} (expected ~40)`,
  );
  pass(
    "click-empty-clears-selection",
    (probe?.afterClickEmpty?.selectedIds?.length ?? -1) === 0,
    `selectedIds=${JSON.stringify(probe?.afterClickEmpty?.selectedIds)}`,
  );

  // Batch 7: keyboard shortcuts.
  pass(
    "second-rect-drawn",
    probe?.afterSecondDraw?.count === 2,
    `count=${probe?.afterSecondDraw?.count}`,
  );
  pass(
    "ctrl-a-selects-all",
    probe?.afterSelectAll?.selectedCount === 2,
    `selectedCount=${probe?.afterSelectAll?.selectedCount}`,
  );
  pass(
    "arrow-right-nudges-by-1",
    probe?.afterNudge1?.dx === 1,
    `dx=${probe?.afterNudge1?.dx}`,
  );
  pass(
    "shift-arrow-right-nudges-by-5",
    probe?.afterShiftNudge?.dx === 5,
    `dx=${probe?.afterShiftNudge?.dx}`,
  );
  pass(
    "ctrl-d-duplicates",
    probe?.afterDuplicate?.count === 4 && probe?.afterDuplicate?.selectedCount === 2,
    `count=${probe?.afterDuplicate?.count} sel=${probe?.afterDuplicate?.selectedCount}`,
  );
  pass(
    "delete-removes-selection",
    probe?.afterDelete?.count === 2 && probe?.afterDelete?.selectedCount === 0,
    `count=${probe?.afterDelete?.count} sel=${probe?.afterDelete?.selectedCount}`,
  );

  // Batch 8: undo / redo.
  pass(
    "ctrl-z-undoes-delete",
    probe?.afterUndoDelete?.count === 4,
    `count=${probe?.afterUndoDelete?.count} (expected 4)`,
  );
  pass(
    "ctrl-shift-z-redoes",
    probe?.afterRedoDelete?.count === 2,
    `count=${probe?.afterRedoDelete?.count} (expected 2)`,
  );
  pass(
    "ctrl-y-redoes",
    probe?.afterCtrlY?.count === 2,
    `count=${probe?.afterCtrlY?.count} (expected 2 after undo+redo)`,
  );

  // Batch 10: zoom + pan.
  pass(
    "ctrl-wheel-zooms-in",
    (probe?.afterZoomIn?.zoom ?? 0) > (probe?.zoomBefore ?? 0) + 0.01,
    `${probe?.zoomBefore} → ${probe?.afterZoomIn?.zoom}`,
  );
  pass(
    "ctrl-0-resets-zoom",
    Math.abs((probe?.afterZoomReset?.zoom ?? 0) - 1) < 0.001,
    `zoom=${probe?.afterZoomReset?.zoom}`,
  );
  pass(
    "wheel-pans-scroll",
    Math.abs(probe?.afterPan?.dx ?? 0) > 1 || Math.abs(probe?.afterPan?.dy ?? 0) > 1,
    `dx=${probe?.afterPan?.dx} dy=${probe?.afterPan?.dy}`,
  );
  pass(
    "ctrl-equals-zooms-in",
    (probe?.afterKeyZoomIn?.zoom ?? 0) > 1,
    `zoom=${probe?.afterKeyZoomIn?.zoom}`,
  );
  pass(
    "middle-mouse-pans",
    Math.abs(probe?.afterMiddlePan?.dx ?? 0) > 10,
    `dx=${probe?.afterMiddlePan?.dx}`,
  );

  // Batch 5: all 6 shape types.
  const shapeTypes = probe?.afterShapes?.types ?? [];
  const expected = ["rectangle", "diamond", "ellipse", "arrow", "line", "freedraw"];
  pass(
    "all-shape-tools-create-elements",
    probe?.afterShapes?.count === 6,
    `count=${probe?.afterShapes?.count} types=${JSON.stringify(shapeTypes)}`,
  );
  for (const t of expected) {
    pass(
      `shape-${t}-exists`,
      shapeTypes.includes(t),
      `types=${JSON.stringify(shapeTypes)}`,
    );
  }
  pass(
    "freedraw-has-many-points",
    (probe?.afterShapes?.freedrawPointCount ?? 0) >= 5,
    `points=${probe?.afterShapes?.freedrawPointCount}`,
  );

  // Batch 13: persistence + clear canvas.
  pass(
    "localStorage-save-exists",
    probe?.afterSaveCheck?.hasKey === true,
    `hasKey=${probe?.afterSaveCheck?.hasKey}`,
  );
  pass(
    "localStorage-save-has-elements",
    (probe?.afterSaveCheck?.elementCount ?? 0) === 6,
    `elementCount=${probe?.afterSaveCheck?.elementCount} (expected 6)`,
  );
  pass(
    "localStorage-save-has-viewport",
    probe?.afterSaveCheck?.hasViewport === true,
    `hasViewport=${probe?.afterSaveCheck?.hasViewport}`,
  );
  pass(
    "ctrl-shift-delete-clears",
    probe?.afterClearCanvas?.count === 0,
    `count=${probe?.afterClearCanvas?.count}`,
  );
  pass(
    "clear-is-undoable",
    probe?.afterUndoClear?.count === 6,
    `count=${probe?.afterUndoClear?.count} (expected 6)`,
  );

  // Batch 14: resize handles.
  pass(
    "se-handle-resizes-width",
    Math.abs((probe?.afterResizeSE?.dw ?? 0) - 60) < 5,
    `dw=${probe?.afterResizeSE?.dw} (expected ~60)`,
  );
  pass(
    "se-handle-resizes-height",
    Math.abs((probe?.afterResizeSE?.dh ?? 0) - 40) < 5,
    `dh=${probe?.afterResizeSE?.dh} (expected ~40)`,
  );
  pass(
    "se-handle-keeps-origin",
    Math.abs(probe?.afterResizeSE?.dx ?? 99) < 2 && Math.abs(probe?.afterResizeSE?.dy ?? 99) < 2,
    `dx=${probe?.afterResizeSE?.dx} dy=${probe?.afterResizeSE?.dy} (both ~0)`,
  );
  pass(
    "nw-handle-moves-origin",
    Math.abs((probe?.afterResizeNW?.dx ?? 0) + 20) < 5 &&
      Math.abs((probe?.afterResizeNW?.dy ?? 0) + 10) < 5,
    `dx=${probe?.afterResizeNW?.dx} (~-20) dy=${probe?.afterResizeNW?.dy} (~-10)`,
  );
  pass(
    "nw-handle-grows-size",
    (probe?.afterResizeNW?.dw ?? 0) > 15 && (probe?.afterResizeNW?.dh ?? 0) > 5,
    `dw=${probe?.afterResizeNW?.dw} dh=${probe?.afterResizeNW?.dh}`,
  );
  pass(
    "resize-is-undoable",
    (probe?.afterUndoResize?.w ?? 0) > 150 && (probe?.afterUndoResize?.w ?? 0) < 280,
    `w=${probe?.afterUndoResize?.w} h=${probe?.afterUndoResize?.h} (post-SE pre-NW bounds)`,
  );

  // Batch 15: rotation handle.
  pass(
    "rotation-handle-rotates-element",
    // Drag from handle (above center) to east of center = +90° (±5°).
    Math.abs((probe?.afterRotation?.deltaDeg ?? 0) - 90) < 5,
    `deltaDeg=${probe?.afterRotation?.deltaDeg} (expected ~90)`,
  );
  pass(
    "rotation-is-undoable",
    Math.abs(probe?.afterUndoRotation?.angle ?? 99) < 0.001,
    `angle=${probe?.afterUndoRotation?.angle} (expected ~0)`,
  );

  // Batch 11: shift-click + marquee.
  pass(
    "shift-click-selects-one",
    probe?.afterShiftClick1?.selectedCount === 1,
    `count=${probe?.afterShiftClick1?.selectedCount}`,
  );
  pass(
    "shift-click-additive",
    probe?.afterShiftClick2?.selectedCount === 2,
    `count=${probe?.afterShiftClick2?.selectedCount}`,
  );
  pass(
    "shift-click-toggles-off",
    probe?.afterShiftClickToggleOff?.selectedCount === 1,
    `count=${probe?.afterShiftClickToggleOff?.selectedCount}`,
  );
  pass(
    "marquee-selects-intersecting",
    probe?.afterMarquee?.selectedCount === 3,
    `count=${probe?.afterMarquee?.selectedCount} types=${JSON.stringify(probe?.afterMarquee?.selectedTypes)}`,
  );
  pass(
    "shift-marquee-is-additive",
    (probe?.afterShiftMarquee?.selectedCount ?? 0) > probe?.afterMarquee?.selectedCount,
    `before=${probe?.afterMarquee?.selectedCount} after=${probe?.afterShiftMarquee?.selectedCount}`,
  );

  // Batch 9: text tool.
  pass(
    "text-tool-opens-editor",
    probe?.afterTextOpen?.hasTextarea === true,
    `hasTextarea=${probe?.afterTextOpen?.hasTextarea}`,
  );
  pass(
    "text-commit-removes-editor",
    probe?.afterTextCommit?.textareaGone === true,
    `textareaGone=${probe?.afterTextCommit?.textareaGone}`,
  );
  pass(
    "text-commit-creates-element",
    probe?.afterTextCommit?.count >= 1,
    `count=${probe?.afterTextCommit?.count} text=${probe?.afterTextCommit?.firstText}`,
  );
  pass(
    "text-commit-stores-string",
    probe?.afterTextCommit?.firstText === "hello world",
    `firstText=${JSON.stringify(probe?.afterTextCommit?.firstText)}`,
  );
  pass(
    "text-vietnamese-roundtrip",
    probe?.afterVnText?.found === true,
    `text=${JSON.stringify(probe?.afterVnText?.text)}`,
  );
  pass(
    "excalifont-covers-vietnamese",
    probe?.fontCanRenderVn?.excalifont === true,
    `excalifont=${probe?.fontCanRenderVn?.excalifont} ` +
      `(Patrick Hand aliased under Excalifont for VN unicode-range; ` +
      `document.fonts.check returns true iff merged cascade covers codepoints)`,
  );
  // NOTE: `patrick-hand-loaded` (standalone family check) would require
  // eager load via document.fonts.load('20px "Patrick Hand"', 'ả') first —
  // CSS @font-face with unicode-range is lazy. Skipped as not meaningful:
  // the important signal is the Excalifont-aliased path above, which is
  // what actually renders in the editor.

  // Batch 12: export.
  pass(
    "export-png-returns-blob",
    probe?.exportPng?.isBlob === true && (probe?.exportPng?.size ?? 0) > 500,
    `size=${probe?.exportPng?.size} type=${probe?.exportPng?.type} err=${probe?.exportPng?.err ?? ""}`,
  );
  pass(
    "export-png-has-image-mime",
    probe?.exportPng?.type === "image/png",
    `type=${probe?.exportPng?.type}`,
  );
  pass(
    "export-svg-returns-svg-el",
    (probe?.exportSvg?.tag ?? "").toLowerCase() === "svg",
    `tag=${probe?.exportSvg?.tag} err=${probe?.exportSvg?.err ?? ""}`,
  );
  pass(
    "export-svg-has-children",
    (probe?.exportSvg?.childCount ?? 0) >= 6,
    `childCount=${probe?.exportSvg?.childCount} (expected ≥6 for 6-shape scene)`,
  );
  pass(
    "export-svg-has-viewbox",
    probe?.exportSvg?.hasViewBox === true,
    `hasViewBox=${probe?.exportSvg?.hasViewBox}`,
  );

  pass(
    "reload-restores-scene",
    // 6 shapes from batch 5 + 2 text (English + Vietnamese) from batch 9.
    afterReload?.count === 8,
    `count=${afterReload?.count} types=${JSON.stringify(afterReload?.types)}`,
  );

  console.log("\n=== Assertions ===");
  for (const a of assertions) {
    console.log(`  [${a.ok ? "PASS" : "FAIL"}] ${a.name}${a.detail ? ` (${a.detail})` : ""}`);
  }
  const assertionsFailed = assertions.filter((a) => !a.ok).length;

  const failed = errors.length > 0 || exceptions.length > 0 || assertionsFailed > 0;
  if (failed) {
    console.log(`\nSMOKE FAILED (${errors.length} errors, ${exceptions.length} exceptions, ${assertionsFailed} assertion failures)`);
    process.exit(1);
  }
  console.log("\nSMOKE PASSED");
  process.exit(0);
}

main().catch((err) => {
  cleanup();
  console.error("smoke runner threw:", err);
  process.exit(2);
});

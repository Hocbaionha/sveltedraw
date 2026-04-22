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

      return {
        ...afterDraw,
        afterSelect, afterDrag, afterClickEmpty,
        afterSecondDraw, afterSelectAll, afterNudge1, afterShiftNudge,
        afterDuplicate, afterDelete,
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

  ws.close();
  cleanup();

  console.log("=== DOM snapshot ===");
  console.log(JSON.stringify(domInfo.result?.value ?? domInfo, null, 2));

  const errors = consoleMsgs.filter(
    (m) => m.level === "error" || m.level === "severe",
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

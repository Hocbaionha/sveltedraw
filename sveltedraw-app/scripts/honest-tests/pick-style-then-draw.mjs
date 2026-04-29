// Regression test — end-to-end user flow:
//   1. Start with no selection.
//   2. Open style panel, pick pink fill + blue stroke + thick stroke.
//   3. Switch to rectangle tool.
//   4. Drag on canvas to draw a new rectangle.
//   5. New rectangle MUST inherit pink fill + blue stroke, not black.
//
// This was the bug the user hit: the rectangle factory in the pointerdown
// handler (App.svelte ~line 4438) built `baseOpts` from hardcoded
// `DEFAULT_ELEMENT_PROPS.*` instead of `appState.currentItem*`, so even
// though `applyStyle` had correctly updated `currentItem*`, new shapes
// ignored it and came out with the default black/transparent style.
//
// This test simulates the full flow via probe + real pointer events on the
// interactive canvas, then inspects the newly-created element's colors.
//
// Run standalone:
//   APP_URL=http://localhost:3001/#app node sveltedraw-app/scripts/honest-tests/pick-style-then-draw.mjs

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const CHROME =
  process.env.CHROME ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3001/#app";
const CDP_PORT = Number(process.env.CDP_PORT ?? 9344);
const SETUP_WAIT_MS = Number(process.env.SETUP_WAIT_MS ?? 3000);

const tmp = mkdtempSync(join(tmpdir(), "chrome-pick-draw-"));

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
  try { chrome.kill("SIGKILL"); } catch {}
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
};
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });

async function waitForDevtools(port, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("devtools never came up");
}
async function findPage(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  const tabs = await res.json();
  const page = tabs.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
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

const PAYLOAD = `(async () => {
 try {
  const deadline = Date.now() + ${SETUP_WAIT_MS};
  while (!window.__sveltedrawProbe && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 100));
  }
  const p = window.__sveltedrawProbe;
  if (!p) return { fatal: 'probe never exposed' };
  const scene = p.scene;
  const appState = p.appState;
  if (!scene || !appState) return { fatal: 'scene/appState missing' };
  if (!p.applyStyle) return { fatal: 'applyStyle missing on probe', keys: Object.keys(p) };
  if (!p.setActiveTool) return { fatal: 'setActiveTool missing on probe', keys: Object.keys(p) };

  // Ensure a clean empty scene + no selection.
  scene.replaceAllElements([]);
  appState.selectedElementIds = {};
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 150));

  // Step 1 — pick pink fill + blue stroke + thick stroke. Exact same
  // applyStyle calls the ColorPicker and StrokeWidth buttons make.
  p.applyStyle({ backgroundColor: '#ff00cc' });   // pink fill
  p.applyStyle({ strokeColor: '#0000ff' });        // blue stroke
  p.applyStyle({ strokeWidth: 4 });                // thick
  p.applyStyle({ fillStyle: 'solid' });            // solid fill (otherwise hachure bg is thin)
  await new Promise(r => setTimeout(r, 100));

  const defaultsAfterPick = {
    bg: appState.currentItemBackgroundColor,
    stroke: appState.currentItemStrokeColor,
    strokeWidth: appState.currentItemStrokeWidth,
    fillStyle: appState.currentItemFillStyle,
  };

  // Step 2 — switch to rectangle tool.
  p.setActiveTool('rectangle');
  await new Promise(r => setTimeout(r, 50));

  const toolAfterSwitch = appState.activeTool?.type;

  // Step 3 — simulate pointerdown → pointermove → pointerup on the
  // INTERACTIVE canvas (that's the one the app's handlers attach to).
  // The rectangle factory reads appState.currentItem* at pointerdown time
  // (App.svelte ~line 4438), so this is the exact path the bug lives on.
  const canvas = document.querySelector('.sveltedraw__canvas.interactive')
               || document.querySelector('.sveltedraw__canvas.static');
  if (!canvas) return { fatal: 'canvas missing' };
  const rect = canvas.getBoundingClientRect();
  const startX = rect.left + 300;
  const startY = rect.top + 200;
  const endX = rect.left + 500;
  const endY = rect.top + 360;

  const fire = (type, x, y) => {
    const ev = new PointerEvent(type, {
      bubbles: true, cancelable: true, view: window,
      pointerId: 1, pointerType: 'mouse',
      clientX: x, clientY: y,
      button: 0, buttons: type === 'pointerup' ? 0 : 1,
      isPrimary: true,
    });
    canvas.dispatchEvent(ev);
  };

  fire('pointerdown', startX, startY);
  await new Promise(r => setTimeout(r, 20));
  fire('pointermove', startX + 100, startY + 80);
  await new Promise(r => setTimeout(r, 20));
  fire('pointermove', endX, endY);
  await new Promise(r => setTimeout(r, 20));
  fire('pointerup', endX, endY);
  await new Promise(r => setTimeout(r, 200));

  // Step 4 — inspect the created rectangle.
  const els = scene.getNonDeletedElements();
  const newRect = els.find(e => e.type === 'rectangle');

  return {
    fatal: null,
    defaultsAfterPick,
    toolAfterSwitch,
    elementCount: els.length,
    newRect: newRect ? {
      type: newRect.type,
      bg: newRect.backgroundColor,
      stroke: newRect.strokeColor,
      strokeWidth: newRect.strokeWidth,
      fillStyle: newRect.fillStyle,
      w: newRect.width,
      h: newRect.height,
    } : null,
    checks: {
      // Sanity: applyStyle did update currentItem* (0.7 fix).
      currentItemBgUpdated: defaultsAfterPick.bg === '#ff00cc',
      currentItemStrokeUpdated: defaultsAfterPick.stroke === '#0000ff',
      currentItemStrokeWidthUpdated: defaultsAfterPick.strokeWidth === 4,
      // Sanity: setActiveTool worked.
      toolSwitched: toolAfterSwitch === 'rectangle',
      // Sanity: drag actually created a rectangle.
      rectCreated: !!newRect,
      // THE BUG: new rect must inherit the picked pink bg (was: black/transparent).
      rectInheritsBg: newRect?.backgroundColor === '#ff00cc',
      // THE BUG: new rect must inherit the picked blue stroke (was: #1e1e1e).
      rectInheritsStroke: newRect?.strokeColor === '#0000ff',
      // New rect inherits thick stroke.
      rectInheritsStrokeWidth: newRect?.strokeWidth === 4,
      // New rect inherits solid fill style.
      rectInheritsFillStyle: newRect?.fillStyle === 'solid',
    },
  };
 } catch (err) {
   return { fatal: 'payload threw: ' + (err && err.message) + ' :: ' + (err && err.stack) };
 }
})()`;

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
  await send("Page.enable");

  await send("Runtime.evaluate", {
    expression: `(async () => {
      try { localStorage.removeItem('sveltedraw:scene:v1'); } catch {}
      try {
        await new Promise((resolve) => {
          const req = indexedDB.deleteDatabase('sveltedraw');
          req.onsuccess = req.onerror = req.onblocked = () => resolve();
        });
      } catch {}
    })()`,
    awaitPromise: true,
  });
  await send("Page.reload", { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 1000));

  const result = await send("Runtime.evaluate", {
    expression: PAYLOAD,
    awaitPromise: true,
    returnByValue: true,
  });

  const report = result.result?.value;
  if (!report) {
    console.error("payload returned no value:", JSON.stringify(result));
    process.exit(2);
  }
  if (report.fatal) {
    console.error(`FATAL: ${report.fatal}`);
    if (report.keys) console.error("keys:", report.keys);
    process.exit(2);
  }
  if (!report.checks) {
    console.error("report missing .checks:", JSON.stringify(report));
    process.exit(2);
  }

  console.log("defaultsAfterPick:", JSON.stringify(report.defaultsAfterPick));
  console.log("toolAfterSwitch:", report.toolAfterSwitch);
  console.log("elementCount:", report.elementCount);
  console.log("newRect:", JSON.stringify(report.newRect, null, 2));
  console.log("");

  let failed = 0;
  for (const [name, passed] of Object.entries(report.checks)) {
    const tag = passed ? "[PASS]" : "[FAIL]";
    console.log(`${tag} ${name}`);
    if (!passed) failed++;
  }

  console.log("");
  const total = Object.keys(report.checks).length;
  if (failed > 0) {
    console.error(`PICK-STYLE-THEN-DRAW TEST FAILED (${failed}/${total} checks failed)`);
    process.exit(1);
  }
  console.log(`PICK-STYLE-THEN-DRAW TEST PASSED (${total}/${total} checks)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("runner error:", err);
  process.exit(2);
});

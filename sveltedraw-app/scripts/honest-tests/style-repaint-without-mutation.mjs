// Regression test — Track 0.4 of PHASE-17-PLAN.md.
//
// Guards against the class of bug fixed in commit 71b2b405: in-place element
// mutation (`Scene.mutateElement({...}, {informMutation:false})` +
// `bumpSceneRepaint()`) not reflecting on the static canvas. Two cache layers
// previously served stale data — `Renderer.getRenderableElements` memoized on
// `sceneNonce`, and `ShapeCache` keyed on element identity.
//
// The crucial test shape is "create → style → screenshot, NO intervening
// mutation". Prior honest-tests all did `create → style → export / resize /
// pointer-click-elsewhere` → the intervening step bumped the nonce through a
// different path and masked both bugs.
//
// Each assertion here:
//   1. Creates / re-colors a single rectangle via the probe's scene API, using
//      the EXACT code path that real StylePanel clicks take (`onChange={(c) =>
//      applyStyle({ backgroundColor: c })}` in App.svelte:5453 →
//      `applyStyle` → `scene.mutateElement(el, patch, {informMutation:false,
//      isDragging:false})` + `pushHistory()` + `bumpSceneRepaint()`).
//   2. Samples a pixel on the static canvas.
//   3. Runs NO other DOM event, no export, no resize, no scroll — nothing that
//      could incidentally bust the `sceneNonce` or `ShapeCache`.
//
// If sceneNonce or ShapeCache regress to stale behavior, the pixel sample will
// not match the just-set color and the test fails loudly.
//
// Run standalone:
//   APP_URL=http://localhost:3001/#app node scripts/honest-tests/style-repaint-without-mutation.mjs
// Expects a live dev server. 0 on PASS, non-zero on FAIL.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const CHROME =
  process.env.CHROME ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3001/#app";
const CDP_PORT = Number(process.env.CDP_PORT ?? 9341);
const SETUP_WAIT_MS = Number(process.env.SETUP_WAIT_MS ?? 2500);

const tmp = mkdtempSync(join(tmpdir(), "chrome-repaint-test-"));

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
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
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

// The core assertion payload runs in the page. Returns a JSON-serializable
// report with per-step pixels + final PASS booleans. Designed to touch the
// scene as few times as possible between each "mutate → sample" pair so a
// regression CANNOT be masked by an intervening nonce bump.
const PAYLOAD = `(async () => {
 try {
  // Wait for App mount + probe exposure.
  const deadline = Date.now() + ${SETUP_WAIT_MS};
  while (!window.__sveltedrawProbe && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 100));
  }
  const p = window.__sveltedrawProbe;
  if (!p) return { fatal: 'probe never exposed', probeKeys: Object.keys(window).filter(k => k.toLowerCase().includes('svelt')) };
  const scene = p.scene;
  if (!scene) return { fatal: 'scene missing on probe', probeKeys: Object.keys(p) };

  const canvas = document.querySelector('.excalidraw__canvas.static');
  if (!canvas) return { fatal: 'static canvas missing' };
  const ctx = canvas.getContext('2d');

  // A rectangle that will stay well inside any non-degenerate viewport.
  // Using roughness=0 keeps rough.js output deterministic so pixel sampling
  // at the center yields a solid fill without stochastic edges intruding.
  const RECT = {
    id: 'repaint-test-rect',
    type: 'rectangle',
    x: 40, y: 40, width: 120, height: 100, angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: '#ff0000',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roundness: null,
    roughness: 0,
    opacity: 100,
    groupIds: [], frameId: null, index: 'a0',
    boundElements: null,
    updated: Date.now(),
    link: null, locked: false,
    seed: 12345,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
  };

  // Sample the mid-interior of the rect. Pick a point well clear of the
  // stroke (strokeWidth=1, so even antialias doesn't reach the center).
  const samplePoint = {
    // static canvas coords (no DPR scale for now — we only care about
    // relative changes at a fixed point, not absolute calibration).
    x: Math.round(RECT.x + RECT.width / 2),
    y: Math.round(RECT.y + RECT.height / 2),
  };

  const samplePx = () => {
    const d = ctx.getImageData(samplePoint.x, samplePoint.y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  };

  const isColorNear = (px, ref, tol = 40) => {
    const [r, g, b] = Array.isArray(ref) ? ref : [ref.r, ref.g, ref.b];
    return Math.abs(px.r - r) <= tol && Math.abs(px.g - g) <= tol && Math.abs(px.b - b) <= tol;
  };

  // Step 0 — seed the scene.
  scene.replaceAllElements([RECT]);
  p.bumpSceneRepaint();
  // One frame delay — not a mutation, just waiting for the $effect to run.
  await new Promise(r => setTimeout(r, 300));

  const pxRed = samplePx();
  const el = scene.getNonDeletedElements()[0];

  // Step 1 — bg red → green. EXACT applyStyle code path.
  scene.mutateElement(el, { backgroundColor: '#00cc00' }, {
    informMutation: false, isDragging: false,
  });
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 300));
  const pxGreen = samplePx();

  // Step 2 — bg green → blue. NO intervening scroll/resize/export.
  scene.mutateElement(el, { backgroundColor: '#0000cc' }, {
    informMutation: false, isDragging: false,
  });
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 300));
  const pxBlue = samplePx();

  // Step 3 — fillStyle change (hachure → solid was baseline; flip to
  // 'hachure' which changes the rendered pattern at the same center). This
  // exercises a different ShapeCache-invalidating key path.
  scene.mutateElement(el, { fillStyle: 'hachure' }, {
    informMutation: false, isDragging: false,
  });
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 300));
  const pxHachure = samplePx();

  // Step 4 — flip back to solid, confirming mutation is reversible & cache
  // doesn't hold onto the hachure drawable.
  scene.mutateElement(el, { fillStyle: 'solid', backgroundColor: '#ffaa00' }, {
    informMutation: false, isDragging: false,
  });
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 300));
  const pxOrange = samplePx();

  // Step 5 — strokeWidth bump. Stroke lives on the border, not at center,
  // so center pixel should retain bg. The point is to verify a
  // strokeWidth-only mutation doesn't corrupt center color via cache glitch.
  scene.mutateElement(el, { strokeWidth: 4 }, {
    informMutation: false, isDragging: false,
  });
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 300));
  const pxAfterStrokeWidth = samplePx();

  // Read back static tick counter to confirm $effect re-fires per bump.
  const staticTicks = window.__sveltedrawStaticTicks ?? null;

  return {
    fatal: null,
    samplePoint,
    canvasSize: { w: canvas.width, h: canvas.height },
    ticks: staticTicks,
    pixels: { pxRed, pxGreen, pxBlue, pxHachure, pxOrange, pxAfterStrokeWidth },
    checks: {
      baselineIsRed: isColorNear(pxRed, [255, 0, 0]),
      mutatedToGreen: isColorNear(pxGreen, [0, 204, 0]),
      mutatedToBlue: isColorNear(pxBlue, [0, 0, 204]),
      hachureDiffersFromSolid: !isColorNear(pxHachure, pxBlue, 5),
      flippedBackToOrange: isColorNear(pxOrange, [255, 170, 0]),
      strokeWidthDoesntCorruptCenter: isColorNear(pxAfterStrokeWidth, pxOrange, 20),
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

  // Clear persisted state so the scene starts empty.
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
  // Small delay for mount before payload starts its own poll.
  await new Promise((r) => setTimeout(r, 600));

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
    if (report.probeKeys) console.error("probe keys:", report.probeKeys);
    process.exit(2);
  }

  if (!report.checks) {
    console.error("report missing .checks:", JSON.stringify(report));
    process.exit(2);
  }

  console.log("sample point:", report.samplePoint);
  console.log("canvas size:", report.canvasSize);
  console.log("static-render ticks after all mutations:", report.ticks);
  console.log("pixels:", JSON.stringify(report.pixels));
  console.log("");

  let failed = 0;
  for (const [name, passed] of Object.entries(report.checks)) {
    const tag = passed ? "[PASS]" : "[FAIL]";
    console.log(`${tag} ${name}`);
    if (!passed) failed++;
  }

  console.log("");
  if (failed > 0) {
    console.error(`REPAINT TEST FAILED (${failed}/${Object.keys(report.checks).length} checks failed)`);
    process.exit(1);
  }
  console.log(`REPAINT TEST PASSED (${Object.keys(report.checks).length}/${Object.keys(report.checks).length} checks)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("runner error:", err);
  process.exit(2);
});

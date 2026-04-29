// Regression test — text-element repaint without intervening mutation.
//
// Sibling of style-repaint-without-mutation.mjs. That test exercises the
// ShapeCache invalidation path in mutateElement.ts (SHAPE_AFFECTING_KEYS).
// This one exercises a DIFFERENT WeakMap: `elementWithCanvasCache` in
// packages/element/src/renderElement.ts, which stores the pre-rendered
// bitmap for text / freedraw / arrow-with-label. Before the elementVersion
// guard, in-place Scene.mutateElement bumped element.version but kept the
// same identity, so the WeakMap returned a stale bitmap and text never
// repainted after fontSize / fontFamily / strokeColor (= text color) changes.
//
// Run standalone:
//   APP_URL=http://localhost:3001/#app node sveltedraw-app/scripts/honest-tests/text-repaint-without-mutation.mjs

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const CHROME =
  process.env.CHROME ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3001/#app";
const CDP_PORT = Number(process.env.CDP_PORT ?? 9342);
const SETUP_WAIT_MS = Number(process.env.SETUP_WAIT_MS ?? 2500);

const tmp = mkdtempSync(join(tmpdir(), "chrome-text-repaint-"));

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

// Strategy: paint a text element on a WHITE canvas area. Measure the ratio
// of non-white pixels in a bounding box around the glyph. That ratio is a
// proxy for "how much ink the text is laying down". It changes discretely
// with fontSize (bigger glyph = more ink) and with strokeColor (non-white
// ink vs white ink). If the cache is stale the ratio stays flat across
// mutations; if the fix works the ratio changes between samples.
const PAYLOAD = `(async () => {
 try {
  const deadline = Date.now() + ${SETUP_WAIT_MS};
  while (!window.__sveltedrawProbe && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 100));
  }
  const p = window.__sveltedrawProbe;
  if (!p) return { fatal: 'probe never exposed' };
  const scene = p.scene;
  if (!scene) return { fatal: 'scene missing on probe' };

  const canvas = document.querySelector('.sveltedraw__canvas.static');
  if (!canvas) return { fatal: 'static canvas missing' };
  const ctx = canvas.getContext('2d');

  // Text element. Position it well inside viewport. Width/height are
  // rough guesses; text rendering ignores them for most purposes.
  const TEXT = {
    id: 'text-repaint-test',
    type: 'text',
    x: 60, y: 60, width: 200, height: 40, angle: 0,
    strokeColor: '#000000',
    backgroundColor: 'transparent',
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
    text: 'HELLO',
    originalText: 'HELLO',
    fontSize: 20,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    lineHeight: 1.25,
    autoResize: true,
  };

  // Count non-white pixels in a region covering where the text sits on the
  // static canvas. Returns { nonWhite, nonBlack, total }.
  const DPR = window.devicePixelRatio || 1;
  const countInk = (color) => {
    // Use the underlying bitmap (DPR-scaled) so we sample what was actually
    // painted, not the CSS-size view.
    const x0 = Math.round(TEXT.x * DPR);
    const y0 = Math.round(TEXT.y * DPR);
    const w = Math.round(140 * DPR);
    const h = Math.round(60 * DPR);
    const img = ctx.getImageData(x0, y0, w, h).data;
    let nonWhite = 0;
    let nonBlack = 0;
    let pureRed = 0;
    for (let i = 0; i < img.length; i += 4) {
      const r = img[i], g = img[i + 1], b = img[i + 2], a = img[i + 3];
      if (a === 0) continue; // transparent, ignore
      // "ink" = any non-near-white pixel
      const isWhite = r > 240 && g > 240 && b > 240;
      if (!isWhite) nonWhite++;
      const isBlack = r < 32 && g < 32 && b < 32;
      if (!isBlack && !isWhite) nonBlack++;
      const isRed = r > 200 && g < 80 && b < 80;
      if (isRed) pureRed++;
    }
    return { nonWhite, nonBlack, pureRed, total: img.length / 4, color };
  };

  // Seed + initial paint.
  scene.replaceAllElements([TEXT]);
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 400));

  const beforeAny = countInk('baseline-black');
  const el = scene.getNonDeletedElements()[0];

  // Step 1 — bump fontSize. Bigger glyph ⇒ more ink.
  scene.mutateElement(el, { fontSize: 48 }, {
    informMutation: false, isDragging: false,
  });
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 400));
  const afterBigFont = countInk('48pt-black');

  // Step 2 — change color to red. Same ink count expected, but color shifts.
  scene.mutateElement(el, { strokeColor: '#ff0000' }, {
    informMutation: false, isDragging: false,
  });
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 400));
  const afterRed = countInk('48pt-red');

  // Step 3 — shrink back down, still red.
  scene.mutateElement(el, { fontSize: 20 }, {
    informMutation: false, isDragging: false,
  });
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 400));
  const afterSmallRed = countInk('20pt-red');

  return {
    fatal: null,
    ticks: window.__sveltedrawStaticTicks ?? null,
    samples: { beforeAny, afterBigFont, afterRed, afterSmallRed },
    checks: {
      // Initial paint must produce some non-white ink (text rendered).
      baselineHasInk: beforeAny.nonWhite > 20,
      // Bumping fontSize from 20→48 must produce MORE ink. If cache is
      // stale, ink stays at baseline level → fails.
      fontSizeIncreaseRepaints: afterBigFont.nonWhite > beforeAny.nonWhite * 1.5,
      // Changing strokeColor to red must produce red pixels where there
      // were none before. If cache is stale, zero red pixels → fails.
      colorChangeRepaints: afterRed.pureRed > 10,
      // Shrinking back should drop ink below the 48pt sample.
      fontSizeDecreaseRepaints: afterSmallRed.nonWhite < afterBigFont.nonWhite * 0.8,
      // After shrink, red pixels should still be present (still red).
      stillRed: afterSmallRed.pureRed > 3,
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
  await new Promise((r) => setTimeout(r, 800));

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
    process.exit(2);
  }
  if (!report.checks) {
    console.error("report missing .checks:", JSON.stringify(report));
    process.exit(2);
  }

  console.log("static-render ticks:", report.ticks);
  console.log("samples:", JSON.stringify(report.samples, null, 2));
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
    console.error(`TEXT REPAINT TEST FAILED (${failed}/${total} checks failed)`);
    process.exit(1);
  }
  console.log(`TEXT REPAINT TEST PASSED (${total}/${total} checks)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("runner error:", err);
  process.exit(2);
});

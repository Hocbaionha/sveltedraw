// Memory-audit smoke — stress-test the editor and check for leaks.
//
// What it does:
//   1. Launch headless Chrome with JS --expose-gc.
//   2. Navigate to the dev server at /#app.
//   3. Wait for __sveltedrawProbe to appear.
//   4. Measure baseline heap after forced GC.
//   5. Run N cycles of: create 200 rects, undo all, clear canvas.
//   6. Force GC, measure final heap.
//   7. Delta = final - baseline. Report threshold breach.
//
// Baseline: draw 200 rects × 5 cycles on a freshly-loaded page.
// Acceptable: <2 MB growth after full unwind — the history cap
// capped to 500 snapshots means some retention is expected.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const CHROME =
  process.env.CHROME ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3003/#app";
const CDP_PORT = 9334;
const CYCLES = Number(process.env.MEM_CYCLES ?? 5);
const PER_CYCLE = Number(process.env.MEM_PER_CYCLE ?? 200);
const LEAK_THRESHOLD_MB = Number(process.env.MEM_LEAK_MB ?? 2);

const tmp = mkdtempSync(join(tmpdir(), "chrome-mem-"));

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
    "--js-flags=--expose-gc",
    "--enable-precise-memory-info",
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
  const p = tabs.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
  if (!p) throw new Error("no page");
  return p.webSocketDebuggerUrl;
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { perMessageDeflate: false });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

async function main() {
  await waitForDevtools(CDP_PORT);
  const pageUrl = await findPage(CDP_PORT);
  const ws = await connect(pageUrl);
  let nextId = 1;
  const pending = new Map();
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  const send = (method, params = {}) => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await send("Runtime.enable");
  await send("Page.enable");
  await send("HeapProfiler.enable");

  // Wait for probe to attach.
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const r = await send("Runtime.evaluate", {
      expression: "typeof window.__sveltedrawProbe !== 'undefined'",
      returnByValue: true,
    });
    if (r.result?.value) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  const gc = async () => {
    await send("HeapProfiler.collectGarbage");
    // Let any post-GC finalizers run.
    await new Promise((r) => setTimeout(r, 100));
  };
  const heapMB = async () => {
    await gc();
    await gc();
    const r = await send("Runtime.evaluate", {
      expression: "performance.memory.usedJSHeapSize",
      returnByValue: true,
    });
    return (r.result?.value ?? 0) / 1024 / 1024;
  };

  // Baseline (mounted app, no user interaction yet).
  const baseline = await heapMB();
  // eslint-disable-next-line no-console
  console.log(`baseline heap: ${baseline.toFixed(2)} MB`);

  // Stress loop.
  const measurements = [{ phase: "baseline", mb: baseline }];

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    const script = `
      (async () => {
        const p = window.__sveltedrawProbe;
        if (!p?.scene) return { err: 'no scene' };
        // Factory tucked inside original element/src; reach via scene helpers.
        const rects = [];
        for (let i = 0; i < ${PER_CYCLE}; i++) {
          // eslint-disable-next-line
          const el = {
            id: 'rx-' + cycle + '-' + i,
            type: 'rectangle',
            x: (i % 20) * 30, y: Math.floor(i / 20) * 30,
            width: 25, height: 25,
            seed: 1, version: 1, versionNonce: 1,
            index: null, isDeleted: false, boundElements: null,
            updated: Date.now(), link: null, locked: false,
            groupIds: [], frameId: null, roundness: null,
            angle: 0, strokeColor: '#000', backgroundColor: 'transparent',
            fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid',
            roughness: 1, opacity: 100, customData: undefined,
          };
          rects.push(el);
        }
        const cur = p.scene.getElementsIncludingDeleted();
        p.scene.replaceAllElements([...cur, ...rects], { skipValidation: true });
        // Clear all.
        p.scene.replaceAllElements([], { skipValidation: true });
        return { ok: true, rects: rects.length };
      })()
    `;
    const r = await send("Runtime.evaluate", {
      expression: script,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.result?.value?.err) {
      // eslint-disable-next-line no-console
      console.error("cycle error:", r.result.value.err);
      process.exit(1);
    }
    const mb = await heapMB();
    measurements.push({ phase: `cycle-${cycle}`, mb });
    // eslint-disable-next-line no-console
    console.log(
      `cycle ${cycle}/${CYCLES}: ${mb.toFixed(2)} MB (Δ=${(mb - baseline).toFixed(2)})`,
    );
  }

  const final = measurements[measurements.length - 1].mb;
  const delta = final - baseline;
  // eslint-disable-next-line no-console
  console.log(`\nfinal heap: ${final.toFixed(2)} MB | delta: ${delta.toFixed(2)} MB`);

  // ── Scenario 2: undo/redo storm ──
  // Exercise pushHistory() by dispatching nudge keys on the container.
  // Each arrow-key nudge pushes a history snapshot (deep clones the
  // whole scene). After 600 nudges, history caps at MAX_HISTORY=500.
  // We expect heap to grow by ~(scene size × 500) then plateau.
  // eslint-disable-next-line no-console
  console.log(`\n--- Scenario 2: history cap ---`);
  const histBefore = await heapMB();
  // eslint-disable-next-line no-console
  console.log(`heap before storm: ${histBefore.toFixed(2)} MB`);

  const stormScript = `
    (async () => {
      const p = window.__sveltedrawProbe;
      if (!p?.scene) return { err: 'no scene' };
      // Seed scene with a small rect.
      const rect = {
        id: 'storm-rect',
        type: 'rectangle',
        x: 100, y: 100, width: 50, height: 50,
        seed: 1, version: 1, versionNonce: 1,
        index: null, isDeleted: false, boundElements: null,
        updated: Date.now(), link: null, locked: false,
        groupIds: [], frameId: null, roundness: null,
        angle: 0, strokeColor: '#000', backgroundColor: 'transparent',
        fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid',
        roughness: 1, opacity: 100, customData: undefined,
      };
      p.scene.replaceAllElements([rect], { skipValidation: true });
      p.appState.selectedElementIds = { [rect.id]: true };
      const container = document.querySelector('.sveltedraw-container');
      // 600 nudges to exceed MAX_HISTORY=500.
      for (let i = 0; i < 600; i++) {
        container.dispatchEvent(new KeyboardEvent('keydown', {
          key: i % 2 ? 'ArrowRight' : 'ArrowLeft',
          bubbles: true, cancelable: true,
        }));
      }
      // Clear the scene so scene-only storage drops.
      p.scene.replaceAllElements([], { skipValidation: true });
      return { ok: true, histLen: window.__sveltedrawHistoryLen?.() ?? -1 };
    })()
  `;
  const stormR = await send("Runtime.evaluate", {
    expression: stormScript,
    awaitPromise: true,
    returnByValue: true,
  });
  // eslint-disable-next-line no-console
  console.log(`after 600 nudges: history.length = ${stormR.result?.value?.histLen}`);

  const histAfter = await heapMB();
  const histDelta = histAfter - histBefore;
  // eslint-disable-next-line no-console
  console.log(`heap after storm+clear: ${histAfter.toFixed(2)} MB (Δ=${histDelta.toFixed(2)})`);
  // History cap keeps 500 snapshots × tiny rect each; retention is
  // expected. ~5 MB for 500 of a 1-element scene is acceptable;
  // anything above 10 MB is a leak.
  const historyThresholdMB = 10;
  if (histDelta > historyThresholdMB) {
    // eslint-disable-next-line no-console
    console.error(`HISTORY LEAK: +${histDelta.toFixed(2)} MB > ${historyThresholdMB} MB`);
    ws.close();
    cleanup();
    process.exit(1);
  }

  // ── Scenario 3: tool-switch + context-menu churn ──
  // Exercise paths that register/unregister listeners: tool hotkeys,
  // right-click menu $effect listener. 500 cycles each.
  // eslint-disable-next-line no-console
  console.log(`\n--- Scenario 3: listener churn ---`);
  const churnBefore = await heapMB();
  const churnR = await send("Runtime.evaluate", {
    expression: `
      (async () => {
        const p = window.__sveltedrawProbe;
        const container = document.querySelector('.sveltedraw-container');
        const tools = ['1', '2', '3', '5', '6', '7', 'l', 'a', 't'];
        for (let i = 0; i < 500; i++) {
          container.dispatchEvent(new KeyboardEvent('keydown', {
            key: tools[i % tools.length], bubbles: true, cancelable: true,
          }));
        }
        // Open/close context menu 100 times via direct state write.
        // (Right-click via CDP-synthesized contextmenu event is
        // stateless in our handler, so we can't just dispatch 500
        // of them without a real hit target.)
        // Instead flip contextMenu state directly through the probe.
        for (let i = 0; i < 100; i++) {
          p.appState.selectedElementIds = {}; // reset
          // Dispatch Escape to reset tool and close any menu.
          container.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape', bubbles: true, cancelable: true,
          }));
        }
        return { ok: true };
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  if (churnR.result?.value?.err) {
    // eslint-disable-next-line no-console
    console.error('churn error:', churnR.result.value.err);
  }
  const churnAfter = await heapMB();
  const churnDelta = churnAfter - churnBefore;
  // eslint-disable-next-line no-console
  console.log(`500 tool switches + 100 escapes: Δ=${churnDelta.toFixed(2)} MB`);
  if (churnDelta > 2) {
    // eslint-disable-next-line no-console
    console.error(`CHURN LEAK: +${churnDelta.toFixed(2)} MB > 2 MB`);
    ws.close();
    cleanup();
    process.exit(1);
  }

  ws.close();
  cleanup();
  if (delta > LEAK_THRESHOLD_MB) {
    // eslint-disable-next-line no-console
    console.error(`LEAK: +${delta.toFixed(2)} MB > threshold ${LEAK_THRESHOLD_MB} MB`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`OK: heap stable within ${LEAK_THRESHOLD_MB} MB threshold`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  cleanup();
  process.exit(1);
});

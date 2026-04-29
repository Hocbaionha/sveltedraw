// Targeted test for the exact user flow: draw a line A→B with the
// line tool, then click on its middle to select + show handles.
//
// Probes the specific failure mode the user reported:
//   "Click đâu cũng không lên handles. Đầu và cuối vẫn drag được."
//
// What this script does:
//   1. Wipe localStorage (fresh canvas).
//   2. Press "l" to pick line tool.
//   3. Drag from (200,200) to (500,300). Release.
//   4. Inspect: is the line in scene? Is it selected? Is activeTool
//      "selection"?
//   5. Click on the line's midpoint (350, 250).
//   6. Inspect: is the line selected? What does hitTestAt return?
//   7. Log results.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3001/#app";
const CDP_PORT = 9335;
const tmp = mkdtempSync(join(tmpdir(), "chrome-linetest-"));

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${tmp}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-gpu",
  "--window-size=1280,900",
  APP_URL,
], { stdio: "ignore" });

const cleanup = () => {
  try { chrome.kill("SIGKILL"); } catch {}
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
};
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });

async function waitForDT(port, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("devtools never came up");
}
async function findPage(port) {
  const r = await fetch(`http://127.0.0.1:${port}/json`);
  const tabs = await r.json();
  const p = tabs.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
  return p.webSocketDebuggerUrl;
}

async function main() {
  await waitForDT(CDP_PORT);
  const pageUrl = await findPage(CDP_PORT);
  const ws = new WebSocket(pageUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.on("open", r));

  let nextId = 1;
  const pending = new Map();
  const consoleMsgs = [];
  const exceptions = [];
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      consoleMsgs.push({ type: msg.params.type, text: msg.params.args.map(a => a.value ?? a.description).join(" ") });
    }
    if (msg.method === "Runtime.exceptionThrown") {
      exceptions.push(msg.params.exceptionDetails.text + " " + (msg.params.exceptionDetails.exception?.description ?? ""));
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

  // Wait for probe.
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const r = await send("Runtime.evaluate", {
      expression: "typeof window.__sveltedrawProbe !== 'undefined'",
      returnByValue: true,
    });
    if (r.result?.value) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  const result = await send("Runtime.evaluate", {
    expression: `
      (async () => {
        const log = [];
        const p = window.__sveltedrawProbe;
        // Clear scene.
        p.scene.replaceAllElements([], { skipValidation: true });
        p.appState.selectedElementIds = {};
        localStorage.removeItem('sveltedraw:scene:v1');
        await new Promise(r => setTimeout(r, 50));

        const container = document.querySelector('.sveltedraw-container');
        const iv = document.querySelector('.sveltedraw__canvas.interactive') ||
                   document.querySelectorAll('canvas')[1];
        container.focus();

        // Press "a" → arrow tool (user's complaint was specifically arrow).
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 50));
        log.push('tool after a: ' + p.appState.activeTool.type);

        // Draw line from (200, 200) to (500, 300) on the canvas.
        const rect = iv.getBoundingClientRect();
        const x0 = rect.left + 200, y0 = rect.top + 200;
        const x1 = rect.left + 500, y1 = rect.top + 300;
        const mk = (type, x, y) => new PointerEvent(type, {
          clientX: x, clientY: y, button: 0, pointerId: 1,
          pointerType: 'mouse', bubbles: true, cancelable: true,
        });
        iv.dispatchEvent(mk('pointerdown', x0, y0));
        await new Promise(r => setTimeout(r, 30));
        iv.dispatchEvent(mk('pointermove', x1, y1));
        await new Promise(r => setTimeout(r, 30));
        iv.dispatchEvent(mk('pointerup', x1, y1));
        await new Promise(r => setTimeout(r, 100));

        const elements = p.scene.getNonDeletedElements();
        log.push('elements after draw: ' + elements.length);
        const line = elements[0];
        if (line) {
          log.push('element type: ' + line.type);
          log.push('element x,y: ' + line.x + ',' + line.y);
          log.push('element w,h: ' + line.width + 'x' + line.height);
          log.push('element points: ' + JSON.stringify(line.points));
        }
        log.push('activeTool after draw: ' + p.appState.activeTool.type);
        log.push('selected after draw: ' + JSON.stringify(Object.keys(p.appState.selectedElementIds)));

        // Now click near midpoint (should select the line — it IS selected
        // from auto-select but let's test fresh click from deselect).
        p.appState.selectedElementIds = {};
        await new Promise(r => setTimeout(r, 30));

        // Midpoint of (200,200)-(500,300) in viewport = (350, 250).
        const mx = rect.left + 350, my = rect.top + 250;
        iv.dispatchEvent(mk('pointerdown', mx, my));
        iv.dispatchEvent(mk('pointerup', mx, my));
        await new Promise(r => setTimeout(r, 100));
        log.push('selected after midpoint click: ' + JSON.stringify(Object.keys(p.appState.selectedElementIds)));

        // Try 3 clicks along the line — start, 1/4, 1/2 — to see where
        // hitTest succeeds/fails.
        const tests = [
          { label: 'on-start', dx: 0, dy: 0 },
          { label: 'on-quarter', dx: 75, dy: 25 },
          { label: 'on-mid', dx: 150, dy: 50 },
          { label: 'on-3quarter', dx: 225, dy: 75 },
          { label: 'on-end', dx: 300, dy: 100 },
        ];
        for (const t of tests) {
          p.appState.selectedElementIds = {};
          await new Promise(r => setTimeout(r, 20));
          const cx = rect.left + 200 + t.dx;
          const cy = rect.top + 200 + t.dy;
          iv.dispatchEvent(mk('pointerdown', cx, cy));
          iv.dispatchEvent(mk('pointerup', cx, cy));
          await new Promise(r => setTimeout(r, 50));
          const got = Object.keys(p.appState.selectedElementIds).length > 0;
          log.push(t.label + ' at (' + cx + ',' + cy + ') → selected=' + got);
        }

        return { log, canvasClasses: iv.className, canvasTag: iv.tagName };
      })()
    `,
    returnByValue: true,
    awaitPromise: true,
  });

  console.log("=== Test log ===");
  const data = result.result?.value;
  if (data?.log) {
    for (const line of data.log) console.log("  " + line);
  }
  console.log("canvas:", data?.canvasTag, data?.canvasClasses);
  if (exceptions.length) {
    console.log("\n=== Exceptions ===");
    for (const e of exceptions) console.log("  " + e);
  }
  if (consoleMsgs.length) {
    console.log("\n=== Console ===");
    for (const m of consoleMsgs.slice(0, 20)) console.log("  [" + m.type + "] " + m.text);
  }
  ws.close();
  cleanup();
}
main().catch((e) => { console.error(e); cleanup(); process.exit(1); });

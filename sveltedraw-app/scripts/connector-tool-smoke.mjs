// Connector tool plugin smoke. Verifies the pointer-handler-coupled
// flow:
//   1. Toolbar button toggles plugin active flag
//   2. Indicator panel renders when active
//   3. Pointerdown on first shape stores firstPickId
//   4. Pointerdown on second shape creates the bound arrow
//   5. Tool deactivates after the arrow lands

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9364;
const tmp = mkdtempSync(join(tmpdir(), "chrome-conn-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${tmp}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--window-size=1280,900",
  APP_URL,
], { stdio: "ignore" });
process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch {} try { rmSync(tmp, { recursive: true, force: true }); } catch {} });

await new Promise(r => setTimeout(r, 6000));
const tabs = await fetch(`http://127.0.0.1:${CDP_PORT}/json`).then(r => r.json());
const ws = await new Promise((res) => { const s = new WebSocket(tabs.find(t => t.type === "page" && !t.url.startsWith("devtools://")).webSocketDebuggerUrl, { perMessageDeflate: false }); s.on("open", () => res(s)); });

let id = 0;
const pending = new Map();
ws.on("message", (data) => { const m = JSON.parse(data.toString()); if (m.id != null && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const cdp = (method, params={}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => {
  for (let i = 0; i < 5; i++) {
    const m = await cdp("Runtime.evaluate", { expression: `(async () => { ${e} })()`, awaitPromise: true, returnByValue: true });
    if (m.error?.message?.includes("Execution context was destroyed")) {
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }
    if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? "?");
    return m.result?.result?.value;
  }
  throw new Error("ctx destroyed");
};

await ev(`
  const dl = Date.now() + 12000;
  while (!window.__sveltedrawProbe && Date.now() < dl) { await new Promise(r => setTimeout(r, 100)); }
`);

const tests = await ev(`
  const p = window.__sveltedrawProbe;
  const tests = [];

  // Seed two rectangles in known positions so we can dispatch pointer
  // events on their centers reliably.
  p.scene.replaceAllElements([
    {
      id: 'rect-A', type: 'rectangle',
      x: 100, y: 100, width: 80, height: 60, angle: 0,
      strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
      strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
      opacity: 100, groupIds: [], frameId: null, index: 'a0',
      boundElements: null, updated: Date.now(), link: null, locked: false,
      seed: 1, version: 1, versionNonce: 1, isDeleted: false,
    },
    {
      id: 'rect-B', type: 'rectangle',
      x: 400, y: 200, width: 80, height: 60, angle: 0,
      strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
      strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
      opacity: 100, groupIds: [], frameId: null, index: 'a1',
      boundElements: null, updated: Date.now(), link: null, locked: false,
      seed: 2, version: 1, versionNonce: 2, isDeleted: false,
    },
  ]);
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 150));
  const beforeCount = p.scene.getNonDeletedElements().length;

  // Step 1: toggle connector tool via toolbar button
  const btn = document.querySelector('button[aria-label="Connector tool (Ctrl+Shift+C)"]');
  btn?.click();
  await new Promise(r => setTimeout(r, 100));
  tests.push({
    name: 'Toolbar toggles tool active',
    ok: !!document.querySelector('[data-panel-id="builtin/connector-tool"]'),
  });

  // Step 2: simulate pointerdown on rect-A center
  // sceneCoords for rect-A center = (100+40, 100+30) = (140, 130).
  // toSceneCoords inverse: clientX = sceneX*zoom + offsetLeft + scrollX*zoom
  // With default zoom=1, scrollX=0, offsetLeft = container.left.
  const canvas = document.querySelector('.sveltedraw__canvas.interactive');
  const dispatchPointer = (sceneX, sceneY) => {
    const a = p.appState;
    const zoom = (a.zoom?.value ?? 1);
    const clientX = (sceneX + (a.scrollX ?? 0)) * zoom + (a.offsetLeft ?? 0);
    const clientY = (sceneY + (a.scrollY ?? 0)) * zoom + (a.offsetTop ?? 0);
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      clientX, clientY, button: 0, pointerId: 1, isPrimary: true,
      bubbles: true, cancelable: true,
    }));
  };

  dispatchPointer(140, 130); // center of rect-A
  await new Promise(r => setTimeout(r, 100));
  tests.push({
    name: 'First pick highlights rect-A',
    ok: p.appState.selectedElementIds?.['rect-A'] === true,
  });

  dispatchPointer(440, 230); // center of rect-B
  await new Promise(r => setTimeout(r, 150));
  const afterCount = p.scene.getNonDeletedElements().length;
  tests.push({
    name: 'Second pick creates bound arrow',
    ok: afterCount === beforeCount + 1,
    detail: 'before=' + beforeCount + ' after=' + afterCount,
  });

  // After arrow placed, tool should deactivate, panel should hide
  tests.push({
    name: 'Tool deactivates after arrow placed',
    ok: !document.querySelector('[data-panel-id="builtin/connector-tool"]'),
  });

  // Verify the new arrow has bindings to rect-A and rect-B
  const arrow = p.scene.getNonDeletedElements().find(e => e.type === 'arrow');
  tests.push({
    name: 'Arrow has startBinding to rect-A',
    ok: arrow?.startBinding?.elementId === 'rect-A',
  });
  tests.push({
    name: 'Arrow has endBinding to rect-B',
    ok: arrow?.endBinding?.elementId === 'rect-B',
  });

  return tests;
`);

console.log("=== connector tool smoke ===");
let failed = 0;
for (const t of tests) {
  console.log("  " + (t.ok ? "PASS" : "FAIL") + " " + t.name + (t.detail ? " (" + t.detail + ")" : ""));
  if (!t.ok) failed++;
}
ws.close();
process.exit(failed > 0 ? 1 : 0);

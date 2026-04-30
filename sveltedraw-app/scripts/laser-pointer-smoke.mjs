// Laser pointer plugin smoke. Verifies:
//   1. Toolbar button toggles plugin active flag
//   2. Plugin store reflects active state
//   3. Container class adds 'sveltedraw--laser' when active
//   4. Pointermove samples flow through to plugin trail
//   5. Tool cancels on Escape

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9365;
const tmp = mkdtempSync(join(tmpdir(), "chrome-laser-"));
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

  // Probe surface still works (honest-tests rely on it)
  const initActive = p.isLaserActive();
  tests.push({ name: 'probe.isLaserActive() returns false initially', ok: initActive === false });

  // Step 1: toggle via toolbar button
  const btn = document.querySelector('button[aria-label="Laser pointer (K)"]');
  btn?.click();
  await new Promise(r => setTimeout(r, 100));
  tests.push({ name: 'Toolbar toggle activates laser', ok: p.isLaserActive() === true });

  // Step 2: container class flips
  const container = document.querySelector('.sveltedraw-container');
  tests.push({
    name: 'Container class includes sveltedraw--laser when active',
    ok: container?.classList.contains('sveltedraw--laser'),
  });

  // Step 3: pointermove dispatches → trail records
  // Plugin's recordSample takes container-relative coords; dispatch a
  // pointermove with clientX/Y derived from container rect.
  const interactive = document.querySelector('.sveltedraw__canvas.interactive');
  const rect = container.getBoundingClientRect();
  for (const [dx, dy] of [[100, 100], [120, 110], [140, 120]]) {
    interactive.dispatchEvent(new PointerEvent('pointermove', {
      clientX: rect.left + dx, clientY: rect.top + dy,
      pointerId: 1, isPrimary: true, bubbles: true, cancelable: true,
    }));
  }
  await new Promise(r => setTimeout(r, 100));
  // The laser overlay is rendered via the plugin. SVG class is
  // sveltedraw-laser-overlay. Trail entries become <line> children
  // (one per consecutive pair, so 3 samples = 2 lines).
  const overlay = document.querySelector('svg.sveltedraw-laser-overlay');
  const lines = overlay ? overlay.querySelectorAll('line') : [];
  const trailLen = p.getLaserTrailLen?.() ?? 0;
  tests.push({
    name: 'Pointermove records trail (svg has line segments)',
    ok: lines.length >= 1,
    detail: 'overlay=' + !!overlay + ' lines=' + lines.length + ' trailLen=' + trailLen,
  });

  // Step 4: Escape cancels
  container.focus();
  container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 100));
  tests.push({ name: 'Escape cancels laser tool', ok: p.isLaserActive() === false });

  // Step 5: container class removed
  tests.push({
    name: 'Container class removes sveltedraw--laser after cancel',
    ok: !container.classList.contains('sveltedraw--laser'),
  });

  return tests;
`);

console.log("=== laser pointer smoke ===");
let failed = 0;
for (const t of tests) {
  console.log("  " + (t.ok ? "PASS" : "FAIL") + " " + t.name + (t.detail ? " (" + t.detail + ")" : ""));
  if (!t.ok) failed++;
}
ws.close();
process.exit(failed > 0 ? 1 : 0);

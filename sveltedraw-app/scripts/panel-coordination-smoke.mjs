// Smoke test for the side-panel coordination bug fix.
//
// Pre-fix behavior: opening a plugin exclusive panel (Alignment, etc.)
// did NOT close still-inline panels (Grid). Both rendered on the same
// right-edge anchor, visually stacking.
//
// Post-fix: registry.openExclusiveSidePanel runs registered external
// closers (App.svelte hooks one that clears gridPanelActive /
// layerPanelActive / libraryPanelActive) BEFORE flipping plugin
// panel state. So opening Alignment closes any open inline panel.
//
// Verification flow:
//   1. Open Grid (inline panel) via its UtilityBar button
//   2. Confirm Grid is open + History plugin panel is closed
//   3. Click History plugin button
//   4. Confirm History opens AND Grid closes (the fix)
//   5. Click Alignment plugin button
//   6. Confirm Alignment opens AND History closes (plugin↔plugin still works)

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9359;
const tmp = mkdtempSync(join(tmpdir(), "chrome-coord-smoke-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${tmp}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--window-size=1280,900",
  APP_URL,
], { stdio: "ignore" });
process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch {} try { rmSync(tmp, { recursive: true, force: true }); } catch {} });

await new Promise(r => setTimeout(r, 6000));
const tabs = await fetch(`http://127.0.0.1:${CDP_PORT}/json`).then(r => r.json());
const wsUrl = tabs.find(t => t.type === "page" && !t.url.startsWith("devtools://")).webSocketDebuggerUrl;
const ws = await new Promise((res) => { const s = new WebSocket(wsUrl, { perMessageDeflate: false }); s.on("open", () => res(s)); });

let id = 0;
const pending = new Map();
ws.on("message", (data) => {
  const m = JSON.parse(data.toString());
  if (m.id != null && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const cdp = (method, params={}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalRetry = async (expr, attempts = 5) => {
  for (let i = 0; i < attempts; i++) {
    const m = await cdp("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (m.error?.message?.includes("Execution context was destroyed")) {
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }
    if (m.result?.exceptionDetails) throw new Error(`eval: ${m.result.exceptionDetails.exception?.description}`);
    return m.result?.result?.value;
  }
  throw new Error("ctx destroyed");
};

await evalRetry(`
  const dl = Date.now() + 12000;
  while (!window.__sveltedrawProbe && Date.now() < dl) { await new Promise(r => setTimeout(r, 100)); }
  if (!window.__sveltedrawProbe) throw new Error('probe never loaded');
`);

const result = await evalRetry(`
  // Three plugin exclusive panels — opening any one should close the
  // others. After Tier 2 wave 6 every side panel is a plugin so this
  // checks the registry's openExclusiveSidePanel coordination across
  // homogeneous plugin panels (no more inline holdouts).
  const isGridOpen = () => !!document.querySelector('[data-panel-id="builtin/grid-panel"]');
  const isHistoryOpen = () => !!document.querySelector('[data-panel-id="builtin/history-panel"]');
  const isAlignOpen = () => !!document.querySelector('[data-panel-id="builtin/alignment-panel"]');

  const gridBtn = document.querySelector('button[aria-label="Grid & Snap"]');
  gridBtn?.click();
  await new Promise(r => setTimeout(r, 100));
  const after1 = { grid: isGridOpen(), history: isHistoryOpen(), align: isAlignOpen() };

  const histBtn = document.querySelector('button[aria-label="History"]');
  histBtn?.click();
  await new Promise(r => setTimeout(r, 100));
  const after2 = { grid: isGridOpen(), history: isHistoryOpen(), align: isAlignOpen() };

  const alignBtn = document.querySelector('button[aria-label="Alignment"]');
  alignBtn?.click();
  await new Promise(r => setTimeout(r, 100));
  const after3 = { grid: isGridOpen(), history: isHistoryOpen(), align: isAlignOpen() };

  return { after1, after2, after3 };
`);

console.log(JSON.stringify(result, null, 2));
ws.close();

const ok =
  result.after1.grid && !result.after1.history && !result.after1.align &&
  !result.after2.grid && result.after2.history && !result.after2.align &&
  !result.after3.grid && !result.after3.history && result.after3.align;
process.exit(ok ? 0 : 1);

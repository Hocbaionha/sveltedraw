// Comprehensive plugin smoke — opens every built-in plugin's UI surface
// and verifies the panel/modal renders. Tier 2 final verification.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9360;
const tmp = mkdtempSync(join(tmpdir(), "chrome-full-smoke-"));
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
const consoleErrors = [];
ws.on("message", (data) => {
  const m = JSON.parse(data.toString());
  if (m.method === "Runtime.exceptionThrown") consoleErrors.push(m.params.exceptionDetails.exception?.description ?? JSON.stringify(m.params.exceptionDetails));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors.push(m.params.args.map(a => a.value || a.description).join(" "));
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

await cdp("Runtime.enable");

await evalRetry(`
  const dl = Date.now() + 12000;
  while (!window.__sveltedrawProbe && Date.now() < dl) { await new Promise(r => setTimeout(r, 100)); }
  if (!window.__sveltedrawProbe) throw new Error('probe never loaded');
`);

const result = await evalRetry(`
  // List of all 11 plugins. For each, check that:
  //   1. Toolbar button renders (matches by aria-label)
  //   2. Clicking it makes the expected panel/modal visible
  //   3. Clicking again (or close) hides it
  const plugins = [
    { id: "recent-files", btnLabel: "Recent files (Ctrl+R)", openSel: ".recent-files-modal" },
    { id: "settings",     btnLabel: "Settings (Ctrl+,)",     openSel: ".settings-backdrop" },
    { id: "help",         btnLabel: "Help (F1)",             openSel: ".help-backdrop" },
    { id: "templates",    btnLabel: "New from template (Ctrl+N)", openSel: ".template-selector-backdrop" },
    { id: "history-panel",         btnLabel: "History",       openSel: '[data-panel-id="builtin/history-panel"]' },
    { id: "alignment-panel",       btnLabel: "Alignment",     openSel: '[data-panel-id="builtin/alignment-panel"]' },
    { id: "autolayout-panel",      btnLabel: "Auto Layout",   openSel: '[data-panel-id="builtin/autolayout-panel"]' },
    { id: "measurement-panel",     btnLabel: "Measurement",   openSel: '[data-panel-id="builtin/measurement-panel"]' },
    { id: "grid-panel",            btnLabel: "Grid & Snap",   openSel: '[data-panel-id="builtin/grid-panel"]' },
    { id: "layer-panel",           btnLabel: "Layers",        openSel: '[data-panel-id="builtin/layer-panel"]' },
    { id: "shape-library-panel",   btnLabel: "Shape Library", openSel: '[data-panel-id="builtin/shape-library-panel"]' },
  ];

  const results = [];
  for (const p of plugins) {
    const btn = document.querySelector('button[aria-label="' + p.btnLabel + '"]');
    if (!btn) { results.push({ id: p.id, btn: false }); continue; }

    // Initially hidden
    const before = !!document.querySelector(p.openSel);

    // Click → open
    btn.click();
    await new Promise(r => setTimeout(r, 120));
    const afterOpen = !!document.querySelector(p.openSel);

    // For modals, find a close button or click backdrop. For exclusive
    // panels, click the toolbar button again. Try toolbar-toggle first.
    btn.click();
    await new Promise(r => setTimeout(r, 120));
    const afterClose = !!document.querySelector(p.openSel);

    results.push({
      id: p.id,
      btn: true,
      hiddenInit: !before,
      shownAfterOpen: afterOpen,
      hiddenAfterClose: !afterClose,
    });
  }
  return results;
`);

console.log("=== plugin smoke results ===");
const failed = [];
for (const r of result) {
  const ok = r.btn && r.hiddenInit && r.shownAfterOpen && r.hiddenAfterClose;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${r.id}  btn=${r.btn} init=${r.hiddenInit} open=${r.shownAfterOpen} close=${r.hiddenAfterClose}`);
  if (!ok) failed.push(r.id);
}

if (consoleErrors.length > 0) {
  console.log("\n=== console errors ===");
  for (const e of consoleErrors) console.log("  ", e);
}

ws.close();
process.exit(failed.length > 0 ? 1 : 0);

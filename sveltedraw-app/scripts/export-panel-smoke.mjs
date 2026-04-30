// Export panel plugin smoke. Verifies:
//   1. UtilityBar Export button (💾) opens the panel via the plugin store
//   2. Plugin's toolbar item also toggles the panel
//   3. Panel close button hides the modal
//   4. Clicking Export inside the panel calls the bridge's doExport,
//      handing the right options to the export pipeline
//   5. Probe.handleExport(opts) still works (preserves existing API)

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9368;
const tmp = mkdtempSync(join(tmpdir(), "chrome-export-"));
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

  // ── 1. Plugin's toolbar button (the only Export button in the bar
  //      after wave 3 cleanup — UtilityBar dropped its hardcoded copy)
  //      opens the panel. Selecting by data-plugin-toolbar-id proves
  //      the click is exercising the plugin path, not a stray fallback.
  const pluginBtn = document.querySelector('button[data-plugin-toolbar-id="builtin/export-panel/open"]');
  pluginBtn?.click();
  await new Promise(r => setTimeout(r, 200));
  const panelOpen = !!document.querySelector('.export-panel-overlay');
  tests.push({
    name: 'Plugin toolbar button opens panel',
    ok: panelOpen && !!pluginBtn,
    detail: 'overlay=' + panelOpen + ' pluginBtn=' + !!pluginBtn,
  });

  // ── 2. There must be exactly ONE Export button (no leftover hardcoded)
  const allExportBtns = document.querySelectorAll('button[aria-label="Export"]');
  tests.push({
    name: 'Only one Export button after wave 3 cleanup',
    ok: allExportBtns.length === 1,
    detail: 'count=' + allExportBtns.length,
  });

  // ── 3. Close (click overlay backdrop) hides the panel
  const overlayEl = document.querySelector('.export-panel-overlay');
  overlayEl?.click();
  await new Promise(r => setTimeout(r, 150));
  const closedAfterX = !document.querySelector('.export-panel-overlay');
  tests.push({ name: 'Click backdrop hides panel', ok: closedAfterX });

  // ── 3b. Plugin store toggle re-opens
  pluginBtn?.click();
  await new Promise(r => setTimeout(r, 150));
  const reopened = !!document.querySelector('.export-panel-overlay');
  tests.push({ name: 'Plugin button toggles back on', ok: reopened });

  // ── 4. Bridge: clicking Export inside the panel triggers doExport
  // Install the download hook so we capture the blob without the
  // browser actually downloading anything in headless.
  let captured = null;
  window.__sveltedrawDownloadHook = (blob, fileName) => { captured = { fileName, size: blob.size, type: blob.type }; };

  // Insert one element so the export has something to render
  p.scene.replaceAllElements([{
    id: 'el-export-test', type: 'rectangle',
    x: 10, y: 10, width: 50, height: 50, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: 'a0',
    boundElements: null, updated: Date.now(), link: null, locked: false,
    seed: 1, version: 1, versionNonce: 1, isDeleted: false,
  }]);
  await new Promise(r => setTimeout(r, 100));

  // Pick JSON to keep it deterministic + cheap (no canvas compositing).
  // Format buttons are .ep-format-btn with the format name in .ep-format-name.
  const formatBtns = Array.from(document.querySelectorAll('.export-panel-overlay .ep-format-btn'));
  const jsonBtn = formatBtns.find((b) => /JSON/i.test(b.querySelector('.ep-format-name')?.textContent ?? ''));
  if (jsonBtn) {
    jsonBtn.click();
    await new Promise(r => setTimeout(r, 50));
  }

  // Submit button is .ep-btn.ep-btn-primary — text is "💾 Export <name>".
  const submitBtn = document.querySelector('.export-panel-overlay .ep-btn-primary');
  submitBtn?.click();
  await new Promise(r => setTimeout(r, 400));

  tests.push({
    name: 'Export button triggers export pipeline (download hook fires)',
    ok: captured !== null && captured.size > 0,
    detail: 'captured=' + JSON.stringify(captured),
  });

  // ── 5. After export, panel auto-closes (onComplete → close)
  const panelGone = !document.querySelector('.export-panel-overlay');
  tests.push({
    name: 'Panel auto-closes after export completes',
    ok: panelGone,
  });

  // ── 6. probe.handleExport still works
  captured = null;
  p.handleExport({
    format: 'json',
    fileName: 'probe-test',
    width: 800, height: 600, scale: 1, quality: 0.9,
    includeBackground: true, includeBorder: false, borderWidth: 0, borderColor: '#000',
    transparent: false,
  });
  await new Promise(r => setTimeout(r, 300));
  tests.push({
    name: 'probe.handleExport(opts) still works',
    ok: captured !== null && captured.fileName === 'probe-test.json',
    detail: 'captured=' + JSON.stringify(captured),
  });

  return tests;
`);

console.log("=== export panel smoke ===");
let failed = 0;
for (const t of tests) {
  console.log("  " + (t.ok ? "PASS" : "FAIL") + " " + t.name + (t.detail ? " (" + t.detail + ")" : ""));
  if (!t.ok) failed++;
}
ws.close();
process.exit(failed > 0 ? 1 : 0);

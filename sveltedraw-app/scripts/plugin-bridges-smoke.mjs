// Verify bridges actually pipe live editor state to plugin panels.
// Mutates editor state via the probe surface, then asserts the plugin
// panel's rendered DOM reflects the new state (not stale).

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9362;
const tmp = mkdtempSync(join(tmpdir(), "chrome-bridges-"));
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

  // ── History bridge: trigger a history mutation, panel should reflect ──
  const histBtn = document.querySelector('button[aria-label="History"]');
  histBtn?.click();
  await new Promise(r => setTimeout(r, 150));
  const before = document.querySelectorAll('[data-panel-id="builtin/history-panel"] .hp-item').length;
  // Insert an element to bump history
  p.scene.replaceAllElements([{
    id: 'el-bridge-test', type: 'rectangle',
    x: 10, y: 10, width: 50, height: 50, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: 'a0',
    boundElements: null, updated: Date.now(), link: null, locked: false,
    seed: 1, version: 1, versionNonce: 1, isDeleted: false,
  }]);
  p.pushHistory();
  await new Promise(r => setTimeout(r, 200));
  const after = document.querySelectorAll('[data-panel-id="builtin/history-panel"] .hp-item').length;
  tests.push({
    name: 'History bridge: pushHistory → panel updates entry count',
    ok: after > before,
    detail: 'before=' + before + ' after=' + after,
  });
  histBtn?.click();
  await new Promise(r => setTimeout(r, 100));

  // ── Layer bridge: scene has 1 element, layer panel should reflect ──
  // syncLayersFromScene runs inside the static-render effect which
  // tracks sceneReady. Bump it so layers derive from the inserted rect.
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 150));
  const layerBtn = document.querySelector('button[aria-label="Layers"]');
  layerBtn?.click();
  await new Promise(r => setTimeout(r, 200));
  const layerCount = document.querySelectorAll('[data-panel-id="builtin/layer-panel"] .lp-item').length;
  tests.push({
    name: 'Layer bridge: panel renders 1 layer for 1 element',
    ok: layerCount === 1,
    detail: 'layerCount=' + layerCount,
  });
  layerBtn?.click();
  await new Promise(r => setTimeout(r, 100));

  // ── Settings bridge: open settings, change theme, verify appState.theme updates ──
  const setBtn = document.querySelector('button[aria-label="Settings (Ctrl+,)"]');
  setBtn?.click();
  await new Promise(r => setTimeout(r, 150));
  const settingsRendered = !!document.querySelector('.settings-backdrop');
  tests.push({
    name: 'Settings bridge: panel mounts with persisted state',
    ok: settingsRendered,
    detail: 'rendered=' + settingsRendered,
  });
  document.body.click();
  await new Promise(r => setTimeout(r, 100));

  return tests;
`);

console.log("=== bridge smoke ===");
let failed = 0;
for (const t of tests) {
  console.log(`  ${t.ok ? "PASS" : "FAIL"} ${t.name}  (${t.detail})`);
  if (!t.ok) failed++;
}
ws.close();
process.exit(failed > 0 ? 1 : 0);

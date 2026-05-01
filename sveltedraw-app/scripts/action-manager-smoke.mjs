// ActionManager smoke. Verifies:
//   1. The manager is published on the registry context (and the test
//      probe surface exposes it for inspection).
//   2. Listing actions returns the canonical core set.
//   3. Direct execute(id) fires the perform function.
//   4. executeKey(KeyboardEvent) dispatches via the hotkey index.
//   5. Predicate gating prevents disabled actions from firing.
//   6. Ctrl+A (registered as edit.selectAll) actually selects all
//      elements end-to-end through the keydown handler.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9382;
const tmp = mkdtempSync(join(tmpdir(), "chrome-actions-"));
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

  // The action manager isn't on the probe surface yet — reach it via
  // the registry's context map. We expose just enough to introspect
  // for the smoke (list ids, execute by id) without leaking it as a
  // first-class probe field.
  const am = p.getActionManager?.();
  tests.push({
    name: 'ActionManager reachable via probe',
    ok: am != null && typeof am.execute === 'function' && typeof am.list === 'function',
    detail: 'has execute=' + (typeof am?.execute) + ' has list=' + (typeof am?.list),
  });
  if (!am) return tests; // bail — rest of the suite needs it

  // Canonical core actions are registered
  const ids = am.list().map(a => a.id);
  const canonical = ['edit.selectAll', 'edit.deleteSelected', 'edit.undo', 'edit.redo', 'view.zoomIn', 'arrange.group', 'tool.rectangle'];
  const missing = canonical.filter(c => !ids.includes(c));
  tests.push({
    name: 'Core actions registered',
    ok: missing.length === 0,
    detail: 'count=' + ids.length + ' missing=' + JSON.stringify(missing),
  });

  // Insert two elements so selectAll has something to grab
  p.scene.replaceAllElements([
    { id: 'r1', type: 'rectangle', x: 10, y: 10, width: 50, height: 50, angle: 0,
      strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
      strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
      opacity: 100, groupIds: [], frameId: null, index: 'a0',
      boundElements: null, updated: Date.now(), link: null, locked: false,
      seed: 1, version: 1, versionNonce: 1, isDeleted: false },
    { id: 'r2', type: 'rectangle', x: 100, y: 100, width: 50, height: 50, angle: 0,
      strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
      strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
      opacity: 100, groupIds: [], frameId: null, index: 'a1',
      boundElements: null, updated: Date.now(), link: null, locked: false,
      seed: 2, version: 1, versionNonce: 2, isDeleted: false },
  ]);
  p.bumpSceneRepaint();
  p.appState.selectedElementIds = {};
  await new Promise(r => setTimeout(r, 50));

  // Direct execute(id) — selectAll
  am.execute('edit.selectAll');
  await new Promise(r => setTimeout(r, 50));
  const afterSelectAll = Object.keys(p.appState.selectedElementIds || {}).length;
  tests.push({
    name: 'execute(edit.selectAll) selects all elements',
    ok: afterSelectAll === 2,
    detail: 'selected=' + afterSelectAll,
  });

  // Predicate gating: edit.deleteSelected with empty selection should
  // return undefined (predicate fails)
  p.appState.selectedElementIds = {};
  await new Promise(r => setTimeout(r, 50));
  const blocked = am.execute('edit.deleteSelected');
  tests.push({
    name: 'predicate gates edit.deleteSelected when nothing selected',
    ok: blocked === undefined,
    detail: 'result=' + JSON.stringify(blocked),
  });

  // executeKey via simulated keydown — Ctrl+A
  const container = document.querySelector('.sveltedraw-container');
  container?.focus();
  const kev = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true });
  container?.dispatchEvent(kev);
  await new Promise(r => setTimeout(r, 80));
  const afterCtrlA = Object.keys(p.appState.selectedElementIds || {}).length;
  tests.push({
    name: 'Ctrl+A keydown routes through ActionManager',
    ok: afterCtrlA === 2,
    detail: 'selected=' + afterCtrlA,
  });

  // executeKey for an unregistered combo returns undefined → falls through
  const fallthrough = am.executeKey(new KeyboardEvent('keydown', { key: 'F12' }));
  tests.push({
    name: 'unregistered hotkey returns undefined (fall-through)',
    ok: fallthrough === undefined,
  });

  // Hotkey for redo — verify both Ctrl+Y and Ctrl+Shift+Z are registered
  const redoAction = am.list().find(a => a.id === 'edit.redo');
  const hotkeys = redoAction?.hotkey;
  const hasYBinding = Array.isArray(hotkeys) ? hotkeys.includes('CmdOrCtrl+Y') : hotkeys === 'CmdOrCtrl+Y';
  const hasShiftZBinding = Array.isArray(hotkeys) ? hotkeys.includes('CmdOrCtrl+Shift+Z') : false;
  tests.push({
    name: 'edit.redo registers both Ctrl+Y and Ctrl+Shift+Z',
    ok: hasYBinding && hasShiftZBinding,
    detail: 'hotkeys=' + JSON.stringify(hotkeys),
  });

  // Plugin-contributed action: laser-pointer registers toggle as
  // \`builtin/laser-pointer/toggle\` with hotkey K. Verifies the
  // ctx.addAction integration end-to-end.
  const laserAction = am.list().find(a => a.id === 'builtin/laser-pointer/toggle');
  tests.push({
    name: 'plugin-contributed action registered (laser-pointer)',
    ok: laserAction != null && laserAction.hotkey === 'K',
    detail: 'found=' + !!laserAction + ' hotkey=' + JSON.stringify(laserAction?.hotkey),
  });

  // Dispatch the plugin action via hotkey — should toggle laser
  const beforeLaser = p.isLaserActive();
  container?.focus();
  container?.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 100));
  const afterLaser = p.isLaserActive();
  tests.push({
    name: 'K keydown dispatches plugin action (toggle laser)',
    ok: beforeLaser === false && afterLaser === true,
    detail: 'before=' + beforeLaser + ' after=' + afterLaser,
  });

  return tests;
`);

console.log("=== action manager smoke ===");
let failed = 0;
for (const t of tests) {
  console.log("  " + (t.ok ? "PASS" : "FAIL") + " " + t.name + (t.detail ? " (" + t.detail + ")" : ""));
  if (!t.ok) failed++;
}
ws.close();
process.exit(failed > 0 ? 1 : 0);

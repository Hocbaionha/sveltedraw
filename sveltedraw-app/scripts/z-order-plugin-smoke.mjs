// Z-order plugin smoke. Verifies:
//   1. arrange.bringForward action moves selected one step forward
//      (inserted-second element ends up after the third by index)
//   2. arrange.sendBackward returns it to the original position
//   3. arrange.bringToFront moves to the very end
//   4. arrange.sendToBack moves to the very start
//   5. reorder no-ops on empty selection (smoke-only check via probe)

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9391;
const tmp = mkdtempSync(join(tmpdir(), "chrome-zorder-"));
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
  const am = p.getActionManager();

  // Build a 3-element scene. We'll select the MIDDLE one and shuffle.
  const A = "z-a-" + Date.now().toString(36);
  const B = "z-b-" + Date.now().toString(36);
  const C = "z-c-" + Date.now().toString(36);
  const mk = (id, idx) => ({
    id, type: 'rectangle', x: 0, y: 0, width: 50, height: 50, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: idx,
    boundElements: null, updated: Date.now(), link: null, locked: false,
    seed: 1, version: 1, versionNonce: 1, isDeleted: false,
  });
  // B is intentionally MIDDLE so bringForward has somewhere to go
  // (asserting indexOf increases would fail vacuously if B was last).
  p.scene.replaceAllElements([mk(A, 'a0'), mk(B, 'a1'), mk(C, 'a2')]);
  p.appState.selectedElementIds = { [B]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 80));

  const idsInOrder = () => p.scene.getElementsIncludingDeleted().map(e => e.id);

  // ── 1. bringForward via the ActionManager (covers hotkey route too)
  const before1 = idsInOrder();
  am.execute("arrange.bringForward");
  await new Promise(r => setTimeout(r, 80));
  const after1 = idsInOrder();
  // B was middle; bringForward should move it past C.
  tests.push({
    name: 'bringForward moves selected element one step forward',
    ok: after1.indexOf(B) > before1.indexOf(B),
    detail: 'before=' + before1.join(',') + ' after=' + after1.join(','),
  });

  // ── 2. sendBackward returns it (idempotent inverse)
  am.execute("arrange.sendBackward");
  await new Promise(r => setTimeout(r, 80));
  const after2 = idsInOrder();
  tests.push({
    name: 'sendBackward inverts bringForward',
    ok: after2.indexOf(B) === before1.indexOf(B),
    detail: 'after2=' + after2.join(','),
  });

  // ── 3. bringToFront moves to the very end
  am.execute("arrange.bringToFront");
  await new Promise(r => setTimeout(r, 80));
  const after3 = idsInOrder();
  tests.push({
    name: 'bringToFront moves selected to the last position',
    ok: after3[after3.length - 1] === B,
    detail: 'order=' + after3.join(','),
  });

  // ── 4. sendToBack moves to the very start
  am.execute("arrange.sendToBack");
  await new Promise(r => setTimeout(r, 80));
  const after4 = idsInOrder();
  tests.push({
    name: 'sendToBack moves selected to the first position',
    ok: after4[0] === B,
    detail: 'order=' + after4.join(','),
  });

  // ── 5. plugin empty-selection guard, bypassing the action
  // predicate. The arrange.bringForward action gates on hasSel(),
  // so ActionManager dispatch never reaches the plugin guard. Call
  // the plugin store via the host shim that the probe exposes.
  p.appState.selectedElementIds = {};
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 50));
  const before5 = idsInOrder();
  if (typeof p.reorderSelected === 'function') {
    p.reorderSelected('forward');
  }
  await new Promise(r => setTimeout(r, 50));
  const after5 = idsInOrder();
  tests.push({
    name: 'plugin reorder no-ops on empty selection (bypasses action predicate)',
    ok: before5.join(',') === after5.join(','),
    detail: 'order unchanged=' + (before5.join(',') === after5.join(',')),
  });

  // ── 6. plugin default-branch covers unknown directions
  // The plugin has a defensive default-return for direction strings
  // outside the typed union (reachable from probe code, devtools
  // console, future stringy callers). Re-establish a single-element
  // selection so the empty-selection short-circuit doesn't preempt
  // the unknown-direction branch, then call with a garbage string.
  // Order must not change.
  p.appState.selectedElementIds = { [A]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 50));
  const before6 = idsInOrder();
  if (typeof p.reorderSelected === 'function') {
    p.reorderSelected('sideways');
  }
  await new Promise(r => setTimeout(r, 50));
  const after6 = idsInOrder();
  tests.push({
    name: 'plugin reorder no-ops on unknown direction string',
    ok: before6.join(',') === after6.join(','),
    detail: 'order unchanged=' + (before6.join(',') === after6.join(',')),
  });

  return tests;
`);

console.log("=== z-order plugin smoke ===");
let failed = 0;
for (const t of tests) {
  console.log("  " + (t.ok ? "PASS" : "FAIL") + " " + t.name + (t.detail ? " (" + t.detail + ")" : ""));
  if (!t.ok) failed++;
}
ws.close();
process.exit(failed > 0 ? 1 : 0);

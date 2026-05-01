// Persistence plugin smoke. Verifies the migrated builtin/persistence
// plugin actually saves to localStorage after the debounce + flushes
// on beforeunload.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9389;
const tmp = mkdtempSync(join(tmpdir(), "chrome-persist-"));
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

  // ── 1. Clear any existing save so we start clean.
  localStorage.removeItem("sveltedraw:scene:v1");
  // Insert one element + bump scene to fire onSceneChange.
  const ELEMENT_ID = "persist-test-" + Date.now().toString(36);
  p.scene.replaceAllElements([{
    id: ELEMENT_ID, type: 'rectangle',
    x: 30, y: 40, width: 50, height: 60, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: 'a0',
    boundElements: null, updated: Date.now(), link: null, locked: false,
    seed: 1, version: 1, versionNonce: 1, isDeleted: false,
  }]);
  p.bumpSceneRepaint();
  // The plugin's debounce is 500ms. Wait + 100ms grace.
  await new Promise(r => setTimeout(r, 700));
  const saved = localStorage.getItem("sveltedraw:scene:v1");
  let parsed = null;
  try { parsed = JSON.parse(saved ?? ""); } catch {}
  tests.push({
    name: 'scene change → debounced save lands in localStorage',
    ok: !!parsed && parsed.elements?.[0]?.id === ELEMENT_ID,
    detail: 'savedKeys=' + (parsed ? Object.keys(parsed).join(',') : 'none') + ' elem0=' + (parsed?.elements?.[0]?.id ?? 'none'),
  });

  // ── 2. Insert a SECOND element + dispatch beforeunload BEFORE
  //      the debounce fires. The plugin's beforeunload observer
  //      flushes synchronously so the save lands.
  localStorage.removeItem("sveltedraw:scene:v1");
  const ELEMENT_ID_2 = "persist-flush-" + Date.now().toString(36);
  p.scene.replaceAllElements([{
    id: ELEMENT_ID_2, type: 'rectangle',
    x: 50, y: 60, width: 70, height: 80, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: 'a1',
    boundElements: null, updated: Date.now(), link: null, locked: false,
    seed: 2, version: 1, versionNonce: 2, isDeleted: false,
  }]);
  p.bumpSceneRepaint();
  // Wait LESS than the debounce — the save shouldn't have fired yet.
  await new Promise(r => setTimeout(r, 100));
  const beforeFlush = localStorage.getItem("sveltedraw:scene:v1");
  // Dispatch beforeunload — plugin's observer flushes pending save.
  window.dispatchEvent(new Event("beforeunload"));
  await new Promise(r => setTimeout(r, 50));
  const afterFlush = localStorage.getItem("sveltedraw:scene:v1");
  let flushedParsed = null;
  try { flushedParsed = JSON.parse(afterFlush ?? ""); } catch {}
  tests.push({
    name: 'beforeunload flushes pending debounced save',
    ok: beforeFlush == null && !!flushedParsed && flushedParsed.elements?.[0]?.id === ELEMENT_ID_2,
    detail: 'beforeFlush=' + (beforeFlush == null ? 'null' : 'set') + ' afterFlush=' + (flushedParsed?.elements?.[0]?.id ?? 'none'),
  });

  return tests;
`);

console.log("=== persistence plugin smoke ===");
let failed = 0;
for (const t of tests) {
  console.log("  " + (t.ok ? "PASS" : "FAIL") + " " + t.name + (t.detail ? " (" + t.detail + ")" : ""));
  if (!t.ok) failed++;
}
ws.close();
process.exit(failed > 0 ? 1 : 0);

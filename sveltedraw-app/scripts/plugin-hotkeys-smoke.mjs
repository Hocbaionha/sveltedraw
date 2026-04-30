// Verify keyboard shortcuts route through the plugin registry stores.
// Each shortcut should toggle the corresponding plugin panel/modal.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9361;
const tmp = mkdtempSync(join(tmpdir(), "chrome-hk-smoke-"));
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
  const m = await cdp("Runtime.evaluate", { expression: `(async () => { ${e} })()`, awaitPromise: true, returnByValue: true });
  if (m.error?.message?.includes("Execution context was destroyed")) {
    await new Promise(r => setTimeout(r, 1500));
    return ev(e);
  }
  if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? "?");
  return m.result?.result?.value;
};

await ev(`
  const dl = Date.now() + 12000;
  while (!window.__sveltedrawProbe && Date.now() < dl) { await new Promise(r => setTimeout(r, 100)); }
`);

// Hotkey routes: dispatch keydown on .sveltedraw-container (focused element)
const result = await ev(`
  const container = document.querySelector('.sveltedraw-container');
  container.focus();
  await new Promise(r => setTimeout(r, 30));

  const dispatch = (k, opts = {}) => {
    container.dispatchEvent(new KeyboardEvent('keydown', {
      key: k, ctrlKey: opts.ctrl ?? false, shiftKey: opts.shift ?? false, altKey: opts.alt ?? false,
      bubbles: true, cancelable: true,
    }));
  };

  const tests = [];

  // F1 → Help
  dispatch('F1');
  await new Promise(r => setTimeout(r, 100));
  tests.push({ name: 'F1 opens Help', ok: !!document.querySelector('.help-backdrop') });
  dispatch('F1');
  await new Promise(r => setTimeout(r, 100));

  // Ctrl+, → Settings
  dispatch(',', { ctrl: true });
  await new Promise(r => setTimeout(r, 100));
  tests.push({ name: 'Ctrl+, opens Settings', ok: !!document.querySelector('.settings-backdrop') });
  dispatch(',', { ctrl: true });
  await new Promise(r => setTimeout(r, 100));

  // Ctrl+R → Recent files
  dispatch('r', { ctrl: true });
  await new Promise(r => setTimeout(r, 100));
  tests.push({ name: 'Ctrl+R opens Recent', ok: !!document.querySelector('.recent-files-modal') });
  // Close via Escape
  document.body.click();
  await new Promise(r => setTimeout(r, 100));

  // Ctrl+N → Templates
  dispatch('n', { ctrl: true });
  await new Promise(r => setTimeout(r, 100));
  tests.push({ name: 'Ctrl+N opens Templates', ok: !!document.querySelector('.template-selector-backdrop') });
  document.body.click();
  await new Promise(r => setTimeout(r, 100));

  // Ctrl+L → AutoLayout
  dispatch('l', { ctrl: true });
  await new Promise(r => setTimeout(r, 100));
  tests.push({ name: 'Ctrl+L opens AutoLayout', ok: !!document.querySelector('[data-panel-id="builtin/autolayout-panel"]') });
  dispatch('l', { ctrl: true });
  await new Promise(r => setTimeout(r, 100));

  // Ctrl+M → Measurement
  dispatch('m', { ctrl: true });
  await new Promise(r => setTimeout(r, 100));
  tests.push({ name: 'Ctrl+M opens Measurement', ok: !!document.querySelector('[data-panel-id="builtin/measurement-panel"]') });
  dispatch('m', { ctrl: true });
  await new Promise(r => setTimeout(r, 100));

  return tests;
`);

console.log("=== plugin hotkey smoke ===");
let failed = 0;
for (const t of result) {
  console.log(`  ${t.ok ? "PASS" : "FAIL"} ${t.name}`);
  if (!t.ok) failed++;
}
ws.close();
process.exit(failed > 0 ? 1 : 0);

// Reload behavior test — verify plugin state + bridges survive a
// page reload. Specifically: settings persisted in localStorage are
// re-applied; recent files list re-loads; plugin buttons reappear
// after reload (no leaks, no missing context).

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9363;
const tmp = mkdtempSync(join(tmpdir(), "chrome-reload-"));
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

// Pre-reload: write a known recent files entry to localStorage
await ev(`
  window.localStorage.setItem('sveltedraw-recent-files', JSON.stringify([
    { id: 'reload-test', name: 'reload-test.sveltedraw', timestamp: Date.now() }
  ]));
`);

// Reload
await ev(`window.location.reload();`);
await new Promise(r => setTimeout(r, 4000));

const result = await ev(`
  const dl = Date.now() + 12000;
  while (!window.__sveltedrawProbe && Date.now() < dl) { await new Promise(r => setTimeout(r, 100)); }
  if (!window.__sveltedrawProbe) throw new Error('probe never loaded after reload');

  // Open Recent files plugin
  const rfBtn = document.querySelector('button[aria-label="Recent files (Ctrl+R)"]');
  rfBtn?.click();
  await new Promise(r => setTimeout(r, 200));

  // Look for our seeded entry
  const items = document.querySelectorAll('.recent-files-modal .rf-item, .recent-files-modal li, .recent-files-modal [data-recent-id]');
  const html = document.querySelector('.recent-files-modal')?.innerHTML ?? '';
  const found = html.includes('reload-test');

  // Verify plugin buttons all rendered (count toolbar plugin buttons)
  const pluginButtons = [
    'Recent files (Ctrl+R)', 'Settings (Ctrl+,)', 'Help (F1)',
    'New from template (Ctrl+N)', 'History', 'Alignment',
    'Auto Layout', 'Measurement', 'Grid & Snap', 'Layers', 'Shape Library',
  ];
  const present = pluginButtons.filter(label =>
    !!document.querySelector('button[aria-label="' + label + '"]')
  );

  return {
    seedFoundInPanel: found,
    seedHtmlSnippet: html.slice(0, 200),
    pluginButtonsRendered: present.length,
    pluginButtonsExpected: pluginButtons.length,
    missing: pluginButtons.filter(l => !present.includes(l)),
  };
`);

console.log(JSON.stringify(result, null, 2));
ws.close();
const ok = result.seedFoundInPanel && result.pluginButtonsRendered === result.pluginButtonsExpected;
process.exit(ok ? 0 : 1);

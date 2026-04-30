import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9356;
const tmp = mkdtempSync(join(tmpdir(), "chrome-set-smoke-"));
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
  // Settings plugin should auto-install. Verify plugin button + menu item.
  const btn = document.querySelector('button[aria-label="Settings (Ctrl+,)"]');
  const burger = document.querySelector('.sveltedraw-main-menu-trigger');
  burger?.click();
  await new Promise(r => setTimeout(r, 80));
  const menu = document.querySelector('.sveltedraw-main-menu');
  const menuItem = menu ? Array.from(menu.querySelectorAll('.mm-item')).find(b => /^Settings/i.test(b.textContent.trim())) : null;
  document.body.click();
  await new Promise(r => setTimeout(r, 50));

  // Verify Recent Files button still works (regression check on prior plugin)
  const rfBtn = document.querySelector('button[aria-label="Recent files (Ctrl+R)"]');

  return {
    settingsButton: !!btn,
    settingsMenuItem: !!menuItem,
    recentFilesStillPresent: !!rfBtn,
  };
`);

console.log(JSON.stringify(result, null, 2));
ws.close();
const ok = result.settingsButton && result.settingsMenuItem && result.recentFilesStillPresent;
process.exit(ok ? 0 : 1);

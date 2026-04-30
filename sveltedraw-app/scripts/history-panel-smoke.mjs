import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9357;
const tmp = mkdtempSync(join(tmpdir(), "chrome-hp-smoke-"));
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
  // History plugin should auto-install. Plugin button has title "History"
  // and renders in the "view" group of plugins (after built-in items).
  const btn = document.querySelector('button[aria-label="History"]');

  // Initially hidden
  const panel0 = document.querySelector('.sveltedraw-history-panel');

  // Click toggles it open
  btn?.click();
  await new Promise(r => setTimeout(r, 100));
  const panel1 = document.querySelector('.sveltedraw-history-panel');

  // Click again toggles it closed
  btn?.click();
  await new Promise(r => setTimeout(r, 100));
  const panel2 = document.querySelector('.sveltedraw-history-panel');

  return {
    button: !!btn,
    hiddenInitially: !panel0,
    openedAfterClick: !!panel1,
    closedAfterSecondClick: !panel2,
  };
`);

console.log(JSON.stringify(result, null, 2));
ws.close();
const ok = result.button && result.hiddenInitially && result.openedAfterClick && result.closedAfterSecondClick;
process.exit(ok ? 0 : 1);

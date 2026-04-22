// Visual test: draw arrow, screenshot, inspect DOM for handle dots.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3001/#app";
const CDP_PORT = 9336;
const tmp = mkdtempSync(join(tmpdir(), "chrome-visual-"));

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${tmp}`,
  "--no-first-run",
  "--disable-gpu",
  "--window-size=1280,900",
  APP_URL,
], { stdio: "ignore" });

const cleanup = () => { try { chrome.kill("SIGKILL"); } catch {} try { rmSync(tmp, { recursive: true, force: true }); } catch {} };
process.on("exit", cleanup);

async function waitForDT(port, t = 6000) {
  const d = Date.now() + t;
  while (Date.now() < d) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("DT timeout");
}

async function main() {
  await waitForDT(CDP_PORT);
  const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
  const tabs = await r.json();
  const page = tabs.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res) => ws.on("open", res));

  let id = 1;
  const pending = new Map();
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(m.error) : resolve(m.result); }
  });
  const send = (method, params = {}) => { const i = id++; return new Promise((res, rej) => { pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); }); };

  await send("Runtime.enable");

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const r = await send("Runtime.evaluate", { expression: "typeof window.__sveltedrawProbe !== 'undefined'", returnByValue: true });
    if (r.result?.value) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  // Draw arrow + screenshot.
  await send("Runtime.evaluate", {
    expression: `
      (async () => {
        const p = window.__sveltedrawProbe;
        p.scene.replaceAllElements([], { skipValidation: true });
        p.appState.selectedElementIds = {};
        const container = document.querySelector('.excalidraw-container');
        const iv = document.querySelectorAll('canvas')[1];
        container.focus();
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 50));
        const rect = iv.getBoundingClientRect();
        const mk = (type, x, y) => new PointerEvent(type, { clientX: x, clientY: y, button: 0, pointerId: 1, pointerType: 'mouse', bubbles: true, cancelable: true });
        iv.dispatchEvent(mk('pointerdown', rect.left + 300, rect.top + 300));
        await new Promise(r => setTimeout(r, 30));
        iv.dispatchEvent(mk('pointermove', rect.left + 700, rect.top + 450));
        await new Promise(r => setTimeout(r, 30));
        iv.dispatchEvent(mk('pointerup', rect.left + 700, rect.top + 450));
        await new Promise(r => setTimeout(r, 150));
        return true;
      })()
    `,
    awaitPromise: true, returnByValue: true,
  });

  // Take screenshot.
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const path = join(process.cwd(), "scripts", "cdp-screenshots", "arrow-selected.png");
  writeFileSync(path, Buffer.from(shot.data, "base64"));
  console.log("screenshot:", path);

  // Inspect DOM for handles.
  const dom = await send("Runtime.evaluate", {
    expression: `
      JSON.stringify({
        vertexDots: document.querySelectorAll('.sveltedraw-line-handle--vertex').length,
        midDots: document.querySelectorAll('.sveltedraw-line-handle--mid').length,
        activeTool: window.__sveltedrawProbe.appState.activeTool.type,
        selected: Object.keys(window.__sveltedrawProbe.appState.selectedElementIds),
        elCount: window.__sveltedrawProbe.scene.getNonDeletedElements().length,
      }, null, 2)
    `,
    returnByValue: true,
  });
  console.log("DOM state:", dom.result.value);
  ws.close();
  cleanup();
}
main().catch((e) => { console.error(e); cleanup(); process.exit(1); });

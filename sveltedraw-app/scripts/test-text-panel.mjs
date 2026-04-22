// Verify text panel shows fontSize + fontFamily + text align rows
// when a text element is selected, and apply ops work.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3001/#app";
const CDP_PORT = 9337;
const tmp = mkdtempSync(join(tmpdir(), "chrome-text-"));

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${tmp}`,
  "--no-first-run", "--disable-gpu", "--window-size=1280,900", APP_URL,
], { stdio: "ignore" });
const cleanup = () => { try { chrome.kill("SIGKILL"); } catch {} try { rmSync(tmp, { recursive: true, force: true }); } catch {} };
process.on("exit", cleanup);

async function waitForDT(port, t = 6000) {
  const d = Date.now() + t;
  while (Date.now() < d) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch {}
    await new Promise(r => setTimeout(r, 150));
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
    await new Promise(r => setTimeout(r, 200));
  }

  const result = await send("Runtime.evaluate", {
    expression: `
      (async () => {
        const p = window.__sveltedrawProbe;
        p.scene.replaceAllElements([], { skipValidation: true });
        p.appState.selectedElementIds = {};
        const container = document.querySelector('.excalidraw-container');
        const iv = document.querySelectorAll('canvas')[1];
        container.focus();

        // Press "t" → text tool.
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 50));

        // Click to open text editor.
        const rect = iv.getBoundingClientRect();
        const x = rect.left + 400, y = rect.top + 300;
        const mk = (type, x, y) => new PointerEvent(type, { clientX: x, clientY: y, button: 0, pointerId: 1, pointerType: 'mouse', bubbles: true, cancelable: true });
        iv.dispatchEvent(mk('pointerdown', x, y));
        iv.dispatchEvent(mk('pointerup', x, y));
        await new Promise(r => setTimeout(r, 100));

        // Type text via textarea.
        const ta = document.querySelector('.sveltedraw-text-editor');
        if (!ta) return { err: 'no textarea' };
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, 'hello world');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 100));

        // The commit auto-switches to selection AND auto-selects the text.
        const textEl = p.scene.getNonDeletedElements().find(el => el.type === 'text');
        if (!textEl) return { err: 'no text element' };
        p.appState.selectedElementIds = { [textEl.id]: true };
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise(r => setTimeout(r, 60));

        // Probe panel rows.
        const panel = document.querySelector('.sveltedraw-style-panel');
        const rows = panel ? Array.from(panel.querySelectorAll('.sp-row')).map(r => r.querySelector('.sp-label')?.textContent?.trim()) : [];
        const fontSizeBtn = document.querySelector('.sveltedraw-style-panel [data-preset="fontSize"][data-value="28"]');
        const fontFamilyPicker = panel?.querySelector('.sp-font-picker');

        const beforeFontSize = textEl.fontSize;
        // Click Large size button.
        if (fontSizeBtn) fontSizeBtn.click();
        await new Promise(r => setTimeout(r, 50));
        const afterText = p.scene.getNonDeletedElements().find(el => el.id === textEl.id);

        return {
          rows,
          hasFontSize: !!fontSizeBtn,
          hasFontFamily: !!fontFamilyPicker,
          beforeFontSize,
          afterFontSize: afterText?.fontSize,
          changed: afterText?.fontSize === 28,
        };
      })()
    `,
    awaitPromise: true, returnByValue: true,
  });
  console.log("Text panel:", JSON.stringify(result.result.value, null, 2));

  // Screenshot with text selected.
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const path = join(process.cwd(), "scripts", "cdp-screenshots", "text-panel.png");
  writeFileSync(path, Buffer.from(shot.data, "base64"));
  console.log("screenshot:", path);
  ws.close();
  cleanup();
}
main().catch((e) => { console.error(e); cleanup(); process.exit(1); });

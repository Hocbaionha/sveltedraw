// Reproduce: select text, click "A" (font family trigger), verify
// FontPickerList popover opens.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3001/#app";
const CDP_PORT = 9338;
const tmp = mkdtempSync(join(tmpdir(), "chrome-font-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${tmp}`, "--no-first-run", "--disable-gpu", "--window-size=1280,900", APP_URL], { stdio: "ignore" });
const cleanup = () => { try { chrome.kill("SIGKILL"); } catch {} try { rmSync(tmp, { recursive: true, force: true }); } catch {} };
process.on("exit", cleanup);

async function waitForDT(port) {
  const d = Date.now() + 8000;
  while (Date.now() < d) { try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch {} await new Promise(r => setTimeout(r, 150)); }
  throw new Error("DT");
}

async function main() {
  await waitForDT(CDP_PORT);
  const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
  const tabs = await r.json();
  const page = tabs.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.on("open", r));
  let id = 1;
  const pending = new Map();
  ws.on("message", (raw) => { const m = JSON.parse(raw); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(m.error) : resolve(m.result); } });
  const send = (method, params = {}) => { const i = id++; return new Promise((res, rej) => { pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); }); };

  await send("Runtime.enable");
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const r = await send("Runtime.evaluate", { expression: "typeof window.__sveltedrawProbe !== 'undefined'", returnByValue: true });
    if (r.result?.value) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  const result = await send("Runtime.evaluate", {
    expression: `
      (async () => {
        const p = window.__sveltedrawProbe;
        p.scene.replaceAllElements([], { skipValidation: true });
        p.appState.selectedElementIds = {};

        // Create a text element directly via scene.
        const textEl = {
          id: 'txt-1', type: 'text', x: 400, y: 300,
          width: 100, height: 24, text: 'hello',
          originalText: 'hello', fontSize: 20, fontFamily: 5,
          textAlign: 'left', verticalAlign: 'top',
          strokeColor: '#1e1e1e', backgroundColor: 'transparent',
          fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid',
          roughness: 1, opacity: 100,
          seed: 1, version: 1, versionNonce: 1,
          index: null, isDeleted: false, boundElements: null,
          updated: Date.now(), link: null, locked: false,
          groupIds: [], frameId: null, roundness: null,
          angle: 0, customData: undefined, containerId: null,
          lineHeight: 1.2, baseline: 18, autoResize: true,
        };
        p.scene.replaceAllElements([textEl], { skipValidation: true });
        p.appState.selectedElementIds = { [textEl.id]: true };
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise(r => setTimeout(r, 100));

        const panel = document.querySelector('.sveltedraw-style-panel');
        const fontPicker = panel?.querySelector('.sp-font-picker');
        const triggerBtn = panel?.querySelector('[data-openpopup="fontFamily"]');
        const actualTrigger = triggerBtn?.querySelector('button') || triggerBtn;
        const log = ['panel=' + !!panel, 'fontPicker=' + !!fontPicker, 'trigger=' + !!triggerBtn, 'actualTrigger=' + !!actualTrigger];
        if (actualTrigger) {
          log.push('clicking button...');
          // Try dispatchEvent MouseEvent bubbling (Svelte 5 event delegation
          // sometimes needs this vs plain .click()).
          actualTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          await new Promise(r => setTimeout(r, 300));
        }
        // Also try clicking the wrapper div (bits-ui trigger).
        const wrapper = document.querySelector('[data-openpopup="fontFamily"]');
        log.push('wrapper=' + !!wrapper);
        if (wrapper && !document.querySelector('.ScrollableList__wrapper')) {
          log.push('trying wrapper click...');
          wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          await new Promise(r => setTimeout(r, 300));
        }
        const popup = document.querySelector('.FontPicker__container') ||
                      document.querySelector('[role="dialog"]') ||
                      document.querySelector('.properties-content');
        log.push('popup=' + !!popup);
        const listItems = document.querySelectorAll('.dropdown-menu-item');
        log.push('listItems=' + listItems.length);
        const allMenus = document.querySelectorAll('.ScrollableList__wrapper, .dropdown-menu, .properties-content, [data-bits-popover-content]');
        log.push('menuContainers=' + allMenus.length);
        for (let i = 0; i < allMenus.length; i++) {
          const m = allMenus[i];
          log.push('  menu[' + i + ']: class=' + m.className.slice(0, 60) + ' childCount=' + m.childElementCount);
        }
        const btns = document.querySelectorAll('button');
        log.push('totalButtons=' + btns.length);
        // Find any buttons whose textContent contains font names
        const fontBtns = [...btns].filter(b => /Virgil|Helvetica|Cascadia|Nunito|Excalifont|Assistant|Liberation|Comic|Lilita/i.test(b.textContent));
        log.push('fontBtns=' + fontBtns.length);
        for (const b of fontBtns.slice(0, 5)) log.push('  fontBtn: ' + b.textContent.trim().slice(0, 40) + ' class=' + b.className.slice(0, 50));

        // Inspect panel's font picker state
        log.push('popoverRoot=' + !!document.querySelector('[data-popover-root]'));
        const emptyTexts = document.querySelectorAll('.empty');
        log.push('emptyMsgs=' + emptyTexts.length);
        return { log };
      })()
    `,
    awaitPromise: true, returnByValue: true,
  });
  console.log(result.result.value);

  // Take screenshot WHILE popover is still open.
  const shotOpen = await send("Page.captureScreenshot", { format: "png" });
  const absDir2 = "C:/Users/phank/workspace-win/sveltedraw/sveltedraw-app/scripts/cdp-screenshots";
  writeFileSync(absDir2 + "/font-picker-while-open.png", Buffer.from(shotOpen.data, "base64"));
  console.log("screenshot while open:", absDir2 + "/font-picker-while-open.png");

  // Select Lilita One via probe, wait for fonts to load, screenshot.
  await send("Runtime.evaluate", {
    expression: `
      (async () => {
        const p = window.__sveltedrawProbe;
        // Swap to Lilita One (fontFamily = 7).
        const el = p.scene.getNonDeletedElements()[0];
        p.scene.mutateElement(el, { fontFamily: 7 }, { informMutation: false });
        // Give fonts 2 seconds to download + load.
        await new Promise(r => setTimeout(r, 2500));
        // Force a repaint via bumpSceneRepaint (window.__sveltedrawInteractiveTicks)
        // Not exposed directly — use Fonts.loadElementsFonts workaround.
        return true;
      })()
    `,
    awaitPromise: true, returnByValue: true,
  });
  const shotAfter = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(absDir2 + "/font-after-lilita.png", Buffer.from(shotAfter.data, "base64"));
  console.log("screenshot after font change:", absDir2 + "/font-after-lilita.png");

  // Inspect content of first font item + try clicking a real font.
  const r2 = await send("Runtime.evaluate", {
    expression: `
      (async () => {
        const p = window.__sveltedrawProbe;
        const items = [...document.querySelectorAll('.dropdown-menu-item')];
        const info = items.map(btn => ({
          text: btn.textContent.trim(),
          outerHTML: btn.outerHTML.slice(0, 300),
          value: btn.value,
        }));
        // Click the first non-selected item.
        const virgil = items.find(b => /Virgil/i.test(b.textContent));
        const before = p.scene.getNonDeletedElements()[0].fontFamily;
        if (virgil) {
          virgil.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          await new Promise(r => setTimeout(r, 150));
        }
        const after = p.scene.getNonDeletedElements()[0].fontFamily;
        return { info, before, after, changed: before !== after };
      })()
    `,
    awaitPromise: true, returnByValue: true,
  });
  console.log('\n=== Items detail ===');
  const val = r2.result.value;
  for (const item of val.info.slice(0, 3)) {
    console.log('text:', JSON.stringify(item.text));
    console.log('value:', item.value);
    console.log('html:', item.outerHTML);
    console.log('---');
  }
  console.log('\n=== Click Virgil ===');
  console.log('before fontFamily:', val.before, '→ after:', val.after, 'changed:', val.changed);

  const shot = await send("Page.captureScreenshot", { format: "png" });
  const absDir = "C:/Users/phank/workspace-win/sveltedraw/sveltedraw-app/scripts/cdp-screenshots";
  const path = absDir + "/font-picker-open.png";
  writeFileSync(path, Buffer.from(shot.data, "base64"));
  console.log("screenshot:", path);
  ws.close();
  cleanup();
}
main().catch((e) => { console.error(e); cleanup(); process.exit(1); });

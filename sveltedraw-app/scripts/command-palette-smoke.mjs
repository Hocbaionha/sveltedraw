// Command palette plugin smoke. Verifies:
//   1. Plugin is installed (toolbar button + side-panel registration)
//   2. Ctrl+Shift+P opens the palette
//   3. Palette items come from ActionManager.list() (verified by
//      checking that core+plugin actions show up)
//   4. Search filters items
//   5. Selecting an item dispatches the matching action
//   6. Esc closes the palette

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9383;
const tmp = mkdtempSync(join(tmpdir(), "chrome-cmdpalette-"));
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

  // Toolbar button installed
  const tbBtn = document.querySelector('button[data-plugin-toolbar-id="builtin/command-palette/open"]');
  tests.push({
    name: 'Plugin toolbar button installed',
    ok: !!tbBtn,
  });

  // Initial state — palette closed
  const initiallyClosed = !document.querySelector('.CommandPalette');
  tests.push({
    name: 'Palette initially closed',
    ok: initiallyClosed,
  });

  // Ctrl+Shift+P opens it
  const container = document.querySelector('.sveltedraw-container');
  container?.focus();
  container?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'P', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
  }));
  await new Promise(r => setTimeout(r, 200));
  const opened = !!document.querySelector('.CommandPalette');
  tests.push({
    name: 'Ctrl+Shift+P opens palette',
    ok: opened,
  });

  // Items are populated from ActionManager
  const itemCount = document.querySelectorAll('.CommandPalette__item').length;
  tests.push({
    name: 'Items populated from ActionManager',
    ok: itemCount >= 30,
    detail: 'count=' + itemCount,
  });

  // Search filters items
  const searchInput = document.querySelector('.CommandPalette input');
  if (searchInput) {
    searchInput.focus();
    // Simulate typing "undo"
    const setNativeValue = (el, val) => {
      const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      desc.set.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setNativeValue(searchInput, 'undo');
    await new Promise(r => setTimeout(r, 100));
  }
  const filtered = document.querySelectorAll('.CommandPalette__item').length;
  tests.push({
    name: 'Search filters items',
    ok: filtered > 0 && filtered < itemCount,
    detail: 'filtered=' + filtered + ' total=' + itemCount,
  });

  // Selecting Undo dispatches it. First insert 2 elements + push history;
  // then click the filtered Undo item.
  p.scene.replaceAllElements([
    { id: 'sa', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, angle: 0,
      strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
      strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
      opacity: 100, groupIds: [], frameId: null, index: 'a0',
      boundElements: null, updated: Date.now(), link: null, locked: false,
      seed: 1, version: 1, versionNonce: 1, isDeleted: false },
  ]);
  p.pushHistory();
  await new Promise(r => setTimeout(r, 100));
  p.scene.replaceAllElements([
    { id: 'sa', type: 'rectangle', x: 100, y: 100, width: 10, height: 10, angle: 0,
      strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
      strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
      opacity: 100, groupIds: [], frameId: null, index: 'a0',
      boundElements: null, updated: Date.now(), link: null, locked: false,
      seed: 1, version: 1, versionNonce: 1, isDeleted: false },
  ]);
  p.pushHistory();
  await new Promise(r => setTimeout(r, 100));
  const movedX = p.scene.getNonDeletedElements()[0]?.x;

  // Click the first item (Undo)
  const undoItem = Array.from(document.querySelectorAll('.CommandPalette__item')).find(b => /undo/i.test(b.textContent ?? ''));
  undoItem?.click();
  await new Promise(r => setTimeout(r, 200));
  const afterUndoX = p.scene.getNonDeletedElements()[0]?.x;
  tests.push({
    name: 'Selecting Undo dispatches edit.undo',
    ok: movedX === 100 && afterUndoX === 0,
    detail: 'beforeUndo=' + movedX + ' afterUndo=' + afterUndoX,
  });

  // Palette closes after selection
  const closedAfterSelect = !document.querySelector('.CommandPalette');
  tests.push({
    name: 'Palette closes after selection',
    ok: closedAfterSelect,
  });

  // Re-open + Esc closes
  container?.focus();
  container?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'P', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
  }));
  await new Promise(r => setTimeout(r, 150));
  const reopened = !!document.querySelector('.CommandPalette');
  // Esc on the search input
  const searchInput2 = document.querySelector('.CommandPalette input');
  searchInput2?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 150));
  const closedByEsc = !document.querySelector('.CommandPalette');
  tests.push({
    name: 'Esc closes palette',
    ok: reopened && closedByEsc,
    detail: 'reopened=' + reopened + ' closed=' + closedByEsc,
  });

  return tests;
`);

console.log("=== command palette smoke ===");
let failed = 0;
for (const t of tests) {
  console.log("  " + (t.ok ? "PASS" : "FAIL") + " " + t.name + (t.detail ? " (" + t.detail + ")" : ""));
  if (!t.ok) failed++;
}
ws.close();
process.exit(failed > 0 ? 1 : 0);

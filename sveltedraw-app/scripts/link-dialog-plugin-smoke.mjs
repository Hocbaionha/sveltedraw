// Link-dialog plugin smoke. Verifies:
//   1. probe.openLinkDialog opens via plugin store (no inline App state)
//   2. Dialog renders into the dialog-layer chrome slot
//   3. probe.confirmLinkDialog writes element.link via the bridge
//   4. probe.closeLinkDialog clears state
//   5. Element delete auto-closes the dialog (onElementChange hook)

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9390;
const tmp = mkdtempSync(join(tmpdir(), "chrome-linkdlg-"));
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
  const ELEM_ID = "link-test-" + Date.now().toString(36);

  // Insert one element + select it.
  p.scene.replaceAllElements([{
    id: ELEM_ID, type: 'rectangle', x: 30, y: 40, width: 50, height: 60, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: 'a0',
    boundElements: null, updated: Date.now(), link: null, locked: false,
    seed: 1, version: 1, versionNonce: 1, isDeleted: false,
  }]);
  p.appState.selectedElementIds = { [ELEM_ID]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 100));

  // ── 1. open
  p.openLinkDialog();
  await new Promise(r => setTimeout(r, 150));
  const opened = p.isLinkDialogOpen();
  const overlayMounted = !!document.querySelector('.sveltedraw-link-overlay');
  tests.push({
    name: 'openLinkDialog opens via plugin store',
    ok: opened === true && overlayMounted,
    detail: 'isOpen=' + opened + ' overlayMounted=' + overlayMounted,
  });

  // ── 2. confirm sets link
  p.confirmLinkDialog("https://sveltedraw.dev/test");
  await new Promise(r => setTimeout(r, 100));
  const updated = p.scene.getNonDeletedElements().find(e => e.id === ELEM_ID);
  tests.push({
    name: 'confirmLinkDialog writes element.link',
    ok: updated?.link === "https://sveltedraw.dev/test",
    detail: 'link=' + (updated?.link ?? 'null'),
  });

  // ── 3. dialog auto-closes after confirm
  const closedAfter = p.isLinkDialogOpen();
  tests.push({
    name: 'dialog auto-closes after confirm',
    ok: closedAfter === false,
  });

  // ── 4. re-open + explicit close
  p.openLinkDialog();
  await new Promise(r => setTimeout(r, 100));
  p.closeLinkDialog();
  await new Promise(r => setTimeout(r, 100));
  tests.push({
    name: 'closeLinkDialog clears state',
    ok: p.isLinkDialogOpen() === false,
  });

  // ── 5. auto-close when target element is deleted (onElementChange hook)
  p.openLinkDialog();
  await new Promise(r => setTimeout(r, 100));
  if (!p.isLinkDialogOpen()) {
    tests.push({ name: 'reopen for delete-test', ok: false });
    return tests;
  }
  // Soft-delete the element via mutation.
  p.scene.replaceAllElements([]);
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 150));
  tests.push({
    name: 'dialog auto-closes when target element is removed',
    ok: p.isLinkDialogOpen() === false,
    detail: 'isOpen after delete=' + p.isLinkDialogOpen(),
  });

  return tests;
`);

console.log("=== link-dialog plugin smoke ===");
let failed = 0;
for (const t of tests) {
  console.log("  " + (t.ok ? "PASS" : "FAIL") + " " + t.name + (t.detail ? " (" + t.detail + ")" : ""));
  if (!t.ok) failed++;
}
ws.close();
process.exit(failed > 0 ? 1 : 0);

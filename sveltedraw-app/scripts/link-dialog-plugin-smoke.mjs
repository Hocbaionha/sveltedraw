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
    name: 'dialog auto-closes when target element is removed (replaceAll path)',
    ok: p.isLinkDialogOpen() === false,
    detail: 'isOpen after delete=' + p.isLinkDialogOpen(),
  });

  // ── 6. auto-close when target is in-place soft-deleted
  // Regression coverage for Wave A pass-1 #2: bumpSceneRepaint used
  // ref-equality before, so el.isDeleted=true on an existing ref
  // never fired onElementChange → dialog stayed open over a
  // tombstoned element.
  const ELEM2 = "link-test-soft-" + Date.now().toString(36);
  p.scene.replaceAllElements([{
    id: ELEM2, type: 'rectangle', x: 100, y: 200, width: 50, height: 60, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: 'a1',
    boundElements: null, updated: Date.now(), link: null, locked: false,
    seed: 2, version: 1, versionNonce: 1, isDeleted: false,
  }]);
  p.appState.selectedElementIds = { [ELEM2]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 100));
  p.openLinkDialog();
  await new Promise(r => setTimeout(r, 100));
  const openedSoft = p.isLinkDialogOpen();
  // In-place mutate isDeleted on the SAME ref (don't replaceAll).
  const liveEl = p.scene.getElement(ELEM2);
  if (liveEl) {
    liveEl.isDeleted = true;
    liveEl.version = (liveEl.version || 1) + 1;
    liveEl.versionNonce = (liveEl.versionNonce || 1) + 7919;
  }
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 100));
  tests.push({
    name: 'dialog auto-closes on in-place soft-delete (fingerprint diff)',
    ok: openedSoft === true && p.isLinkDialogOpen() === false,
    detail: 'openedBefore=' + openedSoft + ' openAfter=' + p.isLinkDialogOpen(),
  });

  // ── 7. open() refuses an already-soft-deleted element
  // Regression coverage for Wave A pass-1 #5: the open() gate now
  // checks bridge.isAlive before flipping state.open.
  const ELEM3 = "link-test-dead-" + Date.now().toString(36);
  p.scene.replaceAllElements([{
    id: ELEM3, type: 'rectangle', x: 0, y: 0, width: 50, height: 50, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: 'a2',
    boundElements: null, updated: Date.now(), link: null, locked: true,
    seed: 3, version: 1, versionNonce: 1, isDeleted: true,
  }]);
  p.appState.selectedElementIds = { [ELEM3]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 80));
  p.openLinkDialog();
  await new Promise(r => setTimeout(r, 80));
  tests.push({
    name: 'openLinkDialog() refuses a soft-deleted element',
    ok: p.isLinkDialogOpen() === false,
  });

  // ── 8. originalLink is captured at open time (not the live value)
  // Regression coverage for Wave A pass-1 #4/#10: the dialog's
  // originalLink prop must be a snapshot of the link at open, not a
  // re-read of bridge.getLink.
  const ELEM4 = "link-test-orig-" + Date.now().toString(36);
  p.scene.replaceAllElements([{
    id: ELEM4, type: 'rectangle', x: 0, y: 0, width: 50, height: 50, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: 'a3',
    boundElements: null, updated: Date.now(), link: 'https://before.example', locked: false,
    seed: 4, version: 1, versionNonce: 1, isDeleted: false,
  }]);
  p.appState.selectedElementIds = { [ELEM4]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 80));
  p.openLinkDialog();
  await new Promise(r => setTimeout(r, 80));
  // Mutate the live link OUTSIDE the dialog (simulates a collab
  // teammate or undo replaying a different link mid-edit).
  const liveEl4 = p.scene.getElement(ELEM4);
  if (liveEl4) {
    p.scene.mutateElement(liveEl4, { link: 'https://midstream.example' },
      { informMutation: false, isDragging: false });
    p.bumpSceneRepaint();
  }
  await new Promise(r => setTimeout(r, 80));
  // The dialog binds originalLink from state.originalLink (a
  // snapshot taken on open) so an external mutation should not close
  // the dialog — only a delete (current=null or isDeleted=true)
  // does. This test asserts the dialog stays open through the
  // mutation; the originalLink value itself is exercised by the
  // unit tests around captureOriginalLinkOnOpen.
  tests.push({
    name: 'dialog stays open under external link mutation',
    ok: p.isLinkDialogOpen() === true,
  });
  p.closeLinkDialog();

  // ── 9. confirmLinkDialog with same value is a no-op (no history push)
  // Regression coverage for Wave A pass-2 #12: setLink early-returns
  // when current === normalized so confirming an unchanged link
  // doesn't push a useless undo step.
  const ELEM5 = "link-test-noop-" + Date.now().toString(36);
  p.scene.replaceAllElements([{
    id: ELEM5, type: 'rectangle', x: 0, y: 0, width: 50, height: 50, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: 'a4',
    boundElements: null, updated: Date.now(), link: 'https://same.example', locked: false,
    seed: 5, version: 1, versionNonce: 1, isDeleted: false,
  }]);
  p.appState.selectedElementIds = { [ELEM5]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 80));
  const histLenBefore = window.__sveltedrawHistoryLen();
  p.openLinkDialog();
  await new Promise(r => setTimeout(r, 80));
  p.confirmLinkDialog('https://same.example');
  await new Promise(r => setTimeout(r, 80));
  const histLenAfter = window.__sveltedrawHistoryLen();
  tests.push({
    name: 'confirming unchanged link does not push history',
    ok: histLenAfter === histLenBefore,
    detail: 'before=' + histLenBefore + ' after=' + histLenAfter,
  });

  // ── 10. confirmLinkDialog with "" normalizes to null
  // Regression coverage for Wave A pass-2 #13: setLink normalizes ""
  // to null so cleared links don't persist a useless empty string.
  const ELEM6 = "link-test-empty-" + Date.now().toString(36);
  p.scene.replaceAllElements([{
    id: ELEM6, type: 'rectangle', x: 0, y: 0, width: 50, height: 50, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: 'a5',
    boundElements: null, updated: Date.now(), link: 'https://about-to-clear.example', locked: false,
    seed: 6, version: 1, versionNonce: 1, isDeleted: false,
  }]);
  p.appState.selectedElementIds = { [ELEM6]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 80));
  p.openLinkDialog();
  await new Promise(r => setTimeout(r, 80));
  p.confirmLinkDialog('');
  await new Promise(r => setTimeout(r, 80));
  const liveEl6 = p.scene.getElement(ELEM6);
  tests.push({
    name: 'confirmLinkDialog("") normalizes to null',
    ok: liveEl6 && liveEl6.link === null,
    detail: 'final link=' + JSON.stringify(liveEl6?.link),
  });

  // ── 11. confirmLinkDialog("   ") normalizes to null
  // Regression coverage for pass-5 I6: whitespace-only input is
  // treated as an empty link.
  const ELEM7 = "link-test-ws-" + Date.now().toString(36);
  p.scene.replaceAllElements([{
    id: ELEM7, type: 'rectangle', x: 0, y: 0, width: 50, height: 50, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: 'a6',
    boundElements: null, updated: Date.now(), link: 'https://before-ws.example', locked: false,
    seed: 7, version: 1, versionNonce: 1, isDeleted: false,
  }]);
  p.appState.selectedElementIds = { [ELEM7]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 80));
  p.openLinkDialog();
  await new Promise(r => setTimeout(r, 80));
  p.confirmLinkDialog('   ');
  await new Promise(r => setTimeout(r, 80));
  const liveEl7 = p.scene.getElement(ELEM7);
  tests.push({
    name: 'confirmLinkDialog("   ") normalizes whitespace-only to null',
    ok: liveEl7 && liveEl7.link === null,
    detail: 'final link=' + JSON.stringify(liveEl7?.link),
  });

  // ── 12. openLinkDialog with selection size != 1 is a no-op
  // Regression coverage for pass-1 #5 (open() gate).
  const ELEM8a = "link-multi-a-" + Date.now().toString(36);
  const ELEM8b = "link-multi-b-" + Date.now().toString(36);
  p.scene.replaceAllElements([
    {
      id: ELEM8a, type: 'rectangle', x: 0, y: 0, width: 50, height: 50, angle: 0,
      strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
      strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
      opacity: 100, groupIds: [], frameId: null, index: 'a7',
      boundElements: null, updated: Date.now(), link: null, locked: false,
      seed: 8, version: 1, versionNonce: 1, isDeleted: false,
    },
    {
      id: ELEM8b, type: 'rectangle', x: 100, y: 100, width: 50, height: 50, angle: 0,
      strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
      strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
      opacity: 100, groupIds: [], frameId: null, index: 'a8',
      boundElements: null, updated: Date.now(), link: null, locked: false,
      seed: 9, version: 1, versionNonce: 1, isDeleted: false,
    },
  ]);
  p.appState.selectedElementIds = { [ELEM8a]: true, [ELEM8b]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 80));
  p.openLinkDialog();
  await new Promise(r => setTimeout(r, 80));
  tests.push({
    name: 'openLinkDialog no-ops with multi-selection',
    ok: p.isLinkDialogOpen() === false,
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

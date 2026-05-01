// Group plugin smoke. Verifies:
//   1. arrange.group adds a fresh groupId to selected elements
//   2. arrange.group is a no-op for size < 2 selections
//   3. arrange.ungroup pops the outermost groupId
//   4. arrange.ungroup is a no-op when no element has any groupId
//   5. nested grouping: group → group again → 2 entries deep

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const APP_URL = "http://localhost:3001/#app";
const CDP_PORT = 9392;
const tmp = mkdtempSync(join(tmpdir(), "chrome-group-"));
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
  const am = p.getActionManager();

  const A = "g-a-" + Date.now().toString(36);
  const B = "g-b-" + Date.now().toString(36);
  const mk = (id, idx) => ({
    id, type: 'rectangle', x: 0, y: 0, width: 50, height: 50, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roundness: null, roughness: 0,
    opacity: 100, groupIds: [], frameId: null, index: idx,
    boundElements: null, updated: Date.now(), link: null, locked: false,
    seed: 1, version: 1, versionNonce: 1, isDeleted: false,
  });
  p.scene.replaceAllElements([mk(A, 'a0'), mk(B, 'a1')]);
  p.appState.selectedElementIds = { [A]: true, [B]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 80));

  // ── 1. group via the ActionManager
  am.execute("arrange.group");
  await new Promise(r => setTimeout(r, 80));
  const elsAfterGroup = p.scene.getElementsIncludingDeleted();
  const groupIdsA = elsAfterGroup.find(e => e.id === A).groupIds;
  const groupIdsB = elsAfterGroup.find(e => e.id === B).groupIds;
  tests.push({
    name: 'group adds a fresh shared groupId to all selected elements',
    ok: groupIdsA.length === 1 && groupIdsB.length === 1 && groupIdsA[0] === groupIdsB[0] && groupIdsA[0].length > 0,
    detail: 'A=' + JSON.stringify(groupIdsA) + ' B=' + JSON.stringify(groupIdsB),
  });

  // ── 2. group no-ops for size < 2 selection
  // Single-select A (already grouped to share with B — but the gate
  // is "selected.length < 2 → return"). Capture A's groupIds before
  // and after.
  p.appState.selectedElementIds = { [A]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 50));
  const beforeSingle = p.scene.getElement(A).groupIds.slice();
  am.execute("arrange.group");
  await new Promise(r => setTimeout(r, 80));
  const afterSingle = p.scene.getElement(A).groupIds.slice();
  tests.push({
    name: 'group no-ops for single-element selection',
    ok: beforeSingle.length === afterSingle.length && beforeSingle.every((v, i) => v === afterSingle[i]),
    detail: 'before=' + JSON.stringify(beforeSingle) + ' after=' + JSON.stringify(afterSingle),
  });

  // ── 3. ungroup pops outermost groupId. Restore multi-select.
  p.appState.selectedElementIds = { [A]: true, [B]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 50));
  const beforeUngroup = p.scene.getElement(A).groupIds.length;
  am.execute("arrange.ungroup");
  await new Promise(r => setTimeout(r, 80));
  const afterUngroup = p.scene.getElement(A).groupIds.length;
  tests.push({
    name: 'ungroup pops the outermost groupId',
    ok: afterUngroup === beforeUngroup - 1,
    detail: 'before=' + beforeUngroup + ' after=' + afterUngroup,
  });

  // ── 4. ungroup no-ops when no element has any groupId
  // After (3), A and B both should have groupIds.length === 0.
  const noGroupsAreEmpty = p.scene.getElement(A).groupIds.length === 0
    && p.scene.getElement(B).groupIds.length === 0;
  am.execute("arrange.ungroup");
  await new Promise(r => setTimeout(r, 80));
  // History entries shouldn't increase because nothing changed.
  // (We can't easily peek the history length here without the
  // probe — assert state is still all-empty groupIds, which is
  // sufficient evidence.)
  const stillEmpty = p.scene.getElement(A).groupIds.length === 0
    && p.scene.getElement(B).groupIds.length === 0;
  tests.push({
    name: 'ungroup no-ops when no element has groupIds',
    ok: noGroupsAreEmpty && stillEmpty,
  });

  // ── 5. nested grouping: group → group again → 2 entries deep
  am.execute("arrange.group");
  await new Promise(r => setTimeout(r, 80));
  am.execute("arrange.group");
  await new Promise(r => setTimeout(r, 80));
  const groupIdsA2 = p.scene.getElement(A).groupIds;
  const groupIdsB2 = p.scene.getElement(B).groupIds;
  tests.push({
    name: 'nested grouping appends — outer group is the most recent',
    ok: groupIdsA2.length === 2
      && groupIdsB2.length === 2
      && groupIdsA2[0] === groupIdsB2[0]
      && groupIdsA2[1] === groupIdsB2[1]
      && groupIdsA2[0] !== groupIdsA2[1],
    detail: 'A=' + JSON.stringify(groupIdsA2),
  });

  return tests;
`);

console.log("=== group plugin smoke ===");
let failed = 0;
for (const t of tests) {
  console.log("  " + (t.ok ? "PASS" : "FAIL") + " " + t.name + (t.detail ? " (" + t.detail + ")" : ""));
  if (!t.ok) failed++;
}
ws.close();
process.exit(failed > 0 ? 1 : 0);

// Regression test — style picked while a selection exists must persist to
// `currentItem*` so the next element drawn with a tool inherits that style.
//
// User-reported flow that was broken:
//   1. Select element A.
//   2. Click color-picker → backgroundColor becomes X on A.
//   3. Switch to rectangle tool (clears selection).
//   4. Draw element B.
//   Expected: B.backgroundColor === X. Was: B used the stale default.
//
// Root cause: `applyStyle` in App.svelte wrote to `appState.currentItem*`
// ONLY when selection was empty. With a selection present, it mutated the
// selected element and scheduled save, but left `currentItem*` untouched.
//
// Fix: write to `currentItem*` unconditionally, plus mutate selected (if
// any). This test drives that exact flow via the probe and asserts that
// `currentItemBackgroundColor` tracks the picked color even when a
// selection exists at call time.
//
// Run standalone:
//   APP_URL=http://localhost:3001/#app node sveltedraw-app/scripts/honest-tests/style-persists-to-next-drawn.mjs

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const CHROME =
  process.env.CHROME ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3001/#app";
const CDP_PORT = Number(process.env.CDP_PORT ?? 9343);
const SETUP_WAIT_MS = Number(process.env.SETUP_WAIT_MS ?? 2500);

const tmp = mkdtempSync(join(tmpdir(), "chrome-style-persist-"));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmp}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1280,900",
    APP_URL,
  ],
  { stdio: "ignore", detached: false },
);

const cleanup = () => {
  try { chrome.kill("SIGKILL"); } catch {}
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
};
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });

async function waitForDevtools(port, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("devtools never came up");
}
async function findPage(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  const tabs = await res.json();
  const page = tabs.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
  if (!page) throw new Error("no page target");
  return page.webSocketDebuggerUrl;
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { perMessageDeflate: false });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

const PAYLOAD = `(async () => {
 try {
  const deadline = Date.now() + ${SETUP_WAIT_MS};
  while (!window.__sveltedrawProbe && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 100));
  }
  const p = window.__sveltedrawProbe;
  if (!p) return { fatal: 'probe never exposed' };
  const scene = p.scene;
  const appState = p.appState;
  if (!scene || !appState) return { fatal: 'scene/appState missing on probe' };
  const applyStyle = p.applyStyle;
  if (!applyStyle) return { fatal: 'applyStyle missing on probe', probeKeys: Object.keys(p) };

  // Baseline: record initial currentItem* defaults.
  const before = {
    bg: appState.currentItemBackgroundColor,
    stroke: appState.currentItemStrokeColor,
    strokeWidth: appState.currentItemStrokeWidth,
  };

  // Seed a rectangle we can select.
  const RECT = {
    id: 'persist-test-seed',
    type: 'rectangle',
    x: 40, y: 40, width: 120, height: 100, angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: '#ffffff',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roundness: null,
    roughness: 0,
    opacity: 100,
    groupIds: [], frameId: null, index: 'a0',
    boundElements: null,
    updated: Date.now(),
    link: null, locked: false,
    seed: 12345,
    version: 1, versionNonce: 1,
    isDeleted: false,
  };
  scene.replaceAllElements([RECT]);

  // Select it — applyStyle must take the "has selection" branch.
  appState.selectedElementIds = { [RECT.id]: true };
  p.bumpSceneRepaint();
  await new Promise(r => setTimeout(r, 200));

  // Exercise applyStyle while selection exists. With the bug, currentItem*
  // stays at "before" values. With the fix, currentItem* tracks these.
  applyStyle({ backgroundColor: '#00ff88' });
  applyStyle({ strokeColor: '#ff0088' });
  applyStyle({ strokeWidth: 4 });
  await new Promise(r => setTimeout(r, 100));

  const afterWithSelection = {
    bg: appState.currentItemBackgroundColor,
    stroke: appState.currentItemStrokeColor,
    strokeWidth: appState.currentItemStrokeWidth,
    // Also confirm the element itself was mutated (the primary behavior
    // should NOT regress).
    elBg: scene.getNonDeletedElements()[0].backgroundColor,
    elStroke: scene.getNonDeletedElements()[0].strokeColor,
    elStrokeWidth: scene.getNonDeletedElements()[0].strokeWidth,
  };

  // Clear selection (simulates "switch to rectangle tool"). Then pick a
  // DIFFERENT style. currentItem* should still follow.
  appState.selectedElementIds = {};
  applyStyle({ backgroundColor: '#112233' });
  await new Promise(r => setTimeout(r, 100));

  const afterNoSelection = {
    bg: appState.currentItemBackgroundColor,
  };

  return {
    fatal: null,
    before,
    afterWithSelection,
    afterNoSelection,
    checks: {
      // With selection: currentItem* must update to the picked value.
      // This is the bug 0.6-A was added to catch.
      bgPersistedWithSelection:
        afterWithSelection.bg === '#00ff88',
      strokePersistedWithSelection:
        afterWithSelection.stroke === '#ff0088',
      strokeWidthPersistedWithSelection:
        afterWithSelection.strokeWidth === 4,
      // Sanity: the selected element was ALSO mutated (primary behavior).
      elementMutatedBg: afterWithSelection.elBg === '#00ff88',
      elementMutatedStroke: afterWithSelection.elStroke === '#ff0088',
      elementMutatedStrokeWidth: afterWithSelection.elStrokeWidth === 4,
      // No selection: the existing behavior must still work.
      bgPersistedWithoutSelection:
        afterNoSelection.bg === '#112233',
    },
  };
 } catch (err) {
   return { fatal: 'payload threw: ' + (err && err.message) + ' :: ' + (err && err.stack) };
 }
})()`;

async function main() {
  await waitForDevtools(CDP_PORT);
  const pageUrl = await findPage(CDP_PORT);
  const ws = await connect(pageUrl);

  let nextId = 1;
  const pending = new Map();
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, (m) => resolve(m.result));
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send("Runtime.enable");
  await send("Page.enable");

  await send("Runtime.evaluate", {
    expression: `(async () => {
      try { localStorage.removeItem('sveltedraw:scene:v1'); } catch {}
      try {
        await new Promise((resolve) => {
          const req = indexedDB.deleteDatabase('sveltedraw');
          req.onsuccess = req.onerror = req.onblocked = () => resolve();
        });
      } catch {}
    })()`,
    awaitPromise: true,
  });
  await send("Page.reload", { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 800));

  const result = await send("Runtime.evaluate", {
    expression: PAYLOAD,
    awaitPromise: true,
    returnByValue: true,
  });

  const report = result.result?.value;
  if (!report) {
    console.error("payload returned no value:", JSON.stringify(result));
    process.exit(2);
  }
  if (report.fatal) {
    console.error(`FATAL: ${report.fatal}`);
    if (report.probeKeys) console.error("probe keys:", report.probeKeys);
    process.exit(2);
  }
  if (!report.checks) {
    console.error("report missing .checks:", JSON.stringify(report));
    process.exit(2);
  }

  console.log("before:", JSON.stringify(report.before));
  console.log("afterWithSelection:", JSON.stringify(report.afterWithSelection));
  console.log("afterNoSelection:", JSON.stringify(report.afterNoSelection));
  console.log("");

  let failed = 0;
  for (const [name, passed] of Object.entries(report.checks)) {
    const tag = passed ? "[PASS]" : "[FAIL]";
    console.log(`${tag} ${name}`);
    if (!passed) failed++;
  }

  console.log("");
  const total = Object.keys(report.checks).length;
  if (failed > 0) {
    console.error(`STYLE-PERSIST TEST FAILED (${failed}/${total} checks failed)`);
    process.exit(1);
  }
  console.log(`STYLE-PERSIST TEST PASSED (${total}/${total} checks)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("runner error:", err);
  process.exit(2);
});

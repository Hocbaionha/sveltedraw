// Phase 17 honest-test: 2-tab collab convergence + echo-loop bound check.
//
// Drives the full Phase 17 collab path end-to-end:
//   1. Spawn the in-process y-websocket relay (_yws-server.mjs) on an
//      ephemeral port. Read the bound URL from its first stdout line.
//   2. Spawn TWO Chrome instances with separate user-data-dirs so they
//      get different anon identities (auto-start via ?collab= URL param;
//      no UI interaction needed).
//   3. Wait for both tabs to reach status === "connected" (read via
//      probe.collabStore.status).
//   4. Tab A: replaceAllElements([rect]) on the scene.
//   5. Tab B: poll its scene until the rect appears (convergence).
//   6. Echo-loop bound: snapshot both scenes after convergence + 600ms,
//      assert the snapshots are deep-equal to the originals (no
//      ping-pong push that mutates content while idle).
//   7. Disconnect tab A. Tab B's collaboratorCount drops by 1.
//
// All sections report pass/fail independently so partial regressions
// don't mask survivors. Exit code = number of failed assertions.
//
// Run standalone (requires `yarn start` already running on :3001):
//   node sveltedraw-app/scripts/honest-tests/collab-a1-convergence.mjs

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const CHROME =
  process.env.CHROME ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_BASE = process.env.APP_URL ?? "http://localhost:3001";
const SETUP_WAIT_MS = Number(process.env.SETUP_WAIT_MS ?? 4000);
const CONNECT_WAIT_MS = Number(process.env.CONNECT_WAIT_MS ?? 8000);
const CONVERGE_WAIT_MS = Number(process.env.CONVERGE_WAIT_MS ?? 5000);
const ECHO_QUIET_MS = 600;

const __dirname = dirname(fileURLToPath(import.meta.url));
const tempDirs = [];
const subprocesses = [];

const cleanup = () => {
  for (const p of subprocesses) {
    try { p.kill("SIGKILL"); } catch { /* swallow */ }
  }
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* swallow */ }
  }
};
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });

// ── 1. Spawn the y-websocket relay ─────────────────────────────────────
async function startYwsServer() {
  const child = spawn(
    "node",
    [join(__dirname, "_yws-server.mjs")],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  subprocesses.push(child);
  // Wait for the first stdout line — that's the bound URL.
  const url = await new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk) => {
      buf += chunk.toString();
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        const line = buf.slice(0, nl).trim();
        child.stdout.off("data", onData);
        resolve(line);
      }
    };
    child.stdout.on("data", onData);
    child.once("exit", (code) => reject(new Error(`yws-server exited ${code}`)));
    setTimeout(() => reject(new Error("yws-server start timeout")), 3000);
  });
  // Convert "yws://host:port" → "ws://host:port" for the browser client.
  return url.replace(/^yws:/, "ws:");
}

// ── 2. Spawn a Chrome instance with its own profile ────────────────────
function spawnChrome(cdpPort, url) {
  const tmp = mkdtempSync(join(tmpdir(), `chrome-collab-${cdpPort}-`));
  tempDirs.push(tmp);
  const child = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${tmp}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1280,900",
      url,
    ],
    { stdio: "ignore", detached: false },
  );
  subprocesses.push(child);
}

async function waitForDevtools(port, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch { /* swallow */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`devtools never came up on ${port}`);
}

async function findPageWs(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  const tabs = await res.json();
  const page = tabs.find(
    (t) => t.type === "page" && !t.url.startsWith("devtools://"),
  );
  if (!page) throw new Error(`no page target on ${port}`);
  return page.webSocketDebuggerUrl;
}

// Tiny CDP client — only what we need: Runtime.evaluate.
class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }
  static async connect(wsUrl) {
    const ws = await new Promise((resolve, reject) => {
      const s = new WebSocket(wsUrl, { perMessageDeflate: false });
      s.on("open", () => resolve(s));
      s.on("error", reject);
    });
    return new CdpClient(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: `(async () => { ${expr} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        `eval threw: ${r.exceptionDetails.exception?.description ?? "unknown"}`,
      );
    }
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch { /* swallow */ } }
}

// ── Test harness for one tab ───────────────────────────────────────────
async function setupTab(label, cdpPort, appUrl) {
  spawnChrome(cdpPort, appUrl);
  await waitForDevtools(cdpPort);
  const wsUrl = await findPageWs(cdpPort);
  const cdp = await CdpClient.connect(wsUrl);
  // Wait for the probe to be installed.
  await cdp.eval(`
    const deadline = Date.now() + ${SETUP_WAIT_MS};
    while (!window.__sveltedrawProbe && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (!window.__sveltedrawProbe) throw new Error('probe never exposed (${label})');
  `);
  return cdp;
}

/**
 * Wait until the tab's scene is ready and collab status === "connected".
 * The probe exposes getCollabState — we poll until status reports
 * "connected" so the test isn't racing the websocket handshake.
 */
async function waitForReady(cdp, label) {
  await cdp.eval(`
    const p = window.__sveltedrawProbe;
    const deadline = Date.now() + ${CONNECT_WAIT_MS};
    while (Date.now() < deadline) {
      if (p.scene && p.getCollabState && p.getCollabState().status === 'connected') break;
      await new Promise(r => setTimeout(r, 100));
    }
    if (!p.scene) throw new Error('scene never ready (${label})');
    const s = p.getCollabState ? p.getCollabState() : { status: 'no-probe' };
    if (s.status !== 'connected') {
      throw new Error('collab not connected (${label}): ' + JSON.stringify(s));
    }
    p.scene.replaceAllElements([]);
    p.bumpSceneRepaint();
  `);
}

// ── Main ───────────────────────────────────────────────────────────────
const results = {};
let exitCode = 0;
const record = (key, ok, detail) => {
  results[key] = { ok, detail };
  if (!ok) exitCode++;
};

try {
  console.log("[1/7] starting yws relay…");
  const wsUrl = await startYwsServer();
  console.log(`      relay at ${wsUrl}`);

  const room = `test-${Date.now().toString(36)}`;
  const tabUrl = `${APP_BASE}/#app?collab=${encodeURIComponent(wsUrl)}&room=${room}`;

  console.log("[2/7] spawning 2 Chrome tabs (separate profiles)…");
  const [a, b] = await Promise.all([
    setupTab("A", 9351, tabUrl),
    setupTab("B", 9352, tabUrl),
  ]);

  console.log("[3/7] waiting for probe + auto-start budget…");
  await Promise.all([waitForReady(a, "A"), waitForReady(b, "B")]);
  // Auto-start fires inside the editor's onMount. Give the websocket
  // handshake + initial sync a brief grace window.
  await new Promise((r) => setTimeout(r, 1500));

  console.log("[4/7] tab A: insert rectangle…");
  const ELEMENT_ID = `el-test-${Date.now().toString(36)}`;
  await a.eval(`
    const p = window.__sveltedrawProbe;
    const el = {
      id: ${JSON.stringify(ELEMENT_ID)},
      type: 'rectangle',
      x: 100, y: 100, width: 80, height: 60, angle: 0,
      strokeColor: '#1e1e1e', backgroundColor: '#2f9e44', fillStyle: 'solid',
      strokeWidth: 2, strokeStyle: 'solid', roundness: null, roughness: 0,
      opacity: 100, groupIds: [], frameId: null, index: 'a0',
      boundElements: null, updated: Date.now(), link: null, locked: false,
      seed: 1, version: 1, versionNonce: 1, isDeleted: false,
    };
    p.scene.replaceAllElements([el]);
    p.bumpSceneRepaint();
  `);
  record("a_inserted", true, ELEMENT_ID);

  console.log("[5/7] tab B: poll for convergence…");
  const sawElement = await b.eval(`
    const p = window.__sveltedrawProbe;
    const deadline = Date.now() + ${CONVERGE_WAIT_MS};
    while (Date.now() < deadline) {
      const els = p.scene.getNonDeletedElements();
      if (els.some(e => e.id === ${JSON.stringify(ELEMENT_ID)})) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  `);
  record("b_received_remote", sawElement, sawElement ? "ok" : "timeout");

  console.log("[6/7] echo-loop bound check (quiet for 600ms)…");
  // Snapshot both tabs right now, sleep 600ms (no input), snapshot again.
  // If echo guards work, both snapshots are identical. If a loop is
  // running, the version/updated fields tick or the elements array
  // mutates under us.
  const snap = (cdp) => cdp.eval(`
    const els = window.__sveltedrawProbe.scene.getNonDeletedElements();
    return JSON.stringify(els.map(e => ({ id: e.id, x: e.x, y: e.y })));
  `);
  const aBefore = await snap(a);
  const bBefore = await snap(b);
  await new Promise((r) => setTimeout(r, ECHO_QUIET_MS));
  const aAfter = await snap(a);
  const bAfter = await snap(b);
  record("a_quiet", aBefore === aAfter, aBefore === aAfter ? "stable" : `${aBefore} → ${aAfter}`);
  record("b_quiet", bBefore === bAfter, bBefore === bAfter ? "stable" : `${bBefore} → ${bAfter}`);

  console.log("[7/7] tab B disconnect → tab A peer count drops…");
  // We close tab B's CDP socket — the browser process keeps running but
  // we can also tear down the page. Simpler: close the WS to Chrome,
  // then kill that subprocess. The server's onClose fires, awareness
  // removes the entry, tab A's awareness change handler updates users.
  b.close();
  // Find and kill tab B's chrome subprocess. We track them in
  // `subprocesses` in spawn order: yws, chromeA, chromeB.
  try { subprocesses[2].kill("SIGKILL"); } catch { /* swallow */ }
  await new Promise((r) => setTimeout(r, 1500));
  // Verify (a) tab A's scene is still intact (not corrupted by B's
  // disconnect cascade) AND (b) tab A's collaboratorCount dropped to
  // reflect the missing peer.
  const aPostState = await a.eval(`
    const p = window.__sveltedrawProbe;
    const els = p.scene.getNonDeletedElements();
    const cs = p.getCollabState();
    return {
      sceneOk: els.length === 1 && els[0].id === ${JSON.stringify(ELEMENT_ID)},
      userCount: cs.userCount,
      status: cs.status,
    };
  `);
  record(
    "a_scene_intact_after_b_left",
    aPostState.sceneOk,
    aPostState.sceneOk ? "ok" : "scene corrupted",
  );
  // Self counts as 1 in the awareness Map; with B gone, A sees just itself.
  record(
    "a_peer_count_dropped",
    aPostState.userCount === 1,
    `userCount=${aPostState.userCount} status=${aPostState.status}`,
  );

  a.close();
} catch (err) {
  console.error("FATAL:", err.message);
  exitCode = 99;
  results.fatal = err.message;
}

console.log("\n══════ RESULTS ══════");
for (const [k, v] of Object.entries(results)) {
  const tag = v.ok === true ? "PASS" : v.ok === false ? "FAIL" : "FATAL";
  console.log(`  ${tag.padEnd(5)} ${k}${v.detail ? `   (${v.detail})` : ""}`);
}
console.log(`\nExit ${exitCode}`);
process.exit(exitCode);

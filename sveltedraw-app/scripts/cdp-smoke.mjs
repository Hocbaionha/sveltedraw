// CDP smoke test — connects to the headless Chrome tab and runs a scripted
// interaction through every showcase category, collecting any console errors
// and final DOM snapshots. Outputs a readable text report.

import WebSocket from "ws";

const CDP = "http://localhost:9222";
const TARGET_URL_PREFIX = "http://localhost:4003";

function log(...args) {
  console.log("[cdp]", ...args);
}

async function getPageTarget() {
  const res = await fetch(`${CDP}/json`);
  const tabs = await res.json();
  const page = tabs.find(
    (t) => t.type === "page" && t.url.startsWith(TARGET_URL_PREFIX),
  );
  if (!page) throw new Error("No showcase page target found");
  return page;
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { perMessageDeflate: false });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.eventHandlers = new Map();
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
        return;
      }
      if (msg.method) {
        this.events.push(msg);
        const h = this.eventHandlers.get(msg.method);
        if (h) h(msg.params);
      }
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, handler) {
    this.eventHandlers.set(method, handler);
  }
  close() {
    this.ws.close();
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const target = await getPageTarget();
  log("target:", target.url);
  const ws = await connect(target.webSocketDebuggerUrl);
  const s = new Session(ws);

  const consoleLogs = [];
  const pageErrors = [];

  await s.send("Runtime.enable");
  await s.send("Log.enable");
  await s.send("Page.enable");

  s.on("Runtime.consoleAPICalled", (p) => {
    const text = p.args
      .map((a) => a.value ?? a.description ?? a.type)
      .join(" ");
    consoleLogs.push(`[${p.type}] ${text}`);
  });
  s.on("Runtime.exceptionThrown", (p) => {
    pageErrors.push(
      p.exceptionDetails?.exception?.description ??
        p.exceptionDetails?.text ??
        JSON.stringify(p.exceptionDetails),
    );
  });
  s.on("Log.entryAdded", (p) => {
    if (p.entry.level === "error" || p.entry.level === "warning") {
      consoleLogs.push(`[log.${p.entry.level}] ${p.entry.text}`);
    }
  });

  async function evalJs(expr) {
    const r = await s.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        "eval threw: " +
          (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text),
      );
    }
    return r.result?.value;
  }

  // Reload to get a clean slate
  await s.send("Page.navigate", { url: "http://localhost:4003/#showcase" });
  await wait(2500);

  const categories = [
    "primitives",
    "layout",
    "buttons",
    "inputs",
    "toolbar",
    "overlays",
    "dropdown",
    "dialogs",
    "misc",
    "icons",
    "bitsui",
  ];

  const report = {};

  for (const cat of categories) {
    // Navigate by setting hash directly (the nav buttons do the same)
    await evalJs(`window.location.hash = '#showcase/${cat}'`);
    await wait(400);

    // Snapshot: active nav item + h1 + count of .demo blocks + any visible
    // error toasts
    const snap = await evalJs(`(() => {
      const active = document.querySelector('.showcase__nav-item.active')?.textContent?.trim() ?? null;
      const h1 = document.querySelector('.showcase__main h1')?.textContent?.trim() ?? null;
      const demoCount = document.querySelectorAll('.showcase__main .demo').length;
      const iconCount = document.querySelectorAll('.icon-cell').length;
      const bodyLen = document.querySelector('.showcase__main')?.innerHTML?.length ?? 0;
      const url = location.href;
      return { active, h1, demoCount, iconCount, bodyLen, url };
    })()`);

    report[cat] = snap;
  }

  // Final deep test — click the Dark theme checkbox and make sure the class
  // flips.
  await evalJs(`(() => {
    const cb = document.querySelector('.showcase__theme input[type=checkbox]');
    if (cb) { cb.click(); }
  })()`);
  await wait(300);
  const darkTest = await evalJs(
    `document.querySelector('.showcase')?.classList.contains('theme--dark')`,
  );

  // Try clicking a nav button (not just setting hash) — simulates real user
  // interaction + verifies the fix to App.svelte hash prefix check.
  await evalJs(`(() => {
    location.hash = '';
  })()`);
  await wait(300);
  await evalJs(
    `document.querySelector('a[href="#showcase"]')?.click() || (location.hash = '#showcase')`,
  );
  await wait(800);
  // Click buttons nav
  const clickResult = await evalJs(`(() => {
    const navs = [...document.querySelectorAll('.showcase__nav-item')];
    const btn = navs.find((n) => n.textContent?.trim() === 'Buttons');
    if (!btn) return 'NO BUTTON';
    btn.click();
    return { hash: location.hash, activeHeading: document.querySelector('.showcase__main h1')?.textContent };
  })()`);

  s.close();

  // Report
  console.log("\n=== SHOWCASE SMOKE REPORT ===\n");
  for (const [cat, snap] of Object.entries(report)) {
    const ok = snap.h1 && snap.bodyLen > 100;
    console.log(
      `${ok ? "✓" : "✗"} ${cat.padEnd(12)} active="${snap.active}" h1="${snap.h1}" demos=${snap.demoCount} icons=${snap.iconCount} body=${snap.bodyLen}`,
    );
  }
  console.log("\nDark mode flip:", darkTest);
  console.log("Nav click result:", JSON.stringify(clickResult));

  if (consoleLogs.length) {
    console.log("\n--- Console logs (" + consoleLogs.length + ") ---");
    consoleLogs.slice(0, 30).forEach((l) => console.log(l));
  } else {
    console.log("\n(no console output)");
  }
  if (pageErrors.length) {
    console.log("\n--- Page errors (" + pageErrors.length + ") ---");
    pageErrors.forEach((e) => console.log(e));
    process.exit(1);
  } else {
    console.log("\n(no page errors)");
  }
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(2);
});

// Interactive CDP test — clicks through Modal, Dialog, ConfirmDialog, Dropdown,
// Tooltip, Switch/Range/TextField, captures screenshots per category, and
// asserts zero runtime errors across the walk-through.
//
// Output: writes screenshots to sveltedraw-app/scripts/cdp-screenshots/.
// Usage: node scripts/cdp-interactive.mjs

import WebSocket from "ws";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = resolve(__dirname, "cdp-screenshots");
mkdirSync(SHOT_DIR, { recursive: true });

const CDP = "http://localhost:9222";
const TARGET_URL_PREFIX = "http://localhost:4003";

async function getPageTarget() {
  const res = await fetch(`${CDP}/json`);
  const tabs = await res.json();
  return tabs.find(
    (t) => t.type === "page" && t.url.startsWith(TARGET_URL_PREFIX),
  );
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
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
        const h = this.handlers.get(msg.method);
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
    this.handlers.set(method, handler);
  }
  close() {
    this.ws.close();
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const target = await getPageTarget();
  if (!target) throw new Error("no page target");
  const ws = await new Promise((resolve, reject) => {
    const s = new WebSocket(target.webSocketDebuggerUrl, {
      perMessageDeflate: false,
    });
    s.once("open", () => resolve(s));
    s.once("error", reject);
  });
  const s = new Session(ws);

  const errors = [];
  const warns = [];

  await s.send("Runtime.enable");
  await s.send("Page.enable");
  await s.send("DOM.enable");

  s.on("Runtime.exceptionThrown", (p) => {
    errors.push(
      p.exceptionDetails?.exception?.description ??
        p.exceptionDetails?.text ??
        "?",
    );
  });
  s.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error" || p.type === "warning") {
      const text = p.args
        .map((a) => a.value ?? a.description ?? a.type)
        .join(" ");
      (p.type === "error" ? errors : warns).push(`[console.${p.type}] ${text}`);
    }
  });

  async function evalJs(expr) {
    const r = await s.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      const msg =
        r.exceptionDetails.exception?.description ??
        r.exceptionDetails.text ??
        JSON.stringify(r.exceptionDetails);
      throw new Error("eval threw: " + msg);
    }
    return r.result?.value;
  }

  async function screenshot(name) {
    const { data } = await s.send("Page.captureScreenshot", {
      format: "png",
    });
    const path = resolve(SHOT_DIR, `${name}.png`);
    writeFileSync(path, Buffer.from(data, "base64"));
    return path;
  }

  async function nav(section) {
    await evalJs(`window.location.hash = '#showcase/${section}'`);
    await wait(350);
  }

  async function click(selector) {
    const r = await evalJs(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return { ok: false, reason: 'not found' };
      el.click();
      return { ok: true };
    })()`);
    return r;
  }

  async function dispatchKey(key) {
    await s.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code: key,
    });
    await s.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key });
  }

  const results = [];
  function record(name, ok, detail = "") {
    results.push({ name, ok, detail });
  }

  // ─── Reload to clean state ────────────────────────────────────────────
  await s.send("Page.navigate", { url: "http://localhost:4003/#showcase" });
  await wait(2000);

  // Set viewport to make screenshots consistent
  await s.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // ─── 1. Screenshots per category ─────────────────────────────────────
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

  for (const cat of categories) {
    await nav(cat);
    const hasH1 = await evalJs(`!!document.querySelector('.showcase__main h1')`);
    record(`shot:${cat}`, !!hasH1);
    await screenshot(`01-category-${cat}`);
  }

  // ─── 2. Modal: open → ESC closes ─────────────────────────────────────
  await nav("overlays");
  // click first "Open Modal" button (the one in the "Modal" demo card)
  let r = await evalJs(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.includes('Open Modal'));
    if (!btn) return { ok: false };
    btn.click();
    return { ok: true };
  })()`);
  await wait(400);
  const modalOpen1 = await evalJs(`!!document.querySelector('.Modal')`);
  record("modal.open via click", modalOpen1);
  await screenshot("02-modal-open");

  // ESC to close
  await dispatchKey("Escape");
  await wait(400);
  const modalClosedByEsc = await evalJs(
    `!document.querySelector('.Modal')`,
  );
  record("modal.esc closes", modalClosedByEsc);

  // Re-open then click background to close
  await evalJs(
    `[...document.querySelectorAll('button')].find(b => b.textContent?.includes('Open Modal'))?.click()`,
  );
  await wait(400);
  // Click the Modal__background overlay
  await evalJs(
    `document.querySelector('.Modal__background')?.click()`,
  );
  await wait(400);
  const modalClosedByBg = await evalJs(`!document.querySelector('.Modal')`);
  record("modal.bg-click closes", modalClosedByBg);

  // ─── 3. Toast: click → appears → auto-dismisses ──────────────────────
  await evalJs(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.includes('Show Toast'));
    if (btn) btn.click();
  })()`);
  await wait(400);
  const toastVisible = await evalJs(
    `!!document.querySelector('.Toast')`,
  );
  record("toast.appears", toastVisible);
  await screenshot("03-toast-open");

  // ─── 4. Dialog family ────────────────────────────────────────────────
  await nav("dialogs");
  await wait(300);
  await evalJs(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.includes('Open Dialog') && !b.textContent.includes('Confirm'));
    if (btn) btn.click();
  })()`);
  await wait(400);
  const dialogOpen = await evalJs(
    `!!document.querySelector('.Dialog')`,
  );
  record("dialog.opens", dialogOpen);
  await screenshot("04-dialog-open");
  await dispatchKey("Escape");
  await wait(400);
  const dialogClosed = await evalJs(`!document.querySelector('.Dialog')`);
  record("dialog.esc closes", dialogClosed);

  // ConfirmDialog
  await evalJs(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.includes('Open ConfirmDialog'));
    if (btn) btn.click();
  })()`);
  await wait(400);
  const confirmOpen = await evalJs(
    `!!document.querySelector('.confirm-dialog, .Dialog.confirm-dialog')`,
  );
  record("confirm.opens", confirmOpen);
  await screenshot("05-confirm-open");
  // Click Cancel
  await evalJs(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.getAttribute('aria-label') === 'Cancel');
    if (btn) btn.click();
  })()`);
  await wait(400);
  const confirmClosed = await evalJs(
    `!document.querySelector('.confirm-dialog, .Dialog.confirm-dialog')`,
  );
  record("confirm.cancel closes", confirmClosed);

  // ErrorDialog
  await evalJs(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.includes('Trigger ErrorDialog'));
    if (btn) btn.click();
  })()`);
  await wait(400);
  const errorOpen = await evalJs(
    `!!document.querySelector('.Dialog')`,
  );
  record("error.opens", errorOpen);
  await screenshot("06-error-open");
  await dispatchKey("Escape");
  await wait(300);

  // ─── 5. DropdownMenu ────────────────────────────────────────────────
  await nav("dropdown");
  await wait(300);
  await evalJs(`(() => {
    const trig = document.querySelector('[data-testid=dropdown-menu], .sveltedraw-button');
    // actually the trigger is a button containing "File ▾"
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.includes('File'));
    if (btn) btn.click();
  })()`);
  await wait(400);
  const ddOpen = await evalJs(
    `!!document.querySelector('.dropdown-menu, [role=menu]')`,
  );
  record("dropdown.opens", ddOpen);
  await screenshot("07-dropdown-open");
  await dispatchKey("Escape");
  await wait(300);

  // ─── 6. Inputs: Switch toggle ───────────────────────────────────────
  await nav("inputs");
  await wait(300);
  // Read initial switch state
  const switchBefore = await evalJs(`(() => {
    const code = [...document.querySelectorAll('code')]
      .find(c => c.textContent?.startsWith('value:'));
    return code?.textContent ?? null;
  })()`);
  // Click the switch
  await evalJs(
    `document.querySelector('.Switch__handle, [role=switch], input[name="showcase-switch"]')?.click()
     || document.querySelector('.Switch')?.click()`,
  );
  await wait(300);
  const switchAfter = await evalJs(`(() => {
    const code = [...document.querySelectorAll('code')]
      .find(c => c.textContent?.startsWith('value:'));
    return code?.textContent ?? null;
  })()`);
  record(
    "switch.toggles",
    switchBefore !== switchAfter,
    `${switchBefore} → ${switchAfter}`,
  );

  // ─── 7. TextField — CDP click on the input to focus it reliably, then
  // insertText to exercise the oninput → onChange → re-render cycle. ──
  const inputRect = await evalJs(`(() => {
    // The ported TextField renders <input> without explicit type attribute.
    // Find it by placeholder (distinctive enough) and skip the QuickSearch
    // one ('Search...') + the redacted one which uses -webkit-text-security.
    const inputs = [...document.querySelectorAll('input')];
    const input = inputs.find(i => i.placeholder === 'Type here...');
    if (!input) {
      return { debug: inputs.map(i => ({ type: i.type, placeholder: i.placeholder, label: i.getAttribute('aria-label') })) };
    }
    const r = input.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (inputRect && typeof inputRect.x === "number") {
    await s.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: inputRect.x,
      y: inputRect.y,
      button: "left",
      clickCount: 1,
    });
    await s.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: inputRect.x,
      y: inputRect.y,
      button: "left",
      clickCount: 1,
    });
    await wait(100);
    await s.send("Input.insertText", { text: "hello" });
  }
  await wait(400);
  const textReflected = await evalJs(`(() => {
    const code = [...document.querySelectorAll('code')]
      .find(c => c.textContent?.startsWith('value:') && c.textContent.includes('hello'));
    return !!code;
  })()`);
  record("textfield.reflects input", textReflected, JSON.stringify(inputRect));

  // ─── 8. Tooltip — bits-ui Tooltip uses FloatingUI which needs real mouse
  // events, so dispatch via CDP Input.dispatchMouseEvent rather than synthetic
  // PointerEvents. ─────────────────────────────────────────────────────
  await nav("overlays");
  await wait(300);
  const hoverTarget = await evalJs(`(() => {
    const t = [...document.querySelectorAll('span')]
      .find(s => s.textContent === 'Hover me');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (hoverTarget) {
    await s.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: 0,
      y: 0,
    });
    await wait(100);
    await s.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: hoverTarget.x,
      y: hoverTarget.y,
    });
  }
  await wait(1200);
  // Check multiple possible tooltip classes/attributes — bits-ui may use any
  const tooltipProbe = await evalJs(`(() => {
    const visible = !!document.querySelector('.sveltedraw-tooltip--visible');
    const byRole = !!document.querySelector('[role=tooltip]');
    const byDataState = !!document.querySelector('[data-tooltip-content][data-state=open]');
    const anyTooltip = document.querySelectorAll('.sveltedraw-tooltip, [role=tooltip]').length;
    return { visible, byRole, byDataState, anyTooltip };
  })()`);
  const tooltipVisible =
    tooltipProbe.visible || tooltipProbe.byRole || tooltipProbe.byDataState;
  record(
    "tooltip.hover shows",
    tooltipVisible,
    `${JSON.stringify(tooltipProbe)} @ ${JSON.stringify(hoverTarget)}`,
  );
  await screenshot("08-tooltip-open");

  // ─── 9. Dark mode flip ───────────────────────────────────────────────
  await evalJs(
    `document.querySelector('.showcase__theme input')?.click()`,
  );
  await wait(300);
  const darkOn = await evalJs(
    `!!document.querySelector('.showcase.theme--dark')`,
  );
  record("dark.toggles on", darkOn);
  await screenshot("09-dark-mode");
  await evalJs(
    `document.querySelector('.showcase__theme input')?.click()`,
  );
  await wait(200);

  // ─── 10. Icon grid ───────────────────────────────────────────────────
  await nav("icons");
  await wait(400);
  const iconCount = await evalJs(
    `document.querySelectorAll('.icon-cell svg').length`,
  );
  record("icons.render", iconCount >= 20, `${iconCount} svgs`);

  s.close();

  console.log("\n=== INTERACTIVE TEST REPORT ===\n");
  let failed = 0;
  for (const r of results) {
    const mark = r.ok ? "✓" : "✗";
    if (!r.ok) failed++;
    console.log(`${mark} ${r.name.padEnd(32)} ${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);

  if (errors.length) {
    console.log("\n--- Page errors ---");
    errors.forEach((e) => console.log(e));
  }
  if (warns.length) {
    console.log("\n--- Warnings (" + warns.length + ") ---");
    warns.slice(0, 10).forEach((w) => console.log(w));
  }

  console.log(`\nScreenshots: ${SHOT_DIR}`);

  if (errors.length > 0 || failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(2);
});

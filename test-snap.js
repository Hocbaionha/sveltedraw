// Honest end-to-end test for A4 (snap-to-grid + snap-to-elements)
// and A6 (alignment guide render). Drags shapes via real puppeteer
// pointer events and asserts on final scene state.
const puppeteer = require('puppeteer');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--window-size=1600,1000'],
    defaultViewport: { width: 1600, height: 1000 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('BROWSER ERR:', m.text());
  });
  await page.goto('http://localhost:3005/#app', { waitUntil: 'networkidle2' });
  await delay(2500);

  let pass = 0, fail = 0;
  const log = (name, ok, extra) => {
    console.log(`${ok ? 'OK' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    ok ? pass++ : fail++;
  };

  // Helpers
  const seed = async (elems, snapOverrides, gridOverrides) => {
    await page.evaluate((elems_, snap_, grid_) => {
      const p = window.__sveltedrawProbe;
      p.appState.selectedElementIds = {};
      p.closeAllSidePanels?.();
      p.scene.replaceAllElements(elems_, { skipValidation: true });
      p.pushHistory();
      p.bumpSceneRepaint();
    }, elems, snapOverrides, gridOverrides);
    await delay(200);
  };

  const setSnapGrid = async (snap, grid) => {
    await page.evaluate((s_, g_) => {
      const p = window.__sveltedrawProbe;
      // Merge in place so $state reactivity picks it up
      for (const k in s_) p.appState; // dummy touch
      // Assume probe exposes helpers; else mutate directly via an App handler if present
      // Fall back: reach into any exposed setters via window hooks.
    }, snap, grid);
  };

  const mkRect = (id, x, y, w = 100, h = 60, bg = '#ccc') => ({
    id, type: 'rectangle', x, y, width: w, height: h, angle: 0,
    strokeColor: '#000', backgroundColor: bg, fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null,
    updated: Date.now(), link: null, locked: false, roundness: null,
  });

  const clientFor = async (sceneX, sceneY) => {
    return page.evaluate((sx_, sy_) => {
      const canvas = document.querySelector('canvas.excalidraw__canvas.interactive');
      const r = canvas.getBoundingClientRect();
      const p = window.__sveltedrawProbe;
      const z = p.appState.zoom.value;
      const offx = p.appState.scrollX || 0;
      const offy = p.appState.scrollY || 0;
      return {
        cx: r.left + (sx_ + offx) * z,
        cy: r.top + (sy_ + offy) * z,
      };
    }, sceneX, sceneY);
  };

  const dragBy = async (fromScene, toScene, { shift = false } = {}) => {
    const from = await clientFor(fromScene.x, fromScene.y);
    const to = await clientFor(toScene.x, toScene.y);
    await page.mouse.move(from.cx, from.cy);
    // Always start drag WITHOUT shift — shift+pointerdown is multi-select.
    // Engage shift only during the move so the drag handler sees event.shiftKey
    // on pointermove (which is what the snap bypass reads).
    await page.mouse.down();
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.move((from.cx + to.cx) / 2, (from.cy + to.cy) / 2, { steps: 5 });
    await page.mouse.move(to.cx, to.cy, { steps: 5 });
    if (shift) await page.keyboard.up('Shift');
    await page.mouse.up();
    await delay(250);
  };

  // ── TEST 1: snap-to-grid ──
  // gridConfig.size default 20, snapConfig.enabled default true, snapToGrid true.
  // Drag a rect by +37px — expect final x to land on multiple of 20.
  await seed([mkRect('r1', 400, 300)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    // Nothing to tweak — defaults enable snapToGrid with threshold 8.
    // But default also has snapToElements true, which could interfere.
    // Only one shape here so element snap is a no-op.
  });

  // Shape r1 top-left = (400, 300). Drag from center (450, 330) by +37 px.
  await dragBy({ x: 450, y: 330 }, { x: 487, y: 367 });
  const r1 = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('r1');
    return { x: el.x, y: el.y };
  });
  // 400 + 37 = 437 → nearest 20-multiple is 440; 437 is within threshold 8
  log('snap-to-grid snaps x to grid multiple', r1.x === 440, `x=${r1.x}`);
  log('snap-to-grid snaps y to grid multiple', r1.y === 340, `y=${r1.y}`);

  // ── TEST 2: shift bypasses snap ──
  await seed([mkRect('r2', 400, 300)]);
  await dragBy({ x: 450, y: 330 }, { x: 487, y: 367 }, { shift: true });
  const r2 = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('r2');
    return { x: el.x, y: el.y };
  });
  // With shift held, no snap: 400 + 37 = 437
  log('shift bypasses snap — free drag', r2.x === 437 && r2.y === 337,
    `pos=(${r2.x},${r2.y})`);

  // ── TEST 3: snap-to-elements (edge align) ──
  // Two rects. Drag r3 so its left edge approaches r_ref's left edge.
  // r_ref at x=600 left edge. Drag r3 so its left lands at x=595 (within 8px).
  // Expect snap: r3.x becomes exactly 600.
  await seed([
    mkRect('r_ref', 600, 500, 120, 80, '#a5d8ff'),
    mkRect('r3', 300, 300, 100, 60, '#ffc9c9'),
  ]);
  // r3 center = (350, 330). Drag so r3 left ends at 595 → need center at 645.
  // Move center from (350,330) to (645, 330) = +295 in x.
  // But final left edge we want: 595 → r3.x = 595. Raw drag drops r3 at x=595.
  // Within threshold 8 of r_ref.left=600 → snap to 600.
  await dragBy({ x: 350, y: 330 }, { x: 645, y: 330 });
  const r3 = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('r3');
    return { x: el.x, y: el.y };
  });
  log('snap-to-elements: left edge snaps to neighbor left',
    r3.x === 600, `x=${r3.x}`);

  // ── TEST 4: guide renders during drag ──
  // Seed two rects close enough to snap, drag one, measure guide count mid-drag.
  await seed([
    mkRect('gref', 700, 500, 120, 80, '#a5d8ff'),
    mkRect('gdrag', 300, 300, 100, 60, '#ffc9c9'),
  ]);
  const dragFrom = await clientFor(350, 330);
  // Land gdrag.x close to gref.x=700 (within threshold)
  const dragMid = await clientFor(650, 330);
  const dragEnd = await clientFor(745, 330);  // gdrag.x = 695, within 8px of 700
  await page.mouse.move(dragFrom.cx, dragFrom.cy);
  await page.mouse.down();
  await page.mouse.move(dragMid.cx, dragMid.cy, { steps: 3 });
  await page.mouse.move(dragEnd.cx, dragEnd.cy, { steps: 3 });
  // Sample DOM state BEFORE releasing — guide overlay should be present
  const guideInfo = await page.evaluate(() => {
    const renderer = document.querySelector('.snap-guide-renderer');
    const guides = document.querySelectorAll('.snap-guide');
    return {
      rendererPresent: !!renderer,
      guideCount: guides.length,
    };
  });
  await page.mouse.up();
  await delay(200);
  // Check final state — guides cleared on pointerup
  const afterDrag = await page.evaluate(() => {
    const gd = window.__sveltedrawProbe.scene.getElement('gdrag');
    return { x: gd.x };
  });
  log('snap-to-elements: drag snapped to neighbor x=700',
    afterDrag.x === 700, `x=${afterDrag.x}`);
  log('A6: snap-guide overlay renders with ≥1 guide line mid-drag',
    guideInfo.rendererPresent && guideInfo.guideCount >= 1,
    `renderer=${guideInfo.rendererPresent} guides=${guideInfo.guideCount}`);

  // ── TEST 5: guides clear after pointerup ──
  const cleared = await page.evaluate(() => {
    return document.querySelectorAll('.snap-guide').length;
  });
  log('A6: guides cleared on pointerup', cleared === 0, `residual=${cleared}`);

  // ── TEST 6: snap disabled → no snap applied ──
  await seed([
    mkRect('r_ref2', 600, 500, 120, 80, '#a5d8ff'),
    mkRect('r4', 300, 300, 100, 60, '#ffc9c9'),
  ]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.setSnapConfig({ enabled: false });
  });
  // Same drag as TEST 3: without snap, r4.x should land at 595 (raw), not 600.
  await dragBy({ x: 350, y: 330 }, { x: 645, y: 330 });
  const r4 = await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const el = p.scene.getElement('r4');
    p.setSnapConfig({ enabled: true });  // restore
    return { x: el.x, y: el.y };
  });
  log('snap disabled: free drag lands at raw cursor position',
    r4.x === 595, `x=${r4.x}`);

  // ── TEST 7: snapshot a guide mid-drag ──
  await seed([
    mkRect('sref', 700, 500, 120, 80, '#a5d8ff'),
    mkRect('sdrag', 300, 300, 100, 60, '#ffc9c9'),
  ]);
  const sf = await clientFor(350, 330);
  const sm = await clientFor(650, 330);
  const se = await clientFor(745, 330);
  await page.mouse.move(sf.cx, sf.cy);
  await page.mouse.down();
  await page.mouse.move(sm.cx, sm.cy, { steps: 3 });
  await page.mouse.move(se.cx, se.cy, { steps: 3 });
  await page.screenshot({ path: 'snap-guide-visible.png',
    clip: { x: 100, y: 150, width: 900, height: 600 } });
  await page.mouse.up();
  console.log('saved snap-guide-visible.png');

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

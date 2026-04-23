// Ground truth: what actually happens today with locked elements?
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

  const mkRect = (id, x, y, locked) => ({
    id, type: 'rectangle', x, y, width: 120, height: 80, angle: 0,
    strokeColor: '#000', backgroundColor: '#a5d8ff', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: !!locked, roundness: null,
  });

  const seed = async (elems) => {
    await page.evaluate((els) => {
      const p = window.__sveltedrawProbe;
      p.appState.selectedElementIds = {};
      p.closeAllSidePanels?.();
      p.scene.replaceAllElements(els, { skipValidation: true });
      p.pushHistory();
      p.bumpSceneRepaint();
    }, elems);
    await delay(200);
  };

  const clientFor = (sceneX, sceneY) =>
    page.evaluate((sx_, sy_) => {
      const canvas = document.querySelector('canvas.excalidraw__canvas.interactive');
      const r = canvas.getBoundingClientRect();
      const p = window.__sveltedrawProbe;
      const z = p.appState.zoom.value;
      const offx = p.appState.scrollX || 0;
      const offy = p.appState.scrollY || 0;
      return { cx: r.left + (sx_ + offx) * z, cy: r.top + (sy_ + offy) * z };
    }, sceneX, sceneY);

  const dragBy = async (fromScene, toScene) => {
    const from = await clientFor(fromScene.x, fromScene.y);
    const to = await clientFor(toScene.x, toScene.y);
    await page.mouse.move(from.cx, from.cy);
    await page.mouse.down();
    await page.mouse.move((from.cx + to.cx) / 2, (from.cy + to.cy) / 2, { steps: 5 });
    await page.mouse.move(to.cx, to.cy, { steps: 5 });
    await page.mouse.up();
    await delay(250);
  };

  // TEST 1: click-drag on locked rect → no move
  await seed([mkRect('lk', 500, 300, true)]);
  await dragBy({ x: 560, y: 340 }, { x: 700, y: 440 });
  const t1 = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('lk');
    return { x: el.x, y: el.y };
  });
  log('locked rect does not move on click-drag', t1.x === 500 && t1.y === 300,
    `pos=(${t1.x},${t1.y})`);

  // TEST 2: click locked → should select it (with lock indicator) per plan
  const t2 = await page.evaluate(() => {
    const sel = window.__sveltedrawProbe.appState.selectedElementIds || {};
    return { keys: Object.keys(sel) };
  });
  log('locked rect selected after click', t2.keys.includes('lk'),
    `selected=${JSON.stringify(t2.keys)}`);

  // TEST 3: drag via Ctrl+A path — Ctrl+A selects all. Then drag.
  await seed([mkRect('a', 400, 300, true), mkRect('b', 700, 300, false)]);
  // Use Ctrl+A via keyboard
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await delay(100);
  const afterSelAll = await page.evaluate(() => {
    const sel = window.__sveltedrawProbe.appState.selectedElementIds || {};
    return { keys: Object.keys(sel).sort() };
  });
  log('Ctrl+A selection composition', true,
    `selected=${JSON.stringify(afterSelAll.keys)}`);
  // Drag on 'b' (unlocked)
  await dragBy({ x: 760, y: 340 }, { x: 900, y: 400 });
  const t3 = await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    return {
      a: { x: p.scene.getElement('a').x, y: p.scene.getElement('a').y },
      b: { x: p.scene.getElement('b').x, y: p.scene.getElement('b').y },
    };
  });
  log('locked "a" stays put after multi-drag', t3.a.x === 400 && t3.a.y === 300,
    `a=(${t3.a.x},${t3.a.y})`);
  log('unlocked "b" moves on multi-drag', t3.b.x !== 700 || t3.b.y !== 300,
    `b=(${t3.b.x},${t3.b.y})`);

  // TEST 4': programmatic selection of locked + unlocked → drag only moves unlocked
  await seed([mkRect('lp', 400, 300, true), mkRect('up', 700, 500, false)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { lp: true, up: true };
    p.bumpSceneRepaint();
  });
  await delay(100);
  // Drag starting on 'up' (unlocked). hit='up', dragOrigins should exclude 'lp'
  await dragBy({ x: 760, y: 540 }, { x: 860, y: 600 });
  const t3b = await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    return {
      lp: { x: p.scene.getElement('lp').x, y: p.scene.getElement('lp').y },
      up: { x: p.scene.getElement('up').x, y: p.scene.getElement('up').y },
    };
  });
  log('programmatically-selected locked does not move on group drag',
    t3b.lp.x === 400 && t3b.lp.y === 300, `lp=(${t3b.lp.x},${t3b.lp.y})`);
  log('unlocked companion moves', t3b.up.x !== 700 || t3b.up.y !== 500,
    `up=(${t3b.up.x},${t3b.up.y})`);

  // TEST 4: resize handle on locked → should not be hit-testable
  await seed([mkRect('rk', 400, 300, true)]);
  await page.evaluate(() => {
    // Force-select the locked rect to see if resize handles appear
    window.__sveltedrawProbe.appState.selectedElementIds = { rk: true };
    window.__sveltedrawProbe.bumpSceneRepaint();
  });
  await delay(150);
  // Click near a corner handle (NE of rk at 520,300)
  await dragBy({ x: 520, y: 300 }, { x: 600, y: 300 });
  const t4 = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('rk');
    return { w: el.width, h: el.height };
  });
  log('locked rect cannot be resized', t4.w === 120 && t4.h === 80,
    `size=(${t4.w},${t4.h})`);

  // Visual: select a locked rect + screenshot → outline, no resize handles
  await seed([mkRect('viz', 400, 300, true)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { viz: true };
    p.bumpSceneRepaint();
  });
  await delay(200);
  await page.screenshot({ path: 'locked-selected.png',
    clip: { x: 300, y: 200, width: 500, height: 300 } });
  console.log('saved locked-selected.png');

  // Compare: unlocked rect selected → resize handles should appear
  await seed([mkRect('viz2', 400, 300, false)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { viz2: true };
    p.bumpSceneRepaint();
  });
  await delay(200);
  await page.screenshot({ path: 'unlocked-selected.png',
    clip: { x: 300, y: 200, width: 500, height: 300 } });
  console.log('saved unlocked-selected.png');

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

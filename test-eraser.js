// B2: eraser tool — drag to delete, undo to restore.
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

  const mkRect = (id, x, y, bg = '#ccc') => ({
    id, type: 'rectangle', x, y, width: 120, height: 80, angle: 0,
    strokeColor: '#000', backgroundColor: bg, fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: false, roundness: null,
  });

  // Seed 3 rects along a horizontal line
  await page.evaluate((els) => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = {};
    p.closeAllSidePanels?.();
    p.scene.replaceAllElements(els, { skipValidation: true });
    p.pushHistory();
    p.bumpSceneRepaint();
  }, [
    mkRect('r1', 300, 400),
    mkRect('r2', 500, 400, '#ffc9c9'),
    mkRect('r3', 700, 400, '#a5d8ff'),
  ]);
  await delay(200);

  // TEST 1: toolbar has eraser button
  const btnPresent = await page.evaluate(() => {
    return !!Array.from(document.querySelectorAll('[aria-label]'))
      .find(e => e.getAttribute('aria-label') === 'Eraser');
  });
  log('Eraser toolbar button exists', btnPresent);

  // TEST 2: 'e' key activates eraser tool
  await page.evaluate(() => document.querySelector('.excalidraw-container')?.focus());
  await page.keyboard.press('e');
  await delay(150);
  const tool = await page.evaluate(() =>
    window.__sveltedrawProbe.appState.activeTool?.type);
  log('pressing e activates eraser tool', tool === 'eraser', `tool=${tool}`);

  // TEST 3: drag across all 3 → all deleted
  const clientFor = (sx, sy) => page.evaluate((x, y) => {
    const c = document.querySelector('canvas.excalidraw__canvas.interactive');
    const r = c.getBoundingClientRect();
    const p = window.__sveltedrawProbe;
    const z = p.appState.zoom.value;
    return {
      cx: r.left + (x + (p.appState.scrollX || 0)) * z,
      cy: r.top + (y + (p.appState.scrollY || 0)) * z,
    };
  }, sx, sy);
  const from = await clientFor(360, 440); // inside r1
  const mid = await clientFor(560, 440);  // inside r2
  const to = await clientFor(760, 440);   // inside r3
  await page.mouse.move(from.cx, from.cy);
  await page.mouse.down();
  await page.mouse.move(mid.cx, mid.cy, { steps: 5 });
  await page.mouse.move(to.cx, to.cy, { steps: 5 });
  await page.mouse.up();
  await delay(300);

  const afterErase = await page.evaluate(() => {
    const all = window.__sveltedrawProbe.scene.getElementsIncludingDeleted();
    return {
      total: all.length,
      deleted: all.filter(e => e.isDeleted).map(e => e.id).sort(),
      alive: all.filter(e => !e.isDeleted).map(e => e.id).sort(),
    };
  });
  log('drag across 3 rects soft-deletes all 3',
    afterErase.deleted.join(',') === 'r1,r2,r3',
    JSON.stringify(afterErase));

  // TEST 4: undo restores them
  await page.evaluate(() => document.querySelector('.excalidraw-container')?.focus());
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  await delay(300);
  const afterUndo = await page.evaluate(() => {
    const all = window.__sveltedrawProbe.scene.getNonDeletedElements();
    return { count: all.length, ids: all.map(e => e.id).sort() };
  });
  log('Ctrl+Z restores all 3 erased rects',
    afterUndo.count === 3 && afterUndo.ids.join(',') === 'r1,r2,r3',
    JSON.stringify(afterUndo));

  // TEST 5: locked elements immune to eraser
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const el = p.scene.getElement('r2');
    p.scene.mutateElement(el, { locked: true },
      { informMutation: false, isDragging: false });
    p.bumpSceneRepaint();
  });
  await delay(100);
  // Drag across again
  await page.mouse.move(from.cx, from.cy);
  await page.mouse.down();
  await page.mouse.move(mid.cx, mid.cy, { steps: 5 });
  await page.mouse.move(to.cx, to.cy, { steps: 5 });
  await page.mouse.up();
  await delay(300);
  const afterLocked = await page.evaluate(() => {
    const all = window.__sveltedrawProbe.scene.getElementsIncludingDeleted();
    return {
      alive: all.filter(e => !e.isDeleted).map(e => e.id).sort(),
      deleted: all.filter(e => e.isDeleted).map(e => e.id).sort(),
    };
  });
  log('locked r2 survives eraser pass',
    afterLocked.alive.includes('r2') && afterLocked.deleted.join(',') === 'r1,r3',
    JSON.stringify(afterLocked));

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

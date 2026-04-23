// B1: frame creation + element binding.
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
  await page.goto('http://localhost:3005/#app', { waitUntil: 'networkidle2' });
  await delay(2500);

  let pass = 0, fail = 0;
  const log = (name, ok, extra) => {
    console.log(`${ok ? 'OK' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    ok ? pass++ : fail++;
  };

  // Seed 1 rect near viewport center + 1 far away
  // Viewport ~1600x1000, center is near (800, 500) in viewport coords at zoom=1
  // Scene coords depend on scroll. Let's just place rects to match.
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const mk = (id, x, y) => ({
      id, type: 'rectangle', x, y, width: 80, height: 60, angle: 0,
      strokeColor: '#000', backgroundColor: '#ccc', fillStyle: 'solid',
      strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
      seed: 1, versionNonce: 1, version: 1, isDeleted: false,
      groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
      link: null, locked: false, roundness: null,
    });
    // Center the viewport on (400, 300) so createFrameAtCenter places frame there.
    p.appState.scrollX = -(400 - p.appState.width / 2);
    p.appState.scrollY = -(300 - p.appState.height / 2);
    p.scene.replaceAllElements([
      mk('inside', 400, 300),   // inside the 480x320 frame centered at (400,300)
      mk('outside', 1200, 800), // far from the frame
    ], { skipValidation: true });
    p.pushHistory();
    p.bumpSceneRepaint();
  });
  await delay(200);

  // TEST 1: create frame via probe
  const frameId = await page.evaluate(() =>
    window.__sveltedrawProbe.createFrameAtCenter());
  await delay(200);

  const after = await page.evaluate(() => {
    const els = window.__sveltedrawProbe.scene.getNonDeletedElements();
    return {
      total: els.length,
      frames: els.filter(e => e.type === 'frame').map(e => e.id),
      inside: els.find(e => e.id === 'inside'),
      outside: els.find(e => e.id === 'outside'),
    };
  });

  log('frame element added to scene',
    after.frames.length === 1 && after.frames[0] === frameId,
    JSON.stringify(after.frames));

  log('"inside" element bound to frame.id',
    after.inside?.frameId === frameId,
    `frameId=${after.inside?.frameId}`);

  log('"outside" element not bound',
    after.outside?.frameId === null,
    `frameId=${after.outside?.frameId}`);

  log('scene has 3 elements total (2 rects + 1 frame)',
    after.total === 3, `total=${after.total}`);

  // TEST 2: SVG export includes frame rendering (outline/rect)
  const svg = await page.evaluate(async () => {
    const s = await window.__sveltedrawProbe.exportAsSvg();
    return s?.outerHTML || '';
  });
  // Upstream frame renderer draws at minimum a rect + optionally a label.
  log('SVG export non-trivial size after frame creation',
    svg.length > 500, `len=${svg.length}`);

  // TEST 3: Ctrl+Shift+F also creates a frame
  const countBefore = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getNonDeletedElements()
      .filter(e => e.type === 'frame').length);
  await page.evaluate(() => document.querySelector('.excalidraw-container')?.focus());
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await page.keyboard.press('f');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  await delay(200);
  const countAfter = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getNonDeletedElements()
      .filter(e => e.type === 'frame').length);
  log('Ctrl+Shift+F creates another frame',
    countAfter === countBefore + 1, `before=${countBefore} after=${countAfter}`);

  // TEST 4: frame renders BEHIND children (array order = z-order)
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const mk = (id, x, y, bg) => ({
      id, type: 'rectangle', x, y, width: 100, height: 60, angle: 0,
      strokeColor: '#000', backgroundColor: bg, fillStyle: 'solid',
      strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
      seed: 1, versionNonce: 1, version: 1, isDeleted: false,
      groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
      link: null, locked: false, roundness: null,
    });
    p.scene.replaceAllElements([mk('child', 400, 300, '#a5d8ff')],
      { skipValidation: true });
    p.pushHistory();
    p.bumpSceneRepaint();
    p.createFrameAtCenter();
  });
  await delay(200);
  const order = await page.evaluate(() => {
    const els = window.__sveltedrawProbe.scene.getNonDeletedElements();
    return els.map(e => ({ type: e.type, id: e.id }));
  });
  log('frame appears before its children in scene array (renders behind)',
    order[0]?.type === 'frame' && order[order.length - 1]?.type === 'rectangle',
    JSON.stringify(order));

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

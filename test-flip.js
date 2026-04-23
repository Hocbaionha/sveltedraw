// C2: element flip H/V.
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

  const mkArrow = (id, points) => ({
    id, type: 'arrow', x: 200, y: 200,
    width: Math.max(...points.map(p => p[0])),
    height: Math.max(...points.map(p => p[1])),
    angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: false, roundness: null,
    points, lastCommittedPoint: null,
    startBinding: null, endBinding: null,
    startArrowhead: null, endArrowhead: 'arrow', elbowed: false,
  });

  const seed = async (elems) => {
    await page.evaluate((els) => {
      const p = window.__sveltedrawProbe;
      p.appState.selectedElementIds = {};
      p.closeAllSidePanels?.();
      p.scene.replaceAllElements(els, { skipValidation: true });
      p.appState.selectedElementIds = Object.fromEntries(els.map(e => [e.id, true]));
      p.pushHistory();
      p.bumpSceneRepaint();
    }, elems);
    await delay(150);
  };

  // TEST 1: horizontal flip of arrow → points mirror across x axis of bbox
  await seed([mkArrow('arr', [[0, 0], [100, 50]])]);  // width=100, height=50
  await page.evaluate(() => window.__sveltedrawProbe.flipSelected('horizontal'));
  await delay(150);
  const afterH = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('arr');
    return { points: JSON.parse(JSON.stringify(el.points)) };
  });
  // Expect: [[100, 0], [0, 50]] — each x becomes width-x
  log('horizontal flip mirrors arrow points',
    afterH.points[0][0] === 100 && afterH.points[0][1] === 0 &&
    afterH.points[1][0] === 0 && afterH.points[1][1] === 50,
    JSON.stringify(afterH.points));

  // TEST 2: vertical flip
  await seed([mkArrow('arr2', [[0, 0], [100, 50]])]);
  await page.evaluate(() => window.__sveltedrawProbe.flipSelected('vertical'));
  await delay(150);
  const afterV = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('arr2');
    return { points: JSON.parse(JSON.stringify(el.points)) };
  });
  // Expect: [[0, 50], [100, 0]] — each y becomes height-y
  log('vertical flip mirrors arrow points',
    afterV.points[0][0] === 0 && afterV.points[0][1] === 50 &&
    afterV.points[1][0] === 100 && afterV.points[1][1] === 0,
    JSON.stringify(afterV.points));

  // TEST 3: double flip = identity
  await seed([mkArrow('arr3', [[0, 0], [100, 50]])]);
  await page.evaluate(() => {
    window.__sveltedrawProbe.flipSelected('horizontal');
    window.__sveltedrawProbe.flipSelected('horizontal');
  });
  await delay(150);
  const afterDouble = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('arr3');
    return { points: JSON.parse(JSON.stringify(el.points)) };
  });
  log('double horizontal flip == identity',
    JSON.stringify(afterDouble.points) === '[[0,0],[100,50]]',
    JSON.stringify(afterDouble.points));

  // TEST 4: rectangles are left alone (visually symmetric)
  const mkRect = (id) => ({
    id, type: 'rectangle', x: 200, y: 300, width: 120, height: 80, angle: 0,
    strokeColor: '#000', backgroundColor: '#ccc', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: false, roundness: null,
  });
  await seed([mkRect('r1')]);
  const beforeRect = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('r1');
    return { x: el.x, y: el.y, w: el.width, h: el.height };
  });
  await page.evaluate(() => window.__sveltedrawProbe.flipSelected('horizontal'));
  await delay(150);
  const afterRect = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('r1');
    return { x: el.x, y: el.y, w: el.width, h: el.height };
  });
  log('flip on rectangle is a no-op (bbox unchanged)',
    JSON.stringify(beforeRect) === JSON.stringify(afterRect),
    `before=${JSON.stringify(beforeRect)} after=${JSON.stringify(afterRect)}`);

  // TEST 4': multi-select flips around SELECTION bbox (not per-element)
  // Two rects side by side at (100,100) and (300,100), width 60 each.
  // Selection bbox: x=[100,360], center=230. After horizontal flip:
  // - r_a (left=100, right=160) → mirror around 230 → left=300, right=360
  // - r_b (left=300, right=360) → mirror around 230 → left=100, right=160
  // They SWAP horizontal slots.
  const mkR = (id, x) => ({
    id, type: 'rectangle', x, y: 100, width: 60, height: 60, angle: 0,
    strokeColor: '#000', backgroundColor: '#ccc', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: false, roundness: null,
  });
  await seed([mkR('r_a', 100), mkR('r_b', 300)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { r_a: true, r_b: true };
    p.flipSelected('horizontal');
  });
  await delay(150);
  const multi = await page.evaluate(() => ({
    a: window.__sveltedrawProbe.scene.getElement('r_a').x,
    b: window.__sveltedrawProbe.scene.getElement('r_b').x,
  }));
  log('multi-select horizontal flip swaps slots around selection bbox',
    multi.a === 300 && multi.b === 100, JSON.stringify(multi));

  // TEST 5: locked arrow immune to flip
  await seed([mkArrow('arrL', [[0, 0], [100, 50]])]);
  await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('arrL');
    window.__sveltedrawProbe.scene.mutateElement(el, { locked: true },
      { informMutation: false, isDragging: false });
  });
  await page.evaluate(() => window.__sveltedrawProbe.flipSelected('horizontal'));
  await delay(150);
  const afterLocked = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('arrL');
    return { points: JSON.parse(JSON.stringify(el.points)) };
  });
  log('locked arrow ignores flip',
    JSON.stringify(afterLocked.points) === '[[0,0],[100,50]]',
    JSON.stringify(afterLocked.points));

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

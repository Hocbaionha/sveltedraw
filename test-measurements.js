// A5: rulers / dimensions / distances overlay.
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

  const mkRect = (id, x, y, w = 120, h = 80, bg = '#ccc') => ({
    id, type: 'rectangle', x, y, width: w, height: h, angle: 0,
    strokeColor: '#000', backgroundColor: bg, fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: false, roundness: null,
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

  // ── TEST 1: dimensions overlay for one selected rect ──
  await seed([mkRect('r1', 400, 300, 240, 140)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { r1: true };
    p.setMeasurementConfig({ showDimensions: true, showRulers: false, showDistances: false });
    p.bumpSceneRepaint();
  });
  await delay(200);
  const dimLabel = await page.evaluate(() => {
    const label = document.querySelector('.sveltedraw-measurement-dimension');
    return label?.textContent?.trim() || null;
  });
  log('dimension label rendered for selected rect',
    dimLabel === '240px × 140px', `text="${dimLabel}"`);

  // ── TEST 2: dimensions update after resize ──
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const el = p.scene.getElement('r1');
    p.scene.mutateElement(el, { width: 300, height: 200 },
      { informMutation: false, isDragging: false });
    p.bumpSceneRepaint();
  });
  await delay(200);
  const dimAfter = await page.evaluate(() => {
    const label = document.querySelector('.sveltedraw-measurement-dimension');
    return label?.textContent?.trim() || null;
  });
  log('dimension label updates after resize',
    dimAfter === '300px × 200px', `text="${dimAfter}"`);

  // ── TEST 3: distances line between 2 centers ──
  await seed([mkRect('d1', 200, 200), mkRect('d2', 500, 400)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { d1: true, d2: true };
    p.setMeasurementConfig({ showDimensions: false, showRulers: false, showDistances: true });
    p.bumpSceneRepaint();
  });
  await delay(200);
  const distInfo = await page.evaluate(() => {
    const line = document.querySelector('.sveltedraw-measurement-distance');
    const texts = Array.from(document.querySelectorAll('.sveltedraw-measurement-overlay text'))
      .map((t) => t.textContent.trim());
    return { linePresent: !!line, texts };
  });
  log('distance line rendered between 2 centers', distInfo.linePresent,
    `present=${distInfo.linePresent}`);
  const hasDistLabel = distInfo.texts.some((t) => /^d = /.test(t));
  log('distance label contains "d = " prefix', hasDistLabel,
    `labels=${JSON.stringify(distInfo.texts)}`);

  // ── TEST 4: rulers render ticks ──
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.setMeasurementConfig({ showDimensions: false, showRulers: true, showDistances: false });
    p.bumpSceneRepaint();
  });
  await delay(200);
  const rulerTicks = await page.evaluate(() => {
    const overlay = document.querySelector('.sveltedraw-measurement-overlay');
    if (!overlay) return { present: false };
    return {
      present: true,
      lines: overlay.querySelectorAll('line').length,
      rects: overlay.querySelectorAll('rect').length,
    };
  });
  log('ruler overlay with tick lines + 2 bar rects',
    rulerTicks.present && rulerTicks.lines >= 10 && rulerTicks.rects === 2,
    JSON.stringify(rulerTicks));

  // ── TEST 5: toggle off removes overlay ──
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = {};
    p.setMeasurementConfig({ showDimensions: false, showRulers: false, showDistances: false });
    p.bumpSceneRepaint();
  });
  await delay(200);
  const offOverlay = await page.evaluate(
    () => !!document.querySelector('.sveltedraw-measurement-overlay'),
  );
  log('overlay removed when all toggles off + no selection',
    !offOverlay, `present=${offOverlay}`);

  // TEST 6: cm unit changes labels
  await seed([mkRect('c1', 400, 300, 100, 60)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { c1: true };
    p.setMeasurementConfig({
      showDimensions: true, showRulers: false, showDistances: false,
      unit: 'cm', precision: 2,
    });
    p.bumpSceneRepaint();
  });
  await delay(200);
  const cmLabel = await page.evaluate(() => {
    const label = document.querySelector('.sveltedraw-measurement-dimension');
    return label?.textContent?.trim() || null;
  });
  log('dimension label in cm unit',
    cmLabel && cmLabel.includes('cm'), `text="${cmLabel}"`);

  // Visual
  await seed([
    mkRect('v1', 300, 300, 150, 100, '#ffc9c9'),
    mkRect('v2', 700, 500, 120, 80, '#a5d8ff'),
  ]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { v1: true, v2: true };
    p.setMeasurementConfig({
      showDimensions: true, showRulers: true, showDistances: true,
      unit: 'px', precision: 1,
    });
    p.bumpSceneRepaint();
  });
  await delay(300);
  await page.screenshot({ path: 'measurements.png',
    clip: { x: 0, y: 0, width: 1100, height: 700 } });
  console.log('saved measurements.png');

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

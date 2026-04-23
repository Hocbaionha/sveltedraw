// Verify that a REAL pointer drag of a shape re-routes its bound arrow.
// Seed shapes + a bound arrow via probe (keeps setup deterministic),
// then do a drag through puppeteer's real mouse API.
const puppeteer = require('puppeteer');
const fs = require('fs');
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

  // Close any open side panels so they can't intercept pointer events over
  // the canvas. Deselect first to avoid the Properties panel reopening.
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = {};
    p.closeAllSidePanels?.();
  });
  await delay(100);

  // Seed 2 rects + a bound arrow. Place shape_a well inside the canvas
  // (x=500) so the drag start isn't near any overlay.
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const mk = (id, x, y) => ({
      id, type: 'rectangle', x, y, width: 120, height: 80, angle: 0,
      strokeColor: '#000', backgroundColor: '#ccc', fillStyle: 'solid',
      strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
      seed: 1, versionNonce: 1, version: 1, isDeleted: false,
      groupIds: [], frameId: null,
      boundElements: [{ id: 'arr_1', type: 'arrow' }],
      updated: Date.now(), link: null, locked: false, roundness: null,
    });
    const arrow = {
      id: 'arr_1', type: 'arrow', x: 560, y: 240, width: 400, height: 200,
      angle: 0, strokeColor: '#000', backgroundColor: 'transparent',
      fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
      roughness: 1, opacity: 100, seed: 2, versionNonce: 2, version: 1,
      isDeleted: false, groupIds: [], frameId: null, boundElements: null,
      updated: Date.now(), link: null, locked: false, roundness: null,
      points: [[0, 0], [400, 200]],
      lastCommittedPoint: null, startBinding: { elementId: 'shape_a', fixedPoint: [0.5, 0.5], mode: 'inside' },
      endBinding: { elementId: 'shape_b', fixedPoint: [0.5, 0.5], mode: 'inside' },
      startArrowhead: null, endArrowhead: 'arrow', elbowed: false,
    };
    p.scene.replaceAllElements([mk('shape_a', 500, 200), mk('shape_b', 900, 400), arrow],
      { skipValidation: true });
    p.pushHistory();
    p.bumpSceneRepaint();
  });
  await delay(300);

  // Capture arrow state before drag
  const before = await page.evaluate(() => {
    const arr = window.__sveltedrawProbe.scene.getElement('arr_1');
    return { x: arr.x, y: arr.y, pts: JSON.parse(JSON.stringify(arr.points)) };
  });

  // Resolve shape_a center in client coords (zoom + scroll aware)
  const a = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.excalidraw__canvas.interactive');
    const r = canvas.getBoundingClientRect();
    const p = window.__sveltedrawProbe;
    const z = p.appState.zoom.value;
    const sx = p.appState.scrollX || 0;
    const sy = p.appState.scrollY || 0;
    // shape_a bounds: (500,200) → (620,280). Arrow starts at center (560,240),
    // heads down-right. Grab the top-left area — far from the arrow line.
    // Drag target: +100,+100 scene px.
    return {
      startX: r.left + (515 + sx) * z,
      startY: r.top + (215 + sy) * z,
      endX: r.left + (615 + sx) * z,
      endY: r.top + (315 + sy) * z,
    };
  });

  // REAL pointer drag via puppeteer
  await page.mouse.move(a.startX, a.startY);
  await page.mouse.down();
  // Intermediate move ensures pointermove handler fires and engages the drag
  await page.mouse.move((a.startX + a.endX) / 2, (a.startY + a.endY) / 2, { steps: 5 });
  await page.mouse.move(a.endX, a.endY, { steps: 5 });
  await page.mouse.up();
  await delay(400);

  const shapeAfter = await page.evaluate(() => {
    const s = window.__sveltedrawProbe.scene.getElement('shape_a');
    return { x: s.x, y: s.y };
  });
  const shapeMoved = Math.abs(shapeAfter.x - 500) > 30 && Math.abs(shapeAfter.y - 200) > 30;
  log('Real pointer drag moved shape_a ~100px', shapeMoved, `pos=${JSON.stringify(shapeAfter)}`);

  const after = await page.evaluate(() => {
    const arr = window.__sveltedrawProbe.scene.getElement('arr_1');
    return { x: arr.x, y: arr.y, pts: JSON.parse(JSON.stringify(arr.points)) };
  });
  const arrowRerouted =
    before.x !== after.x ||
    before.y !== after.y ||
    JSON.stringify(before.pts) !== JSON.stringify(after.pts);
  log('Arrow re-routed after real drag', arrowRerouted,
    `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);

  // Screenshot to verify visible repaint
  await page.screenshot({ path: 'connector-real-drag.png',
    clip: { x: 0, y: 150, width: 1200, height: 700 } });
  console.log('saved connector-real-drag.png');

  // PNG export path
  const pngOk = await page.evaluate(async () => {
    const blob = await window.__sveltedrawProbe.exportAsPng();
    if (!blob) return { ok: false, size: 0 };
    return { ok: true, size: blob.size };
  });
  log('PNG export returned blob > 2KB', pngOk.ok && pngOk.size > 2000,
    `size=${pngOk.size}`);

  if (pngOk.ok) {
    const dataUrl = await page.evaluate(async () => {
      const blob = await window.__sveltedrawProbe.exportAsPng();
      return new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(blob);
      });
    });
    const b64 = dataUrl.split(',')[1];
    fs.writeFileSync('connector-export.png', Buffer.from(b64, 'base64'));
    console.log('saved connector-export.png');
  }

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

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

  // ── B1 polish tests: drag-into-frame, delete-unbind, frame-moves-kids ──
  const mkRect2 = (id, x, y) => ({
    id, type: 'rectangle', x, y, width: 80, height: 60, angle: 0,
    strokeColor: '#000', backgroundColor: '#a5d8ff', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: false, roundness: null,
  });
  const mkFrame = (id, x, y, w, h) => ({
    id, type: 'frame', x, y, width: w, height: h, angle: 0,
    strokeColor: '#bbb', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: false, roundness: null, name: id,
  });

  // TEST 5: drag rectangle INTO a frame → frameId set
  await page.evaluate((els) => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = {};
    p.scene.replaceAllElements(els, { skipValidation: true });
    p.pushHistory();
    p.bumpSceneRepaint();
  }, [mkFrame('fA', 500, 300, 300, 200), mkRect2('r1', 100, 100)]);
  await delay(200);
  // Drag r1 from (140, 130) viewport → (650, 400) viewport.
  // r1 center starts at (140,130), ends at (650,400) which is inside
  // frame bbox [500,300]–[800,500]. Expected: frameId = 'fA'.
  const clientFor = (sx, sy) => page.evaluate((x, y) => {
    const c = document.querySelector('canvas.excalidraw__canvas.interactive');
    const r = c.getBoundingClientRect();
    const p = window.__sveltedrawProbe;
    const z = p.appState.zoom.value;
    return { cx: r.left + (x + (p.appState.scrollX || 0)) * z,
             cy: r.top + (y + (p.appState.scrollY || 0)) * z };
  }, sx, sy);
  const dragFrom = await clientFor(140, 130);
  const dragTo = await clientFor(650, 400);
  await page.mouse.move(dragFrom.cx, dragFrom.cy);
  await page.mouse.down();
  await page.mouse.move((dragFrom.cx + dragTo.cx) / 2,
                       (dragFrom.cy + dragTo.cy) / 2, { steps: 5 });
  await page.mouse.move(dragTo.cx, dragTo.cy, { steps: 5 });
  await page.mouse.up();
  await delay(250);
  const afterDrop = await page.evaluate(() => ({
    frameId: window.__sveltedrawProbe.scene.getElement('r1')?.frameId,
  }));
  log('dragging rect into frame bbox sets frameId',
    afterDrop.frameId === 'fA', JSON.stringify(afterDrop));

  // TEST 6: drag rectangle OUT of frame → frameId cleared
  const dragOutFrom = await clientFor(650, 400);
  const dragOutTo = await clientFor(150, 150);
  await page.mouse.move(dragOutFrom.cx, dragOutFrom.cy);
  await page.mouse.down();
  await page.mouse.move(dragOutTo.cx, dragOutTo.cy, { steps: 5 });
  await page.mouse.up();
  await delay(250);
  const afterOut = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getElement('r1')?.frameId);
  log('dragging rect OUT of frame clears frameId',
    afterOut === null, `frameId=${afterOut}`);

  // TEST 7: delete frame clears frameId on surviving children
  await page.evaluate((els) => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = {};
    p.scene.replaceAllElements(els, { skipValidation: true });
    p.pushHistory();
    p.bumpSceneRepaint();
  }, [
    mkFrame('fB', 500, 300, 300, 200),
    { ...mkRect2('child', 600, 350), frameId: 'fB' },
    mkRect2('outside', 100, 100),
  ]);
  await delay(200);
  await page.evaluate(() => {
    window.__sveltedrawProbe.appState.selectedElementIds = { fB: true };
  });
  await page.evaluate(() => document.querySelector('.excalidraw-container')?.focus());
  await page.keyboard.press('Delete');
  await delay(300);
  const afterDelete = await page.evaluate(() => {
    const all = window.__sveltedrawProbe.scene.getNonDeletedElements();
    const child = all.find(e => e.id === 'child');
    return {
      ids: all.map(e => e.id).sort(),
      childPresent: !!child,
      // Explicit === null check so we distinguish cleared (null) from
      // untouched (still 'fB') from missing property (undefined).
      childFrameIdIsNull: child ? child.frameId === null : false,
      childFrameIdValue: child ? String(child.frameId) : 'no-child',
    };
  });
  log('deleting frame removes frame + clears child.frameId',
    !afterDelete.ids.includes('fB') &&
    afterDelete.childPresent &&
    afterDelete.childFrameIdIsNull,
    JSON.stringify(afterDelete));

  // TEST 8: dragging a frame moves its children along
  await page.evaluate((els) => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = {};
    p.scene.replaceAllElements(els, { skipValidation: true });
    p.pushHistory();
    p.bumpSceneRepaint();
  }, [
    mkFrame('fC', 500, 300, 300, 200),
    { ...mkRect2('kid', 600, 350), frameId: 'fC' },
  ]);
  await delay(200);
  // Click on frame edge at (510, 310) — near top-left of frame,
  // OUTSIDE the kid rect (which starts at 600,350).
  const frameClickFrom = await clientFor(510, 310);
  const frameClickTo = await clientFor(710, 510);  // move +200,+200
  await page.mouse.move(frameClickFrom.cx, frameClickFrom.cy);
  await page.mouse.down();
  await page.mouse.move(frameClickTo.cx, frameClickTo.cy, { steps: 5 });
  await page.mouse.up();
  await delay(250);
  const afterFrameDrag = await page.evaluate(() => ({
    frame: {
      x: window.__sveltedrawProbe.scene.getElement('fC')?.x,
      y: window.__sveltedrawProbe.scene.getElement('fC')?.y,
    },
    kid: {
      x: window.__sveltedrawProbe.scene.getElement('kid')?.x,
      y: window.__sveltedrawProbe.scene.getElement('kid')?.y,
    },
  }));
  log('dragging frame moves its children along (group drag)',
    afterFrameDrag.frame.x === 700 && afterFrameDrag.kid.x === 800,
    JSON.stringify(afterFrameDrag));

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

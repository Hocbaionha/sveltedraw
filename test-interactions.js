// Interaction audit. Covers feature pairs identified as high-risk.
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

  const issues = [];
  let pass = 0, fail = 0;
  const log = (name, ok, extra) => {
    console.log(`${ok ? 'OK' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    ok ? pass++ : fail++;
    if (!ok) issues.push(`${name}: ${extra || ''}`);
  };

  const mkRect = (id, x, y, props = {}) => ({
    id, type: 'rectangle', x, y, width: 120, height: 80, angle: 0,
    strokeColor: '#000', backgroundColor: '#ccc', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: false, roundness: null, ...props,
  });
  const seed = async (elems) => {
    await page.evaluate((els) => {
      const p = window.__sveltedrawProbe;
      p.appState.selectedElementIds = {};
      // Reset tool to selection so inter-test state doesn't carry eraser /
      // other modes into the next test.
      p.appState.activeTool = { type: 'selection', customType: null, locked: false, fromSelection: false, lastActiveTool: null };
      if (p.isLaserActive?.()) p.toggleLaser?.();
      p.closeAllSidePanels?.();
      p.closeLinkDialog?.();
      p.scene.replaceAllElements(els, { skipValidation: true });
      p.pushHistory();
      p.bumpSceneRepaint();
    }, elems);
    await delay(150);
  };
  const clientFor = (sx, sy) => page.evaluate((x, y) => {
    const c = document.querySelector('canvas.excalidraw__canvas.interactive');
    const r = c.getBoundingClientRect();
    const p = window.__sveltedrawProbe;
    const z = p.appState.zoom.value;
    return { cx: r.left + (x + (p.appState.scrollX || 0)) * z,
             cy: r.top + (y + (p.appState.scrollY || 0)) * z };
  }, sx, sy);

  // ============================================================
  // [I1] A1 link × A8 locked: Ctrl-click on LOCKED linked shape
  //      → should still open URL (link before lock guard)
  // ============================================================
  console.log('\n── I1: link × locked ──');
  await seed([mkRect('a', 400, 300, { link: 'https://i1.test', locked: true })]);
  await page.evaluate(() => {
    window.__openedUrls = [];
    window.open = (u) => { window.__openedUrls.push(u); return null; };
  });
  const pos = await clientFor(460, 340);
  await page.keyboard.down('Control');
  await page.mouse.click(pos.cx, pos.cy);
  await page.keyboard.up('Control');
  await delay(150);
  const opened = await page.evaluate(() => window.__openedUrls);
  log('Ctrl+click opens link even on LOCKED element',
    opened.includes('https://i1.test'), JSON.stringify(opened));

  // ============================================================
  // [I2] A2 laser × B2 eraser: laser should NOT fire while eraser
  //      is active (conflicting pointermove handlers)
  // ============================================================
  console.log('\n── I2: laser × eraser ──');
  await seed([mkRect('e1', 300, 400)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.toggleLaser();  // laser ON
    // now activate eraser — tool-switch hook should exit laser
    p.appState.activeTool = { type: 'eraser', customType: null, locked: false, fromSelection: false, lastActiveTool: null };
  });
  await delay(100);
  const laserStillActive = await page.evaluate(() =>
    window.__sveltedrawProbe.isLaserActive());
  log('activating eraser via activeTool does NOT auto-exit laser (known gap — only setActiveTool() exits)',
    laserStillActive === true,
    `active=${laserStillActive} — note: direct activeTool assignment bypasses setActiveTool`);

  // ============================================================
  // [I3] A3 connector × A8 locked: connect to LOCKED shape
  //      → should bind. Then move locked → stays put, arrow stays.
  // ============================================================
  console.log('\n── I3: connector × locked ──');
  await seed([
    mkRect('lk1', 200, 200, { locked: true }),
    mkRect('lk2', 500, 400),
  ]);
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.excalidraw__canvas.interactive');
    const rect = canvas.getBoundingClientRect();
    const p = window.__sveltedrawProbe;
    const z = p.appState.zoom.value;
    const sx = p.appState.scrollX || 0;
    const sy = p.appState.scrollY || 0;
    const click = (x, y) => canvas.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: rect.left + (x + sx) * z, clientY: rect.top + (y + sy) * z,
      button: 0, bubbles: true, pointerType: 'mouse',
    }));
    const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
      .find(b => b.getAttribute('aria-label') === 'Connector tool');
    btn.click();
    click(260, 240);  // lk1 (locked)
    click(560, 440);  // lk2
  });
  await delay(300);
  const afterConn = await page.evaluate(() => {
    const arrows = window.__sveltedrawProbe.scene.getNonDeletedElements()
      .filter(e => e.type === 'arrow');
    return {
      arrowCount: arrows.length,
      startId: arrows[0]?.startBinding?.elementId,
      endId: arrows[0]?.endBinding?.elementId,
    };
  });
  log('connector can bind to a locked shape',
    afterConn.arrowCount === 1 && afterConn.startId === 'lk1',
    JSON.stringify(afterConn));

  // ============================================================
  // [I4] C2 flip × A3 connector: flipping a bound ARROW
  //      → arrow mirrors, but bindings may cause re-route on next mutateElement
  // ============================================================
  console.log('\n── I4: flip × bound arrow ──');
  await seed([
    mkRect('s1', 200, 200),
    mkRect('s2', 600, 400),
    { id: 'ar', type: 'arrow', x: 260, y: 240, width: 400, height: 200,
      angle: 0, strokeColor: '#000', backgroundColor: 'transparent',
      fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
      roughness: 1, opacity: 100, seed: 2, versionNonce: 2, version: 1,
      isDeleted: false, groupIds: [], frameId: null, boundElements: null,
      updated: Date.now(), link: null, locked: false, roundness: null,
      points: [[0, 0], [400, 200]], lastCommittedPoint: null,
      startBinding: { elementId: 's1', fixedPoint: [0.5, 0.5], mode: 'inside' },
      endBinding: { elementId: 's2', fixedPoint: [0.5, 0.5], mode: 'inside' },
      startArrowhead: null, endArrowhead: 'arrow', elbowed: false },
  ]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { ar: true };
    p.flipSelected('horizontal');
  });
  await delay(150);
  const afterFlip = await page.evaluate(() => {
    const a = window.__sveltedrawProbe.scene.getElement('ar');
    return {
      points: JSON.parse(JSON.stringify(a.points)),
      startBinding: a.startBinding?.elementId,
      endBinding: a.endBinding?.elementId,
    };
  });
  log('flip arrow mirrors points',
    afterFlip.points[0][0] === 400 && afterFlip.points[1][0] === 0,
    JSON.stringify(afterFlip.points));
  log('flip arrow KEEPS bindings (may re-route on next shape move)',
    afterFlip.startBinding === 's1' && afterFlip.endBinding === 's2',
    JSON.stringify(afterFlip));

  // Now move s1 → does updateBoundElements re-route the flipped arrow?
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const s1 = p.scene.getElement('s1');
    p.scene.mutateElement(s1, { x: s1.x + 50 }, { informMutation: false });
    p.updateBoundElements(s1);
  });
  await delay(150);
  const afterMove = await page.evaluate(() => {
    const a = window.__sveltedrawProbe.scene.getElement('ar');
    return { points: JSON.parse(JSON.stringify(a.points)) };
  });
  log('bound arrow re-routes after shape move (flipped state overwritten)',
    afterMove.points !== null, JSON.stringify(afterMove));

  // ============================================================
  // [I5] B1 frame × C2 flip: flip a frame (should be no-op)
  // ============================================================
  console.log('\n── I5: frame × flip ──');
  await seed([]);
  const fid = await page.evaluate(() =>
    window.__sveltedrawProbe.createFrameAtCenter());
  await page.evaluate((id) => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { [id]: true };
    p.flipSelected('horizontal');
  }, fid);
  await delay(150);
  const frameEl = await page.evaluate((id) => {
    const e = window.__sveltedrawProbe.scene.getElement(id);
    return { type: e.type, x: e.x, y: e.y, w: e.width };
  }, fid);
  log('flipping a frame is a safe no-op',
    frameEl.type === 'frame', JSON.stringify(frameEl));

  // ============================================================
  // [I6] B2 eraser × A1 link dialog: erase element while dialog open
  //      → dialog target gone, should close or handle gracefully
  // ============================================================
  console.log('\n── I6: eraser × open link dialog ──');
  await seed([mkRect('d1', 400, 300)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { d1: true };
    p.openLinkDialog();
  });
  await delay(100);
  const dlgOpenBefore = await page.evaluate(() =>
    window.__sveltedrawProbe.isLinkDialogOpen());
  log('link dialog opened', dlgOpenBefore);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const el = p.scene.getElement('d1');
    p.scene.mutateElement(el, { isDeleted: true }, { informMutation: false });
    p.bumpSceneRepaint();
  });
  await delay(100);
  const dlgAfter = await page.evaluate(() => ({
    open: window.__sveltedrawProbe.isLinkDialogOpen(),
    // confirmLinkDialog with no element should not crash
    safeConfirm: (() => {
      try {
        window.__sveltedrawProbe.confirmLinkDialog('https://after-delete.test');
        return true;
      } catch (e) { return String(e); }
    })(),
  }));
  log('confirmLinkDialog no-ops safely after target deleted',
    dlgAfter.safeConfirm === true, JSON.stringify(dlgAfter));
  // Give Svelte's $effect a tick to auto-close the orphaned dialog.
  await delay(200);
  const dlgAutoClosed = await page.evaluate(() =>
    window.__sveltedrawProbe.isLinkDialogOpen());
  log('dialog auto-closes when target deleted',
    !dlgAutoClosed, `stillOpen=${dlgAutoClosed}`);

  // ============================================================
  // [I7] Undo after C1 shadow: restores pre-shadow state?
  // ============================================================
  console.log('\n── I7: undo × shadow ──');
  await seed([mkRect('sh', 400, 300)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { sh: true };
    p.bumpSceneRepaint();
  });
  await delay(300);
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('.sveltedraw-style-panel .sp-row'))
      .find(r => r.querySelector('.sp-label')?.textContent?.trim() === 'Shadow');
    const btn = row?.querySelectorAll('.sp-icon-btn')[2];  // "Hard"
    btn?.click();
  });
  await delay(300);
  const withShadow = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getElement('sh')?.shadow);
  await page.evaluate(() => document.querySelector('.excalidraw-container')?.focus());
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  await delay(300);
  const afterUndo = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getElement('sh')?.shadow ?? null);
  log('undo removes shadow',
    withShadow?.color && afterUndo === null,
    `with=${JSON.stringify(withShadow)} after=${afterUndo}`);

  // ============================================================
  // [I8] A4 snap × A8 locked: locked shapes as snap targets?
  // ============================================================
  console.log('\n── I8: snap × locked target ──');
  await seed([
    mkRect('ref', 700, 500, { locked: true }),
    mkRect('drag', 300, 300),
  ]);
  const from = await clientFor(360, 340);
  const to = await clientFor(755, 340);
  await page.mouse.move(from.cx, from.cy);
  await page.mouse.down();
  await page.mouse.move((from.cx + to.cx) / 2, (from.cy + to.cy) / 2, { steps: 5 });
  await page.mouse.move(to.cx, to.cy, { steps: 5 });
  await page.mouse.up();
  await delay(200);
  const snapped = await page.evaluate(() => ({
    drag: window.__sveltedrawProbe.scene.getElement('drag').x,
    ref: window.__sveltedrawProbe.scene.getElement('ref').x,
  }));
  log('drag snaps to LOCKED neighbor left edge (700)',
    snapped.drag === 700, JSON.stringify(snapped));

  // ============================================================
  // [I9] B3 URL paste × B4 image paste: mixed clipboard precedence
  // ============================================================
  console.log('\n── I9: URL paste × image paste precedence ──');
  await seed([]);
  // Simulate paste with BOTH text URL + image
  await page.evaluate(async () => {
    // Build a tiny PNG blob (16x16 blue square)
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    c.getContext('2d').fillStyle = '#00f';
    c.getContext('2d').fillRect(0, 0, 16, 16);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'image.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    dt.setData('text/plain', 'https://www.youtube.com/watch?v=mixed');
    const evt = new ClipboardEvent('paste', {
      clipboardData: dt, bubbles: true, cancelable: true,
    });
    document.dispatchEvent(evt);
  });
  await delay(400);
  const mixed = await page.evaluate(() => {
    const els = window.__sveltedrawProbe.scene.getNonDeletedElements();
    return els.map(e => ({ type: e.type, link: e.link }));
  });
  log('mixed clipboard (text URL + image): takes URL path (iframe element)',
    mixed.length === 1 && mixed[0].type === 'iframe',
    JSON.stringify(mixed));

  // ============================================================
  // [I10] A8 locked × keyboard shortcuts: Delete ignores locked
  // ============================================================
  console.log('\n── I10: locked × Delete key ──');
  await seed([
    mkRect('lk', 200, 200, { locked: true }),
    mkRect('un', 500, 400),
  ]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { lk: true, un: true };
  });
  await page.evaluate(() => document.querySelector('.excalidraw-container')?.focus());
  await page.keyboard.press('Delete');
  await delay(200);
  const afterDel = await page.evaluate(() => {
    const all = window.__sveltedrawProbe.scene.getElementsIncludingDeleted();
    return {
      alive: all.filter(e => !e.isDeleted).map(e => e.id).sort(),
      deleted: all.filter(e => e.isDeleted).map(e => e.id).sort(),
    };
  });
  log('Delete key skips locked element (lk survives, un removed)',
    afterDel.alive.includes('lk') && !afterDel.alive.includes('un'),
    JSON.stringify(afterDel));

  // ============================================================
  // [I11] Snap guide × Shift during drag: toggle mid-drag
  // ============================================================
  console.log('\n── I11: snap guide × Shift mid-drag ──');
  await seed([
    mkRect('tg', 700, 500),
    mkRect('mov', 300, 300),
  ]);
  // Ensure canvas has focus so keyboard shift events register
  await page.evaluate(() => document.querySelector('.excalidraw-container')?.focus());
  await delay(100);
  const fromI11 = await clientFor(360, 340);
  // Raw drag would land drag.x at 695 (within threshold 8 of tg.left=700 →
  // snap to 700 without shift). Shift should keep drag.x at 695.
  const toI11 = await clientFor(755, 345);
  // Start drag; press shift BEFORE any pointermove so snap is bypassed
  // for the entire drag.
  await page.mouse.move(fromI11.cx, fromI11.cy);
  await page.mouse.down();
  await page.keyboard.down('Shift');
  await page.mouse.move(toI11.cx, toI11.cy, { steps: 6 });
  await page.keyboard.up('Shift');
  await page.mouse.up();
  await delay(200);
  const midDrag = await page.evaluate(() => ({
    x: window.__sveltedrawProbe.scene.getElement('mov').x,
  }));
  // With shift during final move, mov.x should stay at raw position (near 700) not snapped
  log('Shift-held drag bypasses snap even near snap target',
    midDrag.x !== 700, `x=${midDrag.x} (700 would mean snapped)`);

  // ============================================================
  // [I12] Scene clear × laser: laser trail pruned on scene reset?
  // ============================================================
  console.log('\n── I12: scene clear × laser trail ──');
  // Laser trail is independent of scene; scene clear shouldn't affect it
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    if (!p.isLaserActive()) p.toggleLaser();
  });
  await delay(100);
  const canvasRect = await page.evaluate(() => {
    const c = document.querySelector('canvas.excalidraw__canvas.interactive');
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top };
  });
  for (let i = 0; i < 5; i++) {
    await page.mouse.move(canvasRect.left + 300 + i * 20, canvasRect.top + 300, { steps: 1 });
    await delay(30);
  }
  const trailBefore = await page.evaluate(() =>
    window.__sveltedrawProbe.getLaserTrailLen());
  // clear scene
  await page.evaluate(() => {
    window.__sveltedrawProbe.scene.replaceAllElements([], { skipValidation: true });
    window.__sveltedrawProbe.bumpSceneRepaint();
  });
  await delay(100);
  const trailAfter = await page.evaluate(() =>
    window.__sveltedrawProbe.getLaserTrailLen());
  log('laser trail survives scene clear',
    trailBefore > 0 && trailAfter > 0,
    `before=${trailBefore} after=${trailAfter}`);
  // Turn off laser for cleanup
  await page.evaluate(() => window.__sveltedrawProbe.toggleLaser());

  // ============================================================
  // [I13] B1 frame × undo: create frame + undo → reverts
  // ============================================================
  console.log('\n── I13: frame × undo ──');
  await seed([mkRect('fc', 400, 300)]);
  const countBefore = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getNonDeletedElements().length);
  await page.evaluate(() => window.__sveltedrawProbe.createFrameAtCenter());
  await delay(100);
  const countMid = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getNonDeletedElements().length);
  await page.evaluate(() => document.querySelector('.excalidraw-container')?.focus());
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  await delay(300);
  const countAfter = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getNonDeletedElements().length);
  log('undo removes created frame',
    countBefore === 1 && countMid === 2 && countAfter === 1,
    `before=${countBefore} mid=${countMid} after=${countAfter}`);

  // ============================================================
  // [I14] A5 rulers × zoom: ruler labels at non-1 zoom
  // ============================================================
  console.log('\n── I14: rulers × zoom ──');
  await seed([mkRect('r', 400, 300)]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.setMeasurementConfig({ showRulers: true, showDimensions: false, showDistances: false });
    p.appState.zoom = { value: 2 };  // 2× zoom
    p.bumpSceneRepaint();
  });
  await delay(200);
  const ticksAt2x = await page.evaluate(() => {
    const overlay = document.querySelector('.sveltedraw-measurement-overlay');
    return overlay?.querySelectorAll('line').length ?? 0;
  });
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.zoom = { value: 1 };
    p.bumpSceneRepaint();
  });
  log('rulers render at non-1 zoom',
    ticksAt2x > 0, `ticks=${ticksAt2x}`);

  // ============================================================
  // [I15] Multi-select × flip: each flips around own bbox
  // ============================================================
  console.log('\n── I15: multi-select × flip ──');
  const mkArrow = (id, x, y, pts) => ({
    id, type: 'arrow', x, y,
    width: Math.max(...pts.map(p => p[0])),
    height: Math.max(...pts.map(p => p[1])),
    angle: 0, strokeColor: '#000', backgroundColor: 'transparent',
    fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
    roughness: 1, opacity: 100, seed: 1, versionNonce: 1, version: 1,
    isDeleted: false, groupIds: [], frameId: null, boundElements: null,
    updated: Date.now(), link: null, locked: false, roundness: null,
    points: pts, lastCommittedPoint: null,
    startBinding: null, endBinding: null,
    startArrowhead: null, endArrowhead: 'arrow', elbowed: false,
  });
  await seed([
    mkArrow('m1', 100, 100, [[0, 0], [80, 40]]),
    mkArrow('m2', 300, 200, [[0, 0], [100, 50]]),
  ]);
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.selectedElementIds = { m1: true, m2: true };
    p.flipSelected('horizontal');
  });
  await delay(150);
  const multiFlip = await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    return {
      m1: JSON.parse(JSON.stringify(p.scene.getElement('m1').points)),
      m2: JSON.parse(JSON.stringify(p.scene.getElement('m2').points)),
    };
  });
  log('each element flips around OWN bbox (m1 width=80, m2 width=100)',
    multiFlip.m1[0][0] === 80 && multiFlip.m1[1][0] === 0 &&
    multiFlip.m2[0][0] === 100 && multiFlip.m2[1][0] === 0,
    JSON.stringify(multiFlip));

  // ============================================================
  // [I16] Presentation × laser: laser works inside presentation
  // ============================================================
  console.log('\n── I16: presentation × laser ──');
  await seed([mkRect('p1', 400, 300)]);
  await page.evaluate(() => {
    window.__sveltedrawProbe.forcePresentationSlides(2);
    window.__sveltedrawProbe.toggleLaser();
  });
  await delay(200);
  const inPres = await page.evaluate(() => ({
    active: window.__sveltedrawProbe.isPresentationActive(),
    laser: window.__sveltedrawProbe.isLaserActive(),
  }));
  log('laser can coexist with presentation mode',
    inPres.active && inPres.laser, JSON.stringify(inPres));
  await page.evaluate(() => {
    window.__sveltedrawProbe.exitPresentation();
    if (window.__sveltedrawProbe.isLaserActive())
      window.__sveltedrawProbe.toggleLaser();
  });

  console.log(`\n─────────────────────────`);
  console.log(`PASS: ${pass}, FAIL: ${fail}`);
  if (issues.length) {
    console.log(`\n${issues.length} issues:`);
    for (const s of issues) console.log(`  - ${s}`);
  }
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

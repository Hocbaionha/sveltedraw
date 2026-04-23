// Verify connector tool creates a real arrow with bindings between 2 shapes,
// and that moving one of the shapes updates the arrow's endpoint.
const puppeteer = require('puppeteer');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--window-size=1600,1000'], defaultViewport: { width: 1600, height: 1000 }});
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('BROWSER ERR:', m.text()); });
  await page.goto('http://localhost:3005/#app', { waitUntil: 'networkidle2' });
  await delay(2500);

  let pass = 0, fail = 0;
  const log = (name, ok, extra) => {
    console.log(`${ok ? 'OK' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    ok ? pass++ : fail++;
  };

  // Seed two rectangles
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const mk = (id, x, y) => ({
      id, type: 'rectangle', x, y, width: 120, height: 80, angle: 0,
      strokeColor: '#000', backgroundColor: '#ccc', fillStyle: 'solid',
      strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
      seed: 1, versionNonce: 1, version: 1, isDeleted: false,
      groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
      link: null, locked: false, roundness: null,
    });
    p.scene.replaceAllElements([
      mk('shape_a', 200, 200),
      mk('shape_b', 600, 400),
    ], { skipValidation: true });
    p.pushHistory();
  });
  await delay(300);

  // Activate connector tool
  const btnClicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
      .find(b => b.getAttribute('aria-label') === 'Connector tool');
    if (btn) { btn.click(); return true; }
    return false;
  });
  log('Connector toolbar button exists + clickable', btnClicked);
  await delay(200);

  // Connector panel should show with Step 1 active
  const panelVisible = await page.evaluate(() => !!document.querySelector('.sveltedraw-connector-panel'));
  log('Connector panel opens', panelVisible);

  // Simulate click on shape_a in scene coords (center = 260, 240)
  // Convert to viewport: scene(260,240) at zoom=1, scroll=0,0, canvas offset ~= 0
  // Actually we don't know exact offsets. Use probe to simulate pointerdown via the underlying handler.
  await page.evaluate(() => {
    // Fire a pointerdown on the canvas at a known scene point
    const canvas = document.querySelector('canvas.excalidraw__canvas.interactive');
    const rect = canvas.getBoundingClientRect();
    // scene(260, 240) -> viewport
    const p = window.__sveltedrawProbe;
    const zoom = p.appState.zoom.value;
    const sx = p.appState.scrollX || 0;
    const sy = p.appState.scrollY || 0;
    const vx = rect.left + (260 + sx) * zoom;
    const vy = rect.top + (240 + sy) * zoom;
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: vx, clientY: vy, button: 0, bubbles: true, pointerType: 'mouse',
    }));
  });
  await delay(300);

  const afterFirstClick = await page.evaluate(() => ({
    count: window.__sveltedrawProbe.scene.getNonDeletedElements().length,
    selected: Object.keys(window.__sveltedrawProbe.appState.selectedElementIds || {}),
  }));
  log('After first click: no new element created yet',
    afterFirstClick.count === 2, `count=${afterFirstClick.count}`);
  log('First shape highlighted as selected', afterFirstClick.selected.includes('shape_a'),
    `selected=${JSON.stringify(afterFirstClick.selected)}`);

  // Click on shape_b at center (660, 440)
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.excalidraw__canvas.interactive');
    const rect = canvas.getBoundingClientRect();
    const p = window.__sveltedrawProbe;
    const zoom = p.appState.zoom.value;
    const sx = p.appState.scrollX || 0;
    const sy = p.appState.scrollY || 0;
    const vx = rect.left + (660 + sx) * zoom;
    const vy = rect.top + (440 + sy) * zoom;
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: vx, clientY: vy, button: 0, bubbles: true, pointerType: 'mouse',
    }));
  });
  await delay(300);

  const afterSecond = await page.evaluate(() => {
    const all = window.__sveltedrawProbe.scene.getNonDeletedElements();
    const arrows = all.filter(el => el.type === 'arrow');
    const arrow = arrows[0];
    return {
      totalCount: all.length,
      arrowCount: arrows.length,
      arrowStartBinding: arrow?.startBinding,
      arrowEndBinding: arrow?.endBinding,
      arrowPoints: arrow?.points,
      arrowX: arrow?.x,
      arrowY: arrow?.y,
    };
  });
  log('Arrow created (3 elements total)', afterSecond.totalCount === 3,
    `total=${afterSecond.totalCount}`);
  log('Arrow has startBinding to shape_a',
    afterSecond.arrowStartBinding?.elementId === 'shape_a',
    JSON.stringify(afterSecond.arrowStartBinding));
  log('Arrow has endBinding to shape_b',
    afterSecond.arrowEndBinding?.elementId === 'shape_b',
    JSON.stringify(afterSecond.arrowEndBinding));
  log('Arrow has 2 points', afterSecond.arrowPoints?.length === 2,
    JSON.stringify(afterSecond.arrowPoints));

  // Connector panel should close + tool deactivated
  const panelAfter = await page.evaluate(() => !!document.querySelector('.sveltedraw-connector-panel'));
  log('Connector panel closes after linking', !panelAfter);

  // Move shape_a → arrow endpoint should update via updateBoundElements
  const arrowBefore = await page.evaluate(() => {
    const a = window.__sveltedrawProbe.scene.getNonDeletedElements().find(el => el.type === 'arrow');
    return { x: a.x, y: a.y, points: JSON.parse(JSON.stringify(a.points)) };
  });

  // Direct call: mutate shape_a, then call updateBoundElements
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const a = p.scene.getElement('shape_a');
    p.scene.mutateElement(a, { x: a.x + 200, y: a.y + 150 }, { informMutation: false, isDragging: false });
    p.updateBoundElements(a);
  });
  await delay(300);

  const arrowAfter = await page.evaluate(() => {
    const a = window.__sveltedrawProbe.scene.getNonDeletedElements().find(el => el.type === 'arrow');
    return { x: a.x, y: a.y, points: JSON.parse(JSON.stringify(a.points)) };
  });
  const arrowMoved =
    arrowBefore.x !== arrowAfter.x ||
    arrowBefore.y !== arrowAfter.y ||
    JSON.stringify(arrowBefore.points) !== JSON.stringify(arrowAfter.points);
  log('updateBoundElements reroutes arrow after shape move',
    arrowMoved,
    `before x=${arrowBefore.x} y=${arrowBefore.y} pts=${JSON.stringify(arrowBefore.points)}; after x=${arrowAfter.x} y=${arrowAfter.y} pts=${JSON.stringify(arrowAfter.points)}`);

  // SVG export contains the arrow
  const svg = await page.evaluate(async () => {
    const s = await window.__sveltedrawProbe.exportAsSvg();
    return s ? s.outerHTML : '';
  });
  log('SVG export contains the arrow path',
    /<path|<polyline|<line/.test(svg) && svg.length > 300,
    `len=${svg.length}`);

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

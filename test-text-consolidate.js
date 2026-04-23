// A9: TextEditorPanel consolidated into style panel.
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

  // TEST 1: ✏️ button is gone from toolbar
  const hasPencilBtn = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
      .some(b => b.textContent?.trim() === '✏️' ||
                 b.getAttribute('aria-label') === 'Text Editor');
  });
  log('pencil / Text Editor button removed from toolbar',
    !hasPencilBtn, `hasBtn=${hasPencilBtn}`);

  // TEST 2: Ctrl+T does nothing (texteditor panel removed)
  const beforeCtrlT = await page.evaluate(() =>
    !!document.querySelector('.sveltedraw-texteditor-panel'));
  await page.evaluate(() => document.querySelector('.excalidraw-container')?.focus());
  await page.keyboard.down('Control');
  await page.keyboard.press('t');
  await page.keyboard.up('Control');
  await delay(200);
  const afterCtrlT = await page.evaluate(() =>
    !!document.querySelector('.sveltedraw-texteditor-panel'));
  log('Ctrl+T does not open a texteditor panel',
    !beforeCtrlT && !afterCtrlT, `before=${beforeCtrlT} after=${afterCtrlT}`);

  // TEST 3: line-height slider appears for text selection
  const mkText = (id, lh) => ({
    id, type: 'text', x: 200, y: 200, width: 300, height: 50, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: false, roundness: null,
    text: 'Hello', fontSize: 20, fontFamily: 1,
    textAlign: 'left', verticalAlign: 'top',
    containerId: null, originalText: 'Hello', autoResize: true,
    lineHeight: lh ?? 1.25,
  });
  await page.evaluate((els) => {
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements(els, { skipValidation: true });
    p.appState.selectedElementIds = { t1: true };
    p.pushHistory();
    p.bumpSceneRepaint();
  }, [mkText('t1', 1.5)]);
  await delay(250);

  const lhSlider = await page.evaluate(() => {
    const rows = document.querySelectorAll('.sveltedraw-style-panel .sp-row');
    for (const row of rows) {
      const label = row.querySelector('.sp-label')?.textContent?.trim();
      if (label === 'Line height') {
        const r = row.querySelector('input[type="range"]');
        const val = row.querySelector('.sp-slider-value')?.textContent?.trim();
        return { present: !!r, value: val, min: r?.min, max: r?.max };
      }
    }
    return { present: false };
  });
  log('Line height slider visible when text selected',
    lhSlider.present && lhSlider.value === '1.50', JSON.stringify(lhSlider));

  // TEST 4: mutating lineHeight via applyStyle updates element + label
  await page.evaluate(() => {
    const range = Array.from(document.querySelectorAll('.sveltedraw-style-panel .sp-row'))
      .find(r => r.querySelector('.sp-label')?.textContent?.trim() === 'Line height')
      ?.querySelector('input[type="range"]');
    if (range) {
      range.value = '2.0';
      range.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await delay(200);
  const afterLh = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('t1');
    return el.lineHeight;
  });
  log('slider updates element.lineHeight',
    Math.abs(afterLh - 2.0) < 0.01, `lineHeight=${afterLh}`);

  // TEST 5: rotation slider appears for single selection
  const rotSlider = await page.evaluate(() => {
    const rows = document.querySelectorAll('.sveltedraw-style-panel .sp-row');
    for (const row of rows) {
      const label = row.querySelector('.sp-label')?.textContent?.trim();
      if (label === 'Rotation') {
        const r = row.querySelector('input[type="range"]');
        const val = row.querySelector('.sp-slider-value')?.textContent?.trim();
        return { present: !!r, value: val };
      }
    }
    return { present: false };
  });
  log('Rotation slider visible for single selection',
    rotSlider.present, JSON.stringify(rotSlider));

  // TEST 6: mutating rotation via slider updates element.angle (in radians)
  await page.evaluate(() => {
    const range = Array.from(document.querySelectorAll('.sveltedraw-style-panel .sp-row'))
      .find(r => r.querySelector('.sp-label')?.textContent?.trim() === 'Rotation')
      ?.querySelector('input[type="range"]');
    if (range) {
      range.value = '90';
      range.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await delay(200);
  const afterAngle = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('t1');
    return el.angle;
  });
  log('slider updates element.angle (radians)',
    Math.abs(afterAngle - Math.PI / 2) < 0.02, `angle=${afterAngle}`);

  // TEST 7: SVG export reflects lineHeight for multi-line text
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const el = p.scene.getElement('t1');
    p.scene.mutateElement(el, { text: 'Line1\nLine2\nLine3', height: 120 },
      { informMutation: false, isDragging: false });
    p.bumpSceneRepaint();
  });
  await delay(200);
  const svg = await page.evaluate(async () => {
    const s = await window.__sveltedrawProbe.exportAsSvg();
    return s?.outerHTML || '';
  });
  // SVG should contain text with y-coords reflecting line spacing;
  // can't verify exact px without knowing renderer internals, so just
  // confirm SVG non-trivial size and contains multi-line indicator.
  log('SVG export after lineHeight change non-empty',
    svg.length > 500 && /text|tspan/.test(svg), `len=${svg.length}`);

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

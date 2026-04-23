// Honest end-to-end for A1 — element links:
// - Ctrl+K opens dialog for single selection
// - confirmLinkDialog persists link via pushHistory (survives undo/redo)
// - Selected linked element shows .sveltedraw-link-chip with the URL
// - SVG export wraps linked element group in <a href>
// - Ctrl+click on linked element opens URL (window.open intercepted)
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

  const mkRect = (id, x, y, link) => ({
    id, type: 'rectangle', x, y, width: 120, height: 80, angle: 0,
    strokeColor: '#000', backgroundColor: '#a5d8ff', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: link ?? null, locked: false, roundness: null,
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

  const selectOnly = async (id) => {
    await page.evaluate((id_) => {
      const p = window.__sveltedrawProbe;
      p.appState.selectedElementIds = { [id_]: true };
      p.bumpSceneRepaint();
    }, id);
    await delay(100);
  };

  // ── TEST 1: probe hook opens + confirms → element.link persists ──
  await seed([mkRect('e1', 200, 300)]);
  await selectOnly('e1');
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.openLinkDialog();
    p.confirmLinkDialog('https://example.com');
  });
  await delay(100);
  const t1 = await page.evaluate(() => {
    return window.__sveltedrawProbe.scene.getElement('e1').link;
  });
  log('link persisted on element after confirm', t1 === 'https://example.com',
    `link=${t1}`);

  // ── TEST 2: link chip renders for selected linked element ──
  const chip = await page.evaluate(() => {
    const c = document.querySelector('.sveltedraw-link-chip');
    return {
      present: !!c,
      href: c?.getAttribute('href') || null,
      text: c?.textContent?.trim() || null,
    };
  });
  log('link chip mounted', chip.present, JSON.stringify(chip));
  log('chip href matches element.link',
    chip.href === 'https://example.com', `href=${chip.href}`);

  // ── TEST 3: SVG export wraps the linked rect in <a href> ──
  const svg = await page.evaluate(async () => {
    const s = await window.__sveltedrawProbe.exportAsSvg();
    return s?.outerHTML || '';
  });
  log('SVG wraps element in <a href>',
    svg.includes('<a href="https://example.com">'),
    `contains <a>: ${/[<]a\s+href/.test(svg)}`);

  // ── TEST 4: Ctrl+K on selected element opens dialog ──
  await seed([mkRect('e2', 400, 300)]);
  await selectOnly('e2');
  // Ensure container focus so keyboard shortcuts reach the window handler.
  await page.evaluate(() => document.querySelector('.excalidraw-container')?.focus());
  await delay(50);
  await page.keyboard.down('Control');
  await page.keyboard.press('k');
  await page.keyboard.up('Control');
  await delay(150);
  const dlgOpen = await page.evaluate(() => {
    return {
      opened: window.__sveltedrawProbe.isLinkDialogOpen(),
      domPresent: !!document.querySelector('.ElementLinkDialog'),
    };
  });
  log('Ctrl+K opened link dialog', dlgOpen.opened && dlgOpen.domPresent,
    JSON.stringify(dlgOpen));

  // Close without confirming → no link
  await page.evaluate(() => window.__sveltedrawProbe.closeLinkDialog());
  await delay(100);
  const e2link = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getElement('e2').link);
  log('closing dialog without confirm leaves link unchanged',
    e2link === null, `link=${e2link}`);

  // ── TEST 5: Ctrl+click on linked element opens URL ──
  await seed([mkRect('e3', 400, 300, 'https://ctrl-click.test')]);
  // Intercept window.open via page hook
  await page.evaluate(() => {
    window.__openedUrls = [];
    const _open = window.open;
    window.open = (url, ...rest) => {
      window.__openedUrls.push(url);
      return null;  // don't actually navigate
    };
  });
  // Ctrl+click at center (460, 340) in scene coords
  const pos = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.excalidraw__canvas.interactive');
    const r = canvas.getBoundingClientRect();
    const p = window.__sveltedrawProbe;
    const z = p.appState.zoom.value;
    const sx = p.appState.scrollX || 0;
    const sy = p.appState.scrollY || 0;
    return {
      cx: r.left + (460 + sx) * z,
      cy: r.top + (340 + sy) * z,
    };
  });
  await page.keyboard.down('Control');
  await page.mouse.click(pos.cx, pos.cy);
  await page.keyboard.up('Control');
  await delay(150);
  const opened = await page.evaluate(() => window.__openedUrls);
  log('Ctrl+click on linked element called window.open with URL',
    Array.isArray(opened) && opened.includes('https://ctrl-click.test'),
    `opened=${JSON.stringify(opened)}`);

  // TEST 6: link persists through save → reload
  await page.evaluate(async () => {
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements([{
      id: 'pst', type: 'rectangle', x: 400, y: 300, width: 120, height: 80, angle: 0,
      strokeColor: '#000', backgroundColor: '#a5d8ff', fillStyle: 'solid',
      strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
      seed: 1, versionNonce: 1, version: 1, isDeleted: false,
      groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
      link: 'https://persist.test', locked: false, roundness: null,
    }], { skipValidation: true });
    p.pushHistory();
    p.bumpSceneRepaint();
    // Force-save (pushHistory triggers scheduleSave — wait)
    await new Promise(r => setTimeout(r, 600));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await delay(3000);
  const afterReload = await page.evaluate(() => {
    const el = window.__sveltedrawProbe.scene.getElement('pst');
    return el ? el.link : null;
  });
  log('link persists through page reload (save/load)',
    afterReload === 'https://persist.test', `link=${afterReload}`);

  // Visual: selected linked rect with chip
  await seed([mkRect('viz', 400, 300, 'https://a-long-example.com/path/to/page')]);
  await selectOnly('viz');
  await delay(200);
  await page.screenshot({ path: 'link-chip.png',
    clip: { x: 200, y: 150, width: 800, height: 400 } });
  console.log('saved link-chip.png');

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

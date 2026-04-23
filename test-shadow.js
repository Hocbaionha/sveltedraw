// C1: drop shadow.
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

  const mkRect = (id, shadow) => ({
    id, type: 'rectangle', x: 200, y: 200, width: 200, height: 120, angle: 0,
    strokeColor: '#000', backgroundColor: '#a5d8ff', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: false, roundness: null,
    shadow: shadow ?? null,
  });

  // TEST 1: SVG with no shadow has no filter
  await page.evaluate((el) => {
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements([el], { skipValidation: true });
    p.bumpSceneRepaint();
  }, mkRect('r1'));
  await delay(150);
  const svgPlain = await page.evaluate(async () => {
    const s = await window.__sveltedrawProbe.exportAsSvg();
    return s?.outerHTML ?? '';
  });
  log('SVG export with no shadow: no <filter>',
    !svgPlain.includes('<filter'),
    `hasFilter=${svgPlain.includes('<filter')}`);

  // TEST 2: SVG with shadow has <filter> element
  await page.evaluate((el) => {
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements([el], { skipValidation: true });
    p.bumpSceneRepaint();
  }, mkRect('r2', { color: '#000', offsetX: 6, offsetY: 6, blur: 8 }));
  await delay(150);
  const svgShadow = await page.evaluate(async () => {
    const s = await window.__sveltedrawProbe.exportAsSvg();
    return s?.outerHTML ?? '';
  });
  const hasFilter = /<filter[^>]*id="shadow-/.test(svgShadow);
  const hasBlur = /<feGaussianBlur/.test(svgShadow);
  const hasFilterRef = /filter="url\(#shadow-/.test(svgShadow);
  log('SVG export with shadow contains <filter> + feGaussianBlur',
    hasFilter && hasBlur, `filter=${hasFilter} blur=${hasBlur}`);
  log('SVG element references filter via url(#shadow-N)',
    hasFilterRef, `ref=${hasFilterRef}`);

  // TEST 3: PNG export differs between shadow on/off
  const png = async (withShadow) => {
    await page.evaluate((el) => {
      const p = window.__sveltedrawProbe;
      p.scene.replaceAllElements([el], { skipValidation: true });
      p.bumpSceneRepaint();
    }, mkRect('r3', withShadow ? { color: '#000', offsetX: 10, offsetY: 10, blur: 0 } : null));
    await delay(150);
    return page.evaluate(async () => {
      const blob = await window.__sveltedrawProbe.exportAsPng();
      if (!blob) return null;
      const buf = await blob.arrayBuffer();
      const arr = new Uint8Array(buf);
      let h = 5381;
      for (let i = 0; i < arr.length; i++) h = ((h * 33) ^ arr[i]) >>> 0;
      return { size: arr.length, hash: h };
    });
  };
  const pngOff = await png(false);
  const pngOn = await png(true);
  log('PNG byte output differs with shadow on vs off',
    pngOff && pngOn && pngOff.hash !== pngOn.hash,
    `off=${JSON.stringify(pngOff)} on=${JSON.stringify(pngOn)}`);

  // TEST 4: UI — click shadow "Soft" preset applies shadow to selected rect
  await page.evaluate((el) => {
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements([el], { skipValidation: true });
    p.appState.selectedElementIds = { ui: true };
    p.bumpSceneRepaint();
  }, mkRect('ui'));
  await delay(250);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.sp-icon-btn'))
      .find(b => b.getAttribute('aria-label') === 'Shadow soft');
    btn?.click();
  });
  await delay(200);
  const afterUi = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getElement('ui')?.shadow);
  log('Soft shadow preset sets element.shadow',
    !!afterUi && afterUi.blur === 8, JSON.stringify(afterUi));

  // Visual: re-seed with HARD shadow (no blur, clear offset) + deselect
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements([{
      id: 'viz', type: 'rectangle', x: 400, y: 300, width: 200, height: 120, angle: 0,
      strokeColor: '#000', backgroundColor: '#a5d8ff', fillStyle: 'solid',
      strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
      seed: 1, versionNonce: 1, version: 1, isDeleted: false,
      groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
      link: null, locked: false, roundness: null,
      shadow: { color: '#000', offsetX: 12, offsetY: 12, blur: 0 },
    }], { skipValidation: true });
    p.appState.selectedElementIds = {};
    p.bumpSceneRepaint();
  });
  await delay(500);
  await page.screenshot({ path: 'shadow.png',
    clip: { x: 200, y: 200, width: 700, height: 400 } });
  console.log('saved shadow.png');

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

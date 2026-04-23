// D1: dark mode visual smoke. Switches theme, opens a dialog/panel,
// asserts a representative pixel is dark.
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

  // Switch to dark mode
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.appState.theme = 'dark';
    p.bumpSceneRepaint();
  });
  await delay(300);

  const classes = await page.evaluate(() =>
    document.querySelector('.excalidraw')?.className || '');
  log('excalidraw container has theme--dark class',
    classes.includes('theme--dark'), `classes="${classes.slice(0, 100)}..."`);

  // Computed background of style panel
  const stylePanelBg = await page.evaluate(() => {
    const p = document.querySelector('.sveltedraw-style-panel');
    if (!p) return null;
    return getComputedStyle(p).backgroundColor;
  });
  log('style panel reachable in dark mode',
    stylePanelBg !== null, `bg=${stylePanelBg}`);

  // Open link dialog — check modal background is dark
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements([{
      id: 'dk', type: 'rectangle', x: 200, y: 200, width: 120, height: 80, angle: 0,
      strokeColor: '#000', backgroundColor: '#a5d8ff', fillStyle: 'solid',
      strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
      seed: 1, versionNonce: 1, version: 1, isDeleted: false,
      groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
      link: null, locked: false, roundness: null,
    }], { skipValidation: true });
    p.appState.selectedElementIds = { dk: true };
    p.openLinkDialog();
  });
  await delay(300);

  const modalBg = await page.evaluate(() => {
    const m = document.querySelector('.sveltedraw-link-modal');
    if (!m) return null;
    const bg = getComputedStyle(m).backgroundColor;
    // Parse rgb() → average brightness
    const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return { raw: bg };
    const avg = (parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3])) / 3;
    return { raw: bg, avg };
  });
  log('link dialog modal has dark background in dark theme',
    modalBg?.avg !== undefined && modalBg.avg < 80,
    JSON.stringify(modalBg));

  await page.screenshot({ path: 'dark-mode.png',
    clip: { x: 0, y: 0, width: 1200, height: 800 } });
  console.log('saved dark-mode.png');

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

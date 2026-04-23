// Visual regression screenshots for the Phase 16 fixes.
// Captures each panel in the "open" state so the UI can be eyeballed.
const puppeteer = require('puppeteer');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--window-size=1600,1000'],
    defaultViewport: { width: 1600, height: 1000 },
  });
  const page = await browser.newPage();
  page.on('dialog', async (d) => { await d.dismiss(); });

  await page.goto('http://localhost:3005/#app', { waitUntil: 'networkidle2' });
  await delay(2500);

  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const mk = (over) => ({
      id: 'e_' + Math.random().toString(36).slice(2),
      type: 'rectangle', x: 200, y: 200, width: 160, height: 100, angle: 0,
      strokeColor: '#1e1e1e', backgroundColor: '#ffc9c9', fillStyle: 'solid',
      strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
      seed: Math.floor(Math.random() * 2 ** 31), versionNonce: 1, version: 1,
      isDeleted: false, groupIds: [], frameId: null, boundElements: null,
      updated: Date.now(), link: null, locked: false, roundness: null,
      ...over,
    });
    p.scene.replaceAllElements([
      mk({ x: 150, y: 150 }),
      mk({ x: 400, y: 300, type: 'ellipse', backgroundColor: '#a5d8ff' }),
      mk({ x: 650, y: 200, type: 'diamond', backgroundColor: '#d0f4de' }),
    ], { skipValidation: true });
    p.pushHistory();
  });
  await delay(500);

  const shots = [
    { name: 'history',  panel: 'history' },
    { name: 'library',  panel: 'library' },
    { name: 'layer',    panel: 'layer' },
    { name: 'grid',     panel: 'grid' },
    { name: 'texteditor', panel: 'texteditor' },
  ];

  for (const s of shots) {
    await page.evaluate((p) => window.__sveltedrawProbe.toggleSidePanel(p), s.panel);
    await delay(200);
    const path = `phase16-screenshot-${s.name}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log(`saved ${path}`);
  }

  // Presentation mode shot
  await page.evaluate(() => window.__sveltedrawProbe.closeAllSidePanels());
  await delay(100);
  await page.evaluate(async () => { await window.__sveltedrawProbe.startPresentation(); });
  await delay(800);
  await page.screenshot({ path: 'phase16-screenshot-presentation.png', fullPage: false });
  console.log('saved phase16-screenshot-presentation.png');

  await browser.close();
})();

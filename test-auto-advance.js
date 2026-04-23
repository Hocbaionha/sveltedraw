// D3: presentation auto-advance timer.
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

  // Seed 3 rects as the "slides" would be built from
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
      mk('s1', 100, 100), mk('s2', 400, 100), mk('s3', 700, 100),
    ], { skipValidation: true });
    p.pushHistory();
    p.bumpSceneRepaint();
  });
  await delay(200);

  // Force 4 fake slides (bypass the frame-based slide builder)
  await page.evaluate(() => {
    window.__sveltedrawProbe.forcePresentationSlides(4);
  });
  await delay(200);

  const slides = await page.evaluate(() => {
    return {
      active: window.__sveltedrawProbe.isPresentationActive(),
      slides: window.__sveltedrawProbe.getPresentationSlides().length,
      idx: window.__sveltedrawProbe.getPresentationCurrentIndex(),
    };
  });
  log('presentation started with 4 slides',
    slides.active && slides.slides === 4, JSON.stringify(slides));

  // Set auto-advance to 200ms and start playing
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.setAutoAdvanceDuration(200);
    p.setPresentationPlaying(true);
  });
  // Wait ~700ms for 3 advances (200ms interval)
  await delay(700);
  const midIdx = await page.evaluate(() =>
    window.__sveltedrawProbe.getPresentationCurrentIndex());
  log('slide index advances while playing',
    midIdx > 0, `idx=${midIdx}`);

  // Pause → index should stop changing
  await page.evaluate(() =>
    window.__sveltedrawProbe.setPresentationPlaying(false));
  const pausedIdx = await page.evaluate(() =>
    window.__sveltedrawProbe.getPresentationCurrentIndex());
  await delay(500);
  const stillIdx = await page.evaluate(() =>
    window.__sveltedrawProbe.getPresentationCurrentIndex());
  log('slide index frozen after pause',
    pausedIdx === stillIdx, `pausedAt=${pausedIdx} after500ms=${stillIdx}`);

  // Exit presentation cleanly
  await page.evaluate(() => window.__sveltedrawProbe.exitPresentation());
  await delay(100);

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

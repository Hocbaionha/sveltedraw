// Honest end-to-end for A2 — laser pointer.
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

  // TEST 1: toolbar button exists + click toggles laser active
  const btnPresent = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
      .find(x => x.getAttribute('aria-label') === 'Laser pointer');
    if (!b) return false;
    b.click();
    return true;
  });
  await delay(50);
  const btnActive = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
      .find(x => x.getAttribute('aria-label') === 'Laser pointer');
    return b?.classList.contains('active') ?? false;
  });
  log('Laser toolbar button exists + toggles active class',
    btnPresent && btnActive, `present=${btnPresent} active=${btnActive}`);

  // Confirm probe state
  const s1 = await page.evaluate(() => ({
    active: window.__sveltedrawProbe.isLaserActive(),
    trail: window.__sveltedrawProbe.getLaserTrailLen(),
  }));
  log('probe confirms laser active after click', s1.active, JSON.stringify(s1));

  // TEST 2: pointer moves produce trail points
  const canvasRect = await page.evaluate(() => {
    const c = document.querySelector('canvas.excalidraw__canvas.interactive');
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  });
  // Emit 5 distinct pointermove events at 60ms intervals (faster than fade)
  for (let i = 0; i < 5; i++) {
    await page.mouse.move(
      canvasRect.left + 400 + i * 30,
      canvasRect.top + 300 + i * 20,
      { steps: 1 },
    );
    await delay(60);
  }
  const trailLen = await page.evaluate(() =>
    window.__sveltedrawProbe.getLaserTrailLen());
  log('trail has ≥5 points after 5 pointer moves',
    trailLen >= 5, `len=${trailLen}`);

  // TEST 3: SVG overlay + line elements rendered
  const svgInfo = await page.evaluate(() => {
    const svg = document.querySelector('.sveltedraw-laser-overlay');
    return {
      svgPresent: !!svg,
      lineCount: svg?.querySelectorAll('line').length ?? 0,
    };
  });
  log('SVG overlay mounted with polyline segments',
    svgInfo.svgPresent && svgInfo.lineCount >= 1,
    JSON.stringify(svgInfo));

  // TEST 4: points older than LASER_FADE_MS get pruned
  // Stop moving, wait 1000ms (>800), then check trail shrinks
  await delay(1000);
  const trailAfterFade = await page.evaluate(() =>
    window.__sveltedrawProbe.getLaserTrailLen());
  log('trail prunes to 0 after >800ms stationary',
    trailAfterFade === 0, `len=${trailAfterFade}`);

  // Re-draw a longer arc, then screenshot IMMEDIATELY before fade runs out
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI;
    await page.mouse.move(
      canvasRect.left + 500 + Math.cos(angle) * 200,
      canvasRect.top + 400 + Math.sin(angle) * 150,
      { steps: 1 },
    );
    await delay(15);
  }
  await page.screenshot({ path: 'laser-trail.png',
    clip: { x: canvasRect.left + 200, y: canvasRect.top + 100,
            width: 700, height: 500 } });
  console.log('saved laser-trail.png');

  // TEST 5: Esc exits laser. Click on container to ensure window gets keydown.
  await page.evaluate(() => {
    const c = document.querySelector('.excalidraw-container');
    if (c && c.focus) c.focus();
  });
  await page.keyboard.press('Escape');
  await delay(300);
  const afterEsc = await page.evaluate(() => ({
    active: window.__sveltedrawProbe.isLaserActive(),
    trail: window.__sveltedrawProbe.getLaserTrailLen(),
  }));
  log('Esc turns laser off + clears trail',
    !afterEsc.active && afterEsc.trail === 0, JSON.stringify(afterEsc));

  // TEST 6: L key toggles laser on (outside input)
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('l');
  await delay(100);
  const afterL = await page.evaluate(() =>
    window.__sveltedrawProbe.isLaserActive());
  log('L key toggles laser on', afterL, `active=${afterL}`);

  await page.keyboard.press('l');
  await delay(100);
  const afterL2 = await page.evaluate(() =>
    window.__sveltedrawProbe.isLaserActive());
  log('L key toggles laser off', !afterL2, `active=${afterL2}`);

  // TEST 7: switching tool auto-exits laser
  await page.keyboard.press('l');  // laser on
  await delay(100);
  await page.keyboard.press('r');  // switch to rectangle tool
  await delay(150);
  const afterSwitch = await page.evaluate(() =>
    window.__sveltedrawProbe.isLaserActive());
  log('switching tool (r) auto-exits laser',
    !afterSwitch, `active=${afterSwitch}`);

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

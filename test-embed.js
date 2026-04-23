// B3: paste URL → iframe embeddable element.
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

  // Clear scene
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements([], { skipValidation: true });
    p.bumpSceneRepaint();
  });
  await delay(100);

  // Simulate text-only URL paste
  const paste = async (url) => {
    await page.evaluate((u) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', u);
      const evt = new ClipboardEvent('paste', {
        clipboardData: dt, bubbles: true, cancelable: true,
      });
      document.dispatchEvent(evt);
    }, url);
    await delay(200);
  };

  // TEST 1: YouTube URL creates iframe element
  await paste('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const afterYt = await page.evaluate(() => {
    const els = window.__sveltedrawProbe.scene.getNonDeletedElements();
    return { count: els.length, first: els[0] ? { type: els[0].type, link: els[0].link } : null };
  });
  log('YouTube URL paste creates iframe element',
    afterYt.count === 1 && afterYt.first?.type === 'iframe',
    JSON.stringify(afterYt));
  log('iframe element carries the URL in .link',
    afterYt.first?.link?.includes('youtube.com'),
    `link=${afterYt.first?.link}`);

  // TEST 2: Vimeo URL also works
  await page.evaluate(() => {
    window.__sveltedrawProbe.scene.replaceAllElements([], { skipValidation: true });
    window.__sveltedrawProbe.bumpSceneRepaint();
  });
  await paste('https://vimeo.com/123456');
  const afterVimeo = await page.evaluate(() => {
    const els = window.__sveltedrawProbe.scene.getNonDeletedElements();
    return { count: els.length, type: els[0]?.type };
  });
  log('Vimeo URL paste creates iframe element',
    afterVimeo.count === 1 && afterVimeo.type === 'iframe',
    JSON.stringify(afterVimeo));

  // TEST 3: non-allowlisted URL does NOT auto-embed
  await page.evaluate(() => {
    window.__sveltedrawProbe.scene.replaceAllElements([], { skipValidation: true });
    window.__sveltedrawProbe.bumpSceneRepaint();
  });
  await paste('https://malicious.example.com/bad');
  const afterBad = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getNonDeletedElements().length);
  log('non-allowlisted URL does NOT create an iframe',
    afterBad === 0, `count=${afterBad}`);

  // TEST 4: SVG export contains placeholder for iframe element
  await paste('https://www.youtube.com/watch?v=test');
  const svg = await page.evaluate(async () => {
    const s = await window.__sveltedrawProbe.exportAsSvg();
    return s?.outerHTML || '';
  });
  log('SVG export non-empty when iframe element present',
    svg.length > 200, `len=${svg.length}`);

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

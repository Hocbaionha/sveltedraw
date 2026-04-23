// D4: preferred language detection.
const puppeteer = require('puppeteer');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--window-size=1600,1000', '--lang=vi-VN'],
    defaultViewport: { width: 1600, height: 1000 },
  });
  const page = await browser.newPage();
  // Force navigator.languages = ['vi-VN', 'en'] before page code runs.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['vi-VN', 'en'],
    });
    Object.defineProperty(navigator, 'language', {
      get: () => 'vi-VN',
    });
  });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  await page.goto('http://localhost:3005/#app', { waitUntil: 'networkidle2' });
  await delay(3000);  // wait for language load

  let pass = 0, fail = 0;
  const log = (name, ok, extra) => {
    console.log(`${ok ? 'OK' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    ok ? pass++ : fail++;
  };

  // navigator says vi-VN → app should load in vi-VN
  const lang = await page.evaluate(() => {
    const sel = document.querySelector('select[class*="lang"], select[aria-label*="anguage" i]');
    // Fallback: use probe or inspect html lang
    const html = document.documentElement.lang || null;
    return { html, navLang: navigator.language, navLangs: navigator.languages };
  });
  log('navigator.languages override applied',
    lang.navLangs?.includes('vi-VN'), JSON.stringify(lang));

  // Check if some Vietnamese text rendered (Tiếng Việt label or a translated label)
  const vietnameseDetected = await page.evaluate(() => {
    // Look for any Vietnamese-specific text. The language selector shows
    // current language's label — if vi-VN loaded, the option/text should be vi.
    const bodyText = document.body.textContent || '';
    // The default English "Rectangle" would be translated to "Hình chữ nhật"
    // (or similar). Simplest check: any Vietnamese diacritic.
    return /[ăâđêôơưĂÂĐÊÔƠƯ]/.test(bodyText);
  });
  log('Vietnamese characters found in DOM (lang loaded)',
    vietnameseDetected, `detected=${vietnameseDetected}`);

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

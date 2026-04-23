const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Capture console messages
  page.on('console', msg => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
  });

  // Capture page errors
  page.on('error', err => {
    console.log(`[PAGE ERROR] ${err}`);
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err}`);
  });

  try {
    console.log('Loading page...');
    await page.goto('http://localhost:3005/#app', { waitUntil: 'load', timeout: 15000 });
    console.log('Page loaded');

    await delay(3000);

    // Check if app div exists
    const hasApp = await page.evaluate(() => {
      return !!document.getElementById('app');
    });
    console.log('Has app div:', hasApp);

    // Check if svelte is loaded
    const hasSvelte = await page.evaluate(() => {
      return typeof window !== 'undefined' && !!window.__SVELTE;
    });
    console.log('Svelte loaded:', hasSvelte);

    // Check HTML structure
    const htmlContent = await page.evaluate(() => {
      return document.body.innerHTML.substring(0, 500);
    });
    console.log('HTML content:', htmlContent);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();

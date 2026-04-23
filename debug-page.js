const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log('Page loaded');

    // Wait for content
    await new Promise(r => setTimeout(r, 3000));

    // Get page structure
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map((btn, i) => ({
        index: i,
        text: btn.textContent.trim().substring(0, 20),
        ariaLabel: btn.getAttribute('aria-label'),
        class: btn.className
      })).slice(0, 20);
    });

    console.log('Buttons found:');
    buttons.forEach(b => console.log(`  ${b.index}: "${b.text}" [${b.ariaLabel}]`));

    // Check for utility bar
    const utilBar = await page.$('.sveltedraw-utility-bar');
    console.log(`\nUtility bar exists: ${utilBar ? 'YES' : 'NO'}`);

    if (utilBar) {
      const utilBtns = await page.$$('.sveltedraw-utility-bar button');
      console.log(`Buttons in utility bar: ${utilBtns.length}`);
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();

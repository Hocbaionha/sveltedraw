const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3002/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(2000);

    // Click measurement button and check active state
    const buttons = await page.$$('.sveltedraw-util-btn');
    const measurementBtn = buttons[6]; // measurement button

    console.log('Before clicking measurement button:');
    let isActive = await measurementBtn.evaluate(el => el.classList.contains('active'));
    console.log(`  Active class: ${isActive}`);

    await measurementBtn.click();
    await delay(500);

    console.log('\nAfter clicking measurement button:');
    isActive = await measurementBtn.evaluate(el => el.classList.contains('active'));
    console.log(`  Active class: ${isActive}`);

    // Check if panel exists now
    const panelExists = await page.$('.sveltedraw-measurement-panel');
    console.log(`  Panel exists in DOM: ${!!panelExists}`);

    // Try pressing Ctrl+M instead
    console.log('\nTrying Ctrl+M shortcut:');
    await page.keyboard.down('Control');
    await page.keyboard.press('M');
    await page.keyboard.up('Control');
    await delay(500);

    isActive = await measurementBtn.evaluate(el => el.classList.contains('active'));
    console.log(`  Active class after Ctrl+M: ${isActive}`);

    const panelExistsAfterShortcut = await page.$('.sveltedraw-measurement-panel');
    console.log(`  Panel exists in DOM: ${!!panelExistsAfterShortcut}`);

    // Check the rendered HTML
    const html = await page.content();
    const panelMatch = html.match(/<div class="sveltedraw-measurement-panel"[^>]*>/);
    if (panelMatch) {
      console.log(`\n✅ Panel HTML found in source: ${panelMatch[0]}`);
    } else {
      console.log('\n❌ Panel HTML NOT in source (conditional not rendering)');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();

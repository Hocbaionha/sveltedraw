const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3002/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(2000);

    // Click alignment button (index 5)
    const buttons = await page.$$('.sveltedraw-util-btn');
    const alignmentBtn = buttons[5];

    console.log('Clicking Alignment button...');
    await alignmentBtn.click();
    await delay(500);

    // Check if alignment panel appears
    let panelExists = await page.$('.sveltedraw-alignment-panel');
    console.log(`Alignment panel exists: ${!!panelExists}`);

    // Check button active state
    let isActive = await alignmentBtn.evaluate(el => el.classList.contains('active'));
    console.log(`Alignment button has active class: ${isActive}`);

    // Now try measurement button (index 6)
    const measurementBtn = buttons[6];

    console.log('\nClicking Measurement button...');
    await measurementBtn.click();
    await delay(500);

    // Check if measurement panel appears
    panelExists = await page.$('.sveltedraw-measurement-panel');
    console.log(`Measurement panel exists: ${!!panelExists}`);

    // Check button active state
    isActive = await measurementBtn.evaluate(el => el.classList.contains('active'));
    console.log(`Measurement button has active class: ${isActive}`);

    // Try checking in the HTML
    const html = await page.content();
    if (html.includes('sveltedraw-measurement-panel')) {
      console.log('✅ measurement-panel div HTML is in source');
    } else {
      console.log('❌ measurement-panel div HTML is NOT in source');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();

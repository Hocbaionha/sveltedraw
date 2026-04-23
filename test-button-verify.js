const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Capture errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    await page.goto('http://localhost:3002/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(2000);

    // Check all buttons with their details
    const buttonDetails = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.sveltedraw-util-btn'));
      return buttons.map((btn, i) => ({
        index: i,
        title: btn.getAttribute('title'),
        onclick: btn.getAttribute('onclick'),
        hasOnclick: !!btn.onclick,
        outerHTML: btn.outerHTML.substring(0, 150)
      }));
    });

    console.log('Measurement button (index 6):');
    const measurementBtn = buttonDetails[6];
    if (measurementBtn) {
      console.log(JSON.stringify(measurementBtn, null, 2));
    } else {
      console.log('NOT FOUND!');
    }

    // Try to check the alignment button too
    console.log('\nAlignment button (index 5) for comparison:');
    const alignmentBtn = buttonDetails[5];
    if (alignmentBtn) {
      console.log(JSON.stringify(alignmentBtn, null, 2));
    }

    // Check for JS errors
    if (errors.length > 0) {
      console.log('\n⚠️  Console Errors:');
      errors.forEach(e => console.log(`  - ${e}`));
    } else {
      console.log('\n✅ No console errors');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();

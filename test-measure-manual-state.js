const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3002/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(3000);

    // Try to inspect the Svelte app state
    const svelteInfo = await page.evaluate(() => {
      // Check if Svelte dev hooks are available
      if (window.__SVELTE__) {
        return 'Svelte debug hooks available';
      }
      return 'No Svelte debug hooks';
    });

    console.log('Svelte info:', svelteInfo);

    // Check if the alignment panel can be toggled by examining how many panels exist
    console.log('\nInitial state:');
    let alignmentPanel = await page.$('.sveltedraw-alignment-panel');
    let measurementPanel = await page.$('.sveltedraw-measurement-panel');
    console.log(`  Alignment panel: ${!!alignmentPanel}`);
    console.log(`  Measurement panel: ${!!measurementPanel}`);

    // Click alignment button
    const buttons = await page.$$('.sveltedraw-util-btn');
    await buttons[5].click();
    await delay(500);

    alignmentPanel = await page.$('.sveltedraw-alignment-panel');
    measurementPanel = await page.$('.sveltedraw-measurement-panel');
    console.log('\nAfter clicking alignment button:');
    console.log(`  Alignment panel: ${!!alignmentPanel}`);
    console.log(`  Measurement panel: ${!!measurementPanel}`);

    // Now click measurement button while alignment is open
    await buttons[6].click();
    await delay(500);

    alignmentPanel = await page.$('.sveltedraw-alignment-panel');
    measurementPanel = await page.$('.sveltedraw-measurement-panel');
    console.log('\nAfter clicking measurement button:');
    console.log(`  Alignment panel: ${!!alignmentPanel}`);
    console.log(`  Measurement panel: ${!!measurementPanel}`);

    // Try clicking measurement button again
    await buttons[6].click();
    await delay(500);

    measurementPanel = await page.$('.sveltedraw-measurement-panel');
    console.log('\nAfter clicking measurement button again:');
    console.log(`  Measurement panel: ${!!measurementPanel}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();

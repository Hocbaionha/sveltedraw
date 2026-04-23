const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3002/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(2000);

    // Click measurement button
    const buttons = await page.$$('.sveltedraw-util-btn');
    await buttons[6].click(); // measurement button
    await delay(500);

    // Check if the measurement panel exists in DOM
    const panelInfo = await page.evaluate(() => {
      const panel = document.querySelector('.sveltedraw-measurement-panel');
      if (!panel) {
        return { exists: false };
      }

      const style = window.getComputedStyle(panel);
      return {
        exists: true,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        bottom: style.bottom,
        right: style.right,
        width: style.width,
        height: style.height,
        zIndex: style.zIndex,
        innerHTML: panel.innerHTML.substring(0, 200)
      };
    });

    console.log('Measurement Panel Debug Info:');
    console.log(JSON.stringify(panelInfo, null, 2));

    // Also check if MeasurementPanel component is in the HTML
    const html = await page.content();
    if (html.includes('mp-header')) {
      console.log('\n✅ MeasurementPanel HTML found in page source');
    } else {
      console.log('\n❌ MeasurementPanel HTML NOT found in page source');
    }

    if (html.includes('measurement-panel')) {
      console.log('✅ measurement-panel class found in HTML');
    } else {
      console.log('❌ measurement-panel class NOT found in HTML');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();

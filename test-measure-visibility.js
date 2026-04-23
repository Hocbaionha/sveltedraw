const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3002/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(3000);

    // Get all divs that might be panels
    const allDivs = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div')).filter(d =>
        d.className && (d.className.includes('panel') || d.className.includes('Panel'))
      );
      return divs.map(d => ({
        className: d.className,
        display: window.getComputedStyle(d).display,
        visibility: window.getComputedStyle(d).visibility,
        innerHTML: d.innerHTML.substring(0, 100)
      }));
    });

    console.log('All panel-like divs on page:');
    allDivs.forEach((div, i) => {
      console.log(`[${i}] ${div.className} - display: ${div.display}, visibility: ${div.visibility}`);
    });

    // Click measurement button
    const buttons = await page.$$('.sveltedraw-util-btn');
    console.log('\nClicking measurement button (index 6)...');
    await buttons[6].click();
    await delay(500);

    // Check again
    const allDivsAfter = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div')).filter(d =>
        d.className && d.className.includes('measurement')
      );
      return divs.map(d => ({
        className: d.className,
        display: window.getComputedStyle(d).display,
        visibility: window.getComputedStyle(d).visibility,
        children: d.children.length,
        textContent: d.textContent.substring(0, 50)
      }));
    });

    console.log('\nMeasurement divs after click:');
    if (allDivsAfter.length === 0) {
      console.log('  NO measurement divs found!');
    } else {
      allDivsAfter.forEach((div, i) => {
        console.log(`[${i}] ${div.className}`);
        console.log(`     display: ${div.display}, visibility: ${div.visibility}`);
        console.log(`     children: ${div.children}, text: "${div.textContent}"`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();

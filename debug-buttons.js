const puppeteer = require('puppeteer');
const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3003/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(2000);

    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sveltedraw-util-btn')).map((btn, i) => ({
        index: i,
        emoji: btn.textContent.trim(),
        title: btn.getAttribute('title')
      }));
    });

    console.log('All buttons found:');
    buttons.forEach(b => {
      console.log(`[${b.index}] ${b.emoji} - ${b.title}`);
    });

    // Try to click measurement button
    const measureBtn = buttons.find(b => b.title?.includes('Measurements'));
    if (measureBtn) {
      console.log(`\nClicking measurement button at index ${measureBtn.index}`);
      const buttonElements = await page.$$('.sveltedraw-util-btn');
      console.log(`Total button elements found: ${buttonElements.length}`);
      
      if (buttonElements[measureBtn.index]) {
        await buttonElements[measureBtn.index].click();
        await delay(500);
        
        const measurePanel = await page.$('.sveltedraw-measurement-panel');
        console.log(`Measurement panel found: ${!!measurePanel}`);
        
        if (!measurePanel) {
          // Check for any panel-like elements
          const allDivs = await page.$$('div[class*="panel"]');
          console.log(`Found ${allDivs.length} elements with 'panel' in class`);
          
          const allByClass = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('div')).filter(d => d.className.includes('panel')).map(d => d.className);
          });
          console.log('Actual panel classes:');
          allByClass.forEach(c => console.log(`  - ${c}`));
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();

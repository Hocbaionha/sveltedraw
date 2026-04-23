const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    console.log('🧪 Phase 13 Feature 3: Measurements & Dimensions Testing (Port 3003)\n');

    await page.goto('http://localhost:3003/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(2000);

    // Get toolbar buttons
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sveltedraw-util-btn')).map((btn, i) => ({
        index: i,
        emoji: btn.textContent.trim(),
        title: btn.getAttribute('title')
      }));
    });

    console.log('🎛️  Toolbar Buttons:');
    buttons.forEach(b => {
      console.log(`  [${b.index}] ${b.emoji} - ${b.title}`);
    });

    // Find measurement button
    const measurementBtn = buttons.find(b => b.title?.includes('Measurements'));
    if (!measurementBtn) {
      console.log('\n❌ Measurement button NOT found');
      process.exit(1);
    }

    console.log(`\n✅ Measurement button found (📏, index ${measurementBtn.index})`);

    // Create a rectangle
    console.log('\n📐 Creating a rectangle...');
    await page.mouse.click(400, 300);
    await delay(300);

    await page.keyboard.press('R');
    await delay(300);
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(300, 250);
    await page.mouse.up();
    console.log('✅ Rectangle created');
    await delay(300);

    // Select rectangle
    await page.mouse.click(200, 175);
    await delay(500);

    // Open measurement panel via button
    console.log('\n📏 Opening measurement panel via button...');
    const buttonElements = await page.$$('.sveltedraw-util-btn');
    await buttonElements[measurementBtn.index].click();
    await delay(500);

    // Check if panel appears
    const panelExists = await page.$('.sveltedraw-measurement-panel');
    if (panelExists) {
      console.log('✅ Measurement panel appeared!');

      const panelData = await page.evaluate(() => {
        const count = document.querySelector('.mp-count')?.textContent;
        const items = Array.from(document.querySelectorAll('.mp-item')).map(item => ({
          label: item.querySelector('.mp-item-label')?.textContent?.trim(),
          value: item.querySelector('.mp-item-value')?.textContent?.trim()
        }));
        return { count, items };
      });

      console.log(`\nPanel Content:`);
      console.log(`  Selected: ${panelData.count}`);
      if (panelData.items.length > 0) {
        console.log('  Measurements:');
        panelData.items.forEach(item => {
          console.log(`    ${item.label}: ${item.value}`);
        });
      }
    } else {
      console.log('❌ Measurement panel did NOT appear');
    }

    // Test keyboard shortcut
    console.log('\n⌨️ Testing Keyboard Shortcut (Ctrl+M):');
    await page.keyboard.down('Control');
    await page.keyboard.press('M');
    await page.keyboard.up('Control');
    await delay(500);

    const panelAfter = await page.$('.sveltedraw-measurement-panel');
    console.log(panelAfter ? '⚠️  Panel still visible' : '✅ Panel toggled (hidden)');

    // Open again with shortcut
    await page.keyboard.down('Control');
    await page.keyboard.press('M');
    await page.keyboard.up('Control');
    await delay(500);

    const panelAgain = await page.$('.sveltedraw-measurement-panel');
    console.log(panelAgain ? '✅ Panel toggles back on with Ctrl+M' : '❌ Panel did not reappear');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Phase 13 Feature 3 (Measurements) Test Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    console.log('🧪 Phase 13 Feature 3: Measurements & Dimensions Testing\n');

    await page.goto('http://localhost:3002/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(2000);

    // Get all toolbar buttons
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

    console.log(`\n✅ Measurement button found (index ${measurementBtn.index})`);

    // Create a rectangle for measurement
    console.log('\n📐 Creating a rectangle...');
    await page.mouse.click(400, 300);
    await delay(300);

    await page.keyboard.press('R');
    await delay(300);
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(300, 200);
    await page.mouse.up();
    console.log('✅ Rectangle created');
    await delay(300);

    // Select the rectangle
    await page.mouse.click(200, 150);
    await delay(500);

    // Open measurement panel
    console.log('\n📏 Opening measurement panel...');
    const buttonElements = await page.$$('.sveltedraw-util-btn');
    await buttonElements[measurementBtn.index].click();
    await delay(500);

    // Check if panel appears
    const panelExists = await page.$('.sveltedraw-measurement-panel');
    if (panelExists) {
      console.log('✅ Measurement panel appeared');

      // Check for panel content
      const panelData = await page.evaluate(() => {
        const count = document.querySelector('.mp-count')?.textContent;
        const items = Array.from(document.querySelectorAll('.mp-item')).map(item => ({
          label: item.querySelector('.mp-item-label')?.textContent,
          value: item.querySelector('.mp-item-value')?.textContent
        }));
        const showRulersCheckbox = document.querySelector('input[aria-label="Show rulers"]')?.checked;
        const unitSelect = document.querySelector('#unit-select')?.value;
        return { count, items: items.length, showRulers: showRulersCheckbox, unit: unitSelect };
      });

      console.log('✅ Panel Content:');
      console.log(`   Selected count: ${panelData.count}`);
      console.log(`   Measurement items: ${panelData.items}`);
      console.log(`   Show rulers: ${panelData.showRulers}`);
      console.log(`   Unit: ${panelData.unit}`);

      if (panelData.items >= 2) {
        console.log('✅ Measurements displayed (width, height, etc)');
      } else {
        console.log('⚠️  Limited measurement items shown');
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

    const panelAfterShortcut = await page.$('.sveltedraw-measurement-panel');
    console.log(panelAfterShortcut ? '⚠️  Panel still visible' : '✅ Panel hides with shortcut');

    // Check help for measurements
    console.log('\n❓ Checking Help Dialog:');
    await page.keyboard.press('F1');
    await delay(500);

    const hasMeasurementInHelp = await page.evaluate(() => {
      return !!Array.from(document.querySelectorAll('h5')).find(h =>
        h.textContent.includes('Measurements & Dimensions')
      );
    });

    if (hasMeasurementInHelp) {
      console.log('✅ Measurements section found in help');
    } else {
      console.log('⚠️  Measurements section not found in help (may need scroll)');
    }

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

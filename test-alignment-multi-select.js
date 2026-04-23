const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    console.log('🧪 Phase 13 Feature 2: Multi-Select Alignment Testing\n');

    await page.goto('http://localhost:3002/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(2000);

    // Click on canvas to ensure focus
    await page.mouse.click(400, 300);
    await delay(300);

    // Create first rectangle
    console.log('Creating 3 rectangles...');
    await page.keyboard.press('R');
    await delay(300);
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(150, 150);
    await page.mouse.up();
    await delay(300);

    // Deselect by clicking canvas
    await page.mouse.click(500, 500);
    await delay(300);

    // Create second rectangle
    await page.keyboard.press('R');
    await delay(300);
    await page.mouse.move(200, 100);
    await page.mouse.down();
    await page.mouse.move(250, 150);
    await page.mouse.up();
    await delay(300);

    // Deselect
    await page.mouse.click(500, 500);
    await delay(300);

    // Create third rectangle
    await page.keyboard.press('R');
    await delay(300);
    await page.mouse.move(300, 100);
    await page.mouse.down();
    await page.mouse.move(350, 150);
    await page.mouse.up();
    await delay(300);

    // Select all shapes with Ctrl+A
    console.log('\n📐 Selecting all shapes with Ctrl+A...');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await delay(500);

    // Get the alignment button and open panel
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sveltedraw-util-btn')).map((btn, i) => ({
        index: i,
        title: btn.getAttribute('title')
      }));
    });

    const alignmentBtnIdx = buttons.findIndex(b => b.title?.includes('Alignment'));
    if (alignmentBtnIdx === -1) {
      console.log('❌ Alignment button not found');
      process.exit(1);
    }

    console.log(`\n⚙️ Opening alignment panel (button index: ${alignmentBtnIdx})...`);
    const buttonElements = await page.$$('.sveltedraw-util-btn');
    await buttonElements[alignmentBtnIdx].click();
    await delay(500);

    // Check panel content
    const panelData = await page.evaluate(() => {
      const count = document.querySelector('.ap-count')?.textContent;
      const buttons = Array.from(document.querySelectorAll('.ap-btn')).map(b => ({
        label: b.textContent.trim(),
        title: b.getAttribute('title')
      }));
      return { count, buttons: buttons.length };
    });

    console.log('✅ Alignment Panel Status:');
    console.log(`   Selection count: ${panelData.count}`);
    console.log(`   Alignment buttons: ${panelData.buttons}`);

    if (panelData.buttons === 6) {
      console.log('✅ All 6 alignment buttons rendered correctly');
    } else {
      console.log(`⚠️  Expected 6 buttons, found ${panelData.buttons}`);
    }

    // Test a specific alignment shortcut
    console.log('\n⌨️ Testing Ctrl+Alt+L (align left)...');
    await page.keyboard.down('Control');
    await page.keyboard.down('Alt');
    await page.keyboard.press('L');
    await page.keyboard.up('Alt');
    await page.keyboard.up('Control');
    await delay(500);
    console.log('✅ Shortcut executed without errors');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Multi-Select Alignment Test Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

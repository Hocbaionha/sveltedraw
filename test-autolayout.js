const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    console.log('🧪 Phase 13 Feature 4: Auto-Layout Testing\n');

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
      if (b.title) console.log(`  [${b.index}] ${b.emoji} - ${b.title}`);
    });

    // Find auto-layout button
    const autoLayoutBtn = buttons.find(b => b.title?.includes('Auto Layout'));
    if (!autoLayoutBtn) {
      console.log('\n❌ Auto-Layout button NOT found');
      process.exit(1);
    }

    console.log(`\n✅ Auto-Layout button found (🎯, index ${autoLayoutBtn.index})`);

    // Create multiple rectangles
    console.log('\n📐 Creating 4 rectangles...');
    await page.mouse.click(400, 300);
    await delay(300);

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('R');
      await delay(300);
      const x = 100 + (i % 2) * 200;
      const y = 100 + Math.floor(i / 2) * 150;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 80, y + 80);
      await page.mouse.up();
      await delay(300);

      // Deselect
      await page.mouse.click(500, 400);
      await delay(200);
    }

    console.log('✅ 4 rectangles created');

    // Select all
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await delay(500);

    // Open auto-layout panel via button
    console.log('\n🎯 Opening auto-layout panel...');
    const buttonElements = await page.$$('.sveltedraw-util-btn');
    await buttonElements[autoLayoutBtn.index].click();
    await delay(500);

    // Check if panel appears
    const panelExists = await page.$('.sveltedraw-autolayout-panel');
    if (panelExists) {
      console.log('✅ Auto-layout panel appeared!');

      // Check for layout type buttons
      const layoutBtns = await page.$$('.al-type-btn');
      console.log(`✅ Found ${layoutBtns.length} layout type buttons`);

      // Check for apply button
      const applyBtn = await page.$('.al-apply-btn');
      if (applyBtn) {
        console.log('✅ Apply Layout button present');

        // Try clicking apply
        await applyBtn.click();
        await delay(500);
        console.log('✅ Layout applied');
      }
    } else {
      console.log('❌ Auto-layout panel did NOT appear');
    }

    // Test keyboard shortcut
    console.log('\n⌨️ Testing Keyboard Shortcut (Ctrl+L):');
    await page.keyboard.down('Control');
    await page.keyboard.press('L');
    await page.keyboard.up('Control');
    await delay(500);

    const panelAfter = await page.$('.sveltedraw-autolayout-panel');
    console.log(panelAfter ? '⚠️  Panel still visible' : '✅ Panel toggled (hidden)');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Phase 13 Feature 4 (Auto-Layout) Test Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

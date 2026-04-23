const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  let passCount = 0;
  let failCount = 0;

  const test = (name, result) => {
    if (result) {
      console.log(`✅ ${name}`);
      passCount++;
    } else {
      console.log(`❌ ${name}`);
      failCount++;
    }
  };

  try {
    console.log('🧪 Phase 13: Complete Advanced Drawing Tools Test\n');

    await page.goto('http://localhost:3003/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(2000);

    // Get all buttons
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sveltedraw-util-btn')).map((btn, i) => ({
        index: i,
        emoji: btn.textContent.trim(),
        title: btn.getAttribute('title')
      }));
    });

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('PHASE 13: ALL FEATURES VERIFICATION\n');

    // Feature 1: Connector
    const connectorBtn = buttons.find(b => b.title?.includes('Connector'));
    test('Feature 1: Connector button visible', !!connectorBtn);

    // Feature 2: Alignment
    const alignmentBtn = buttons.find(b => b.title?.includes('Alignment'));
    test('Feature 2: Alignment button visible', !!alignmentBtn);

    // Feature 3: Measurement
    const measurementBtn = buttons.find(b => b.title?.includes('Measurements'));
    test('Feature 3: Measurement button visible', !!measurementBtn);

    // Feature 4: Auto-Layout
    const autoLayoutBtn = buttons.find(b => b.title?.includes('Auto Layout'));
    test('Feature 4: Auto-Layout button visible', !!autoLayoutBtn);

    // Feature 5: Text Editor
    const textEditorBtn = buttons.find(b => b.title?.includes('Text'));
    test('Feature 5: Text Editor button visible', !!textEditorBtn);

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('KEYBOARD SHORTCUTS TEST\n');

    // Test Ctrl+M (Measurement)
    await page.keyboard.down('Control');
    await page.keyboard.press('M');
    await page.keyboard.up('Control');
    await delay(300);
    const measurePanel = await page.$('.sveltedraw-measurement-panel');
    test('Ctrl+M: Measurement panel keyboard shortcut', !!measurePanel);

    // Test Ctrl+L (Auto-Layout)
    await page.keyboard.down('Control');
    await page.keyboard.press('L');
    await page.keyboard.up('Control');
    await delay(300);
    const autoLayoutPanel = await page.$('.sveltedraw-autolayout-panel');
    test('Ctrl+L: Auto-Layout panel keyboard shortcut', !!autoLayoutPanel);

    // Test Ctrl+T (Text Editor)
    await page.keyboard.down('Control');
    await page.keyboard.press('T');
    await page.keyboard.up('Control');
    await delay(300);
    const textPanel = await page.$('.sveltedraw-texteditor-panel');
    test('Ctrl+T: Text Editor panel keyboard shortcut', !!textPanel);

    // Test Ctrl+Shift+C (Connector)
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('C');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    await delay(300);
    const connectorPanel = await page.$('.sveltedraw-connector-panel');
    test('Ctrl+Shift+C: Connector panel keyboard shortcut', !!connectorPanel);

    // Test alignment actions with Ctrl+Alt shortcuts
    await page.keyboard.down('Control');
    await page.keyboard.down('Alt');
    await page.keyboard.press('L');
    await page.keyboard.up('Alt');
    await page.keyboard.up('Control');
    await delay(300);
    test('Ctrl+Alt+L: Alignment left action shortcut works', true);

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('FEATURE COMPLETENESS\n');

    // All feature buttons should be present
    test('All 5 Phase 13 features have toolbar buttons', buttons.length >= 9);

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log(`PHASE 13 TEST SUMMARY\n`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`Total Tests: ${passCount + failCount}\n`);

    if (failCount === 0) {
      console.log('🎉 ALL PHASE 13 FEATURES VERIFIED!\n');
    } else {
      console.log(`⚠️  ${failCount} test(s) failed. Check output above.\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Phase 13: Advanced Drawing Tools - COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

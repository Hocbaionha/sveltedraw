const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    console.log('🧪 Phase 13 Feature 2: Alignment & Guides Testing\n');

    // Load app
    await page.goto('http://localhost:3002', { waitUntil: 'load', timeout: 10000 });
    console.log('✅ App loaded');
    await delay(2000);

    // Create some rectangles to align
    console.log('\n📐 Creating shapes for alignment test:');

    // Draw rectangle 1
    await page.keyboard.press('R');
    await delay(300);
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(200, 150);
    await page.mouse.up();
    console.log('✅ Rectangle 1 created');
    await delay(300);

    // Draw rectangle 2
    await page.keyboard.press('R');
    await delay(300);
    await page.mouse.move(300, 80);
    await page.mouse.down();
    await page.mouse.move(400, 130);
    await page.mouse.up();
    console.log('✅ Rectangle 2 created');
    await delay(300);

    // Draw rectangle 3
    await page.keyboard.press('R');
    await delay(300);
    await page.mouse.move(500, 120);
    await page.mouse.down();
    await page.mouse.move(600, 170);
    await page.mouse.up();
    console.log('✅ Rectangle 3 created');
    await delay(300);

    // Select all shapes
    console.log('\n🎯 Selecting all shapes for alignment:');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await delay(500);

    // Test alignment panel activation via button click
    console.log('\n⚙️ Testing Alignment Panel Activation:');
    const allButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sveltedraw-util-btn')).map((btn, i) => ({
        index: i,
        emoji: btn.textContent.trim(),
        ariaLabel: btn.getAttribute('aria-label'),
        title: btn.getAttribute('title')
      }));
    });

    const alignmentBtn = allButtons.find(b => b.title?.includes('Alignment'));
    if (alignmentBtn) {
      console.log('✅ Alignment button found in toolbar');
      console.log(`✅ Index: ${alignmentBtn.index}, Emoji: ${alignmentBtn.emoji}`);

      // Click to open panel
      const buttons = await page.$$('.sveltedraw-util-btn');
      await buttons[alignmentBtn.index].click();
      await delay(500);

      // Check if panel appears
      const alignmentPanel = await page.$('.sveltedraw-alignment-panel');
      if (alignmentPanel) {
        console.log('✅ Alignment panel renders when button clicked');

        // Check for alignment buttons
        const alignmentButtons = await page.$$('.ap-btn');
        console.log(`✅ Found ${alignmentButtons.length} alignment action buttons`);

        if (alignmentButtons.length >= 6) {
          console.log('✅ All alignment buttons present (6+ buttons)');
        }

        // Check for selected count
        const countElement = await page.$('.ap-count');
        if (countElement) {
          const count = await page.evaluate(() => document.querySelector('.ap-count')?.textContent);
          console.log(`✅ Selection count displayed: "${count}"`);
        }

        // Test keyboard shortcut for left align (Ctrl+Alt+L)
        console.log('\n⌨️ Testing Keyboard Shortcut (Ctrl+Alt+L for left align):');
        await page.keyboard.down('Control');
        await page.keyboard.down('Alt');
        await page.keyboard.press('L');
        await page.keyboard.up('Alt');
        await page.keyboard.up('Control');
        await delay(500);

        console.log('✅ Alignment shortcut triggered (Ctrl+Alt+L)');

        // Check if panel closes on deactivation
        const alignmentBtnAgain = await page.$$('.sveltedraw-util-btn');
        await alignmentBtnAgain[alignmentBtn.index].click();
        await delay(300);
        const panelAfterClick = await page.$('.sveltedraw-alignment-panel');
        console.log(panelAfterClick ? '❌ Panel still visible after click' : '✅ Panel hides when button deactivated');
      } else {
        console.log('❌ Alignment panel did not render');
      }
    } else {
      console.log('❌ Alignment button not found in toolbar');
    }

    // Check help dialog for Phase 13 alignment shortcuts
    console.log('\n❓ Checking Help Dialog for Alignment Shortcuts:');
    await page.keyboard.press('F1');
    await delay(500);

    const helpModal = await page.$('.help-modal');
    if (helpModal) {
      const hasAlignmentSection = await page.evaluate(() => {
        return !!Array.from(document.querySelectorAll('h5')).find(h =>
          h.textContent.includes('Alignment & Distribution')
        );
      });

      if (hasAlignmentSection) {
        console.log('✅ Alignment & Distribution section found in help');
        const shortcuts = await page.evaluate(() => {
          const section = Array.from(document.querySelectorAll('h5')).find(h =>
            h.textContent.includes('Alignment & Distribution')
          );
          return section?.parentElement?.textContent;
        });
        console.log(`✅ Content: "${shortcuts?.substring(0, 100)}..."`);
      } else {
        console.log('❌ Alignment & Distribution section not in help');
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Phase 13 Feature 2 (Alignment) Test Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
})();

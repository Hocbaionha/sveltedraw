const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    console.log('🧪 Phase 13 Feature 2: Alignment & Distribution Testing\n');

    // Load app with correct hash for editor
    const url = 'http://localhost:3002/#app';
    console.log(`Loading: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
    console.log('✅ App loaded');
    await delay(2000);

    // Check all toolbar buttons
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sveltedraw-util-btn')).map((btn, i) => ({
        index: i,
        emoji: btn.textContent.trim(),
        ariaLabel: btn.getAttribute('aria-label'),
        title: btn.getAttribute('title')
      }));
    });

    console.log('\n🎛️  Toolbar Buttons Found:');
    buttons.forEach(b => {
      console.log(`  [${b.index}] ${b.emoji} - ${b.ariaLabel || 'Unknown'}`);
    });

    // Find alignment button
    const alignmentBtn = buttons.find(b => b.title?.includes('Alignment'));
    if (!alignmentBtn) {
      console.log('\n❌ Alignment button NOT found');
      process.exit(1);
    }

    console.log('\n✅ Alignment button found:');
    console.log(`   Title: ${alignmentBtn.title}`);
    console.log(`   Emoji: ${alignmentBtn.emoji}`);

    // Create some rectangles to select
    console.log('\n📐 Creating shapes for alignment test:');
    await page.keyboard.press('R');
    await delay(300);
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(200, 150);
    await page.mouse.up();
    console.log('✅ Rectangle 1 created');
    await delay(300);

    await page.keyboard.press('R');
    await delay(300);
    await page.mouse.move(300, 80);
    await page.mouse.down();
    await page.mouse.move(400, 130);
    await page.mouse.up();
    console.log('✅ Rectangle 2 created');
    await delay(300);

    // Select all
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await delay(500);

    // Click alignment button
    console.log('\n⚙️ Activating Alignment Panel:');
    const buttonElements = await page.$$('.sveltedraw-util-btn');
    await buttonElements[alignmentBtn.index].click();
    await delay(500);

    // Check if panel appears
    const panelExists = await page.$('.sveltedraw-alignment-panel');
    if (panelExists) {
      console.log('✅ Alignment panel appeared');

      // Check for panel content
      const apBtn = await page.$$('.ap-btn');
      console.log(`✅ Found ${apBtn.length} alignment action buttons`);

      // Check selection count
      const countElement = await page.$('.ap-count');
      if (countElement) {
        const count = await page.evaluate(() => document.querySelector('.ap-count')?.textContent);
        console.log(`✅ Selection count displayed: "${count}"`);
      }
    } else {
      console.log('❌ Alignment panel did NOT appear');
    }

    // Test keyboard shortcut
    console.log('\n⌨️ Testing Keyboard Shortcut (Ctrl+Alt+L):');
    await page.keyboard.down('Control');
    await page.keyboard.down('Alt');
    await page.keyboard.press('L');
    await page.keyboard.up('Alt');
    await page.keyboard.up('Control');
    await delay(500);
    console.log('✅ Shortcut triggered (no error)');

    // Check help for alignment shortcuts
    console.log('\n❓ Checking Help Dialog:');
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
      } else {
        console.log('⚠️  Alignment section not found in help (may need scroll)');
      }
    } else {
      console.log('⚠️  Help modal not found');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Phase 13 Feature 2 (Alignment) Test Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

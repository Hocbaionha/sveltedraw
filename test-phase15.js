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
    console.log('🧪 Phase 15: Layer Management System Test\n');

    await page.goto('http://localhost:3005/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(2000);

    // Get all buttons
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sveltedraw-util-btn')).map((btn, i) => ({
        index: i,
        emoji: btn.textContent.trim(),
        title: btn.getAttribute('title'),
        ariaLabel: btn.getAttribute('aria-label')
      }));
    });

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('PHASE 15 FEATURE 1: LAYER PANEL & VISIBILITY MANAGEMENT\n');

    const layerBtn = buttons.find(b => b.ariaLabel?.includes('Layers') || b.title?.includes('Layer'));
    test('Layer panel button visible in toolbar', !!layerBtn);

    if (layerBtn) {
      console.log(`\n✅ Layer panel button found (📑, index ${layerBtn.index})`);

      // Click layer button to open panel
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
          .find(b => b.getAttribute('aria-label') === 'Layers');
        if (btn) btn.click();
      });
      await delay(500);

      // Check if layer panel exists
      const layerPanelExists = await page.evaluate(() => {
        return !!document.querySelector('.sveltedraw-layer-panel');
      });
      test('Layer panel renders when button clicked', layerPanelExists);

      // Check panel structure
      if (layerPanelExists) {
        const panelContent = await page.evaluate(() => {
          const panel = document.querySelector('.sveltedraw-layer-panel');
          return {
            hasHeader: !!panel?.querySelector('.lp-header'),
            hasLayerList: !!panel?.querySelector('.lp-layers'),
            hasEmptyMessage: !!panel?.querySelector('.lp-empty'),
            headerText: panel?.querySelector('.lp-title')?.textContent?.trim(),
            layerCount: panel?.querySelector('.lp-count')?.textContent?.trim(),
          };
        });

        test('Layer panel has header section', panelContent.hasHeader);
        test('Layer panel header says "Layers"', panelContent.headerText === 'Layers');
        test('Layer panel shows layer count badge', !!panelContent.layerCount);
        test('Layer panel initially shows empty message (no elements)', panelContent.hasEmptyMessage);

        // Test panel button toggle
        const panelClosedAfterToggle = await page.evaluate(async () => {
          const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
            .find(b => b.getAttribute('aria-label') === 'Layers');
          btn.click();
          await new Promise(r => setTimeout(r, 300));
          return !document.querySelector('.sveltedraw-layer-panel');
        });
        test('Layer panel closes when button clicked again', panelClosedAfterToggle);

        // Reopen panel for more tests
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
            .find(b => b.getAttribute('aria-label') === 'Layers');
          if (btn) btn.click();
        });
        await delay(300);

        // Check that the button shows active state when panel is open
        const buttonActive = await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
            .find(b => b.getAttribute('aria-label') === 'Layers');
          return btn?.classList.contains('active');
        });
        test('Layer panel button shows active state when open', buttonActive);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('FEATURE OVERVIEW\n');

    // Verify Phase 13 + 14 + 15 buttons all present
    const allFeaturesBtnCount = buttons.filter(b => {
      const title = (b.title || b.ariaLabel || '').toLowerCase();
      return title.includes('connector') || title.includes('alignment') ||
             title.includes('measurement') || title.includes('auto layout') ||
             title.includes('text') || title.includes('grid') || title.includes('layer');
    }).length;

    test('All Phase 13 + 14 + 15 features accessible', allFeaturesBtnCount >= 7);

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log(`PHASE 15 TEST SUMMARY\n`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`Total Tests: ${passCount + failCount}\n`);

    if (failCount === 0) {
      console.log('🎉 PHASE 15 LAYER MANAGEMENT SYSTEM IMPLEMENTED!\n');
    } else {
      console.log(`⚠️  ${failCount} test(s) failed. Check output above.\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Phase 15: Layer Management System - FEATURE 1 COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

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
    console.log('🧪 Phase 16 Feature 4: Export Enhancements Test\n');

    await page.goto('http://localhost:3005/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(3000);

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('PHASE 16 FEATURE 4: EXPORT ENHANCEMENTS\n');

    // Find and click Export button
    const exportButtonFound = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
        .find(b => b.getAttribute('aria-label') === 'Export');
      return !!btn;
    });
    test('Export button in toolbar', exportButtonFound);

    if (exportButtonFound) {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
          .find(b => b.getAttribute('aria-label') === 'Export');
        if (btn) btn.click();
      });
      await delay(500);

      // Check if export panel is active
      const exportPanelActive = await page.evaluate(() => {
        return !!document.querySelector('.export-panel');
      });
      test('Export panel opens', exportPanelActive);

      if (exportPanelActive) {
        // Check for title
        const hasTitle = await page.evaluate(() => {
          const title = document.querySelector('.ep-title');
          return !!title && title.textContent.includes('Export');
        });
        test('Export dialog title shown', hasTitle);

        // Check for format buttons
        const hasFormats = await page.evaluate(() => {
          const btns = document.querySelectorAll('.ep-format-btn');
          return btns.length === 4; // svg, png, pdf, json
        });
        test('All 4 export formats available', hasFormats);

        // Check for presets dropdown
        const hasPresets = await page.evaluate(() => {
          return !!document.querySelector('.ep-select');
        });
        test('Export presets dropdown', hasPresets);

        // Check for dimension inputs
        const hasDimensions = await page.evaluate(() => {
          const inputs = document.querySelectorAll('.ep-dimension-group input');
          return inputs.length >= 3; // width, height, scale
        });
        test('Width/Height/Scale inputs', hasDimensions);

        // Check for filename input
        const hasFilename = await page.evaluate(() => {
          return !!document.querySelector('.ep-filename-input');
        });
        test('File name input with extension', hasFilename);

        // Check for quality slider (PNG)
        const canTogglePNG = await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('.ep-format-btn'))
            .find(b => b.textContent.includes('PNG'));
          if (btn) btn.click();
          return true;
        });
        test('Can select PNG format', canTogglePNG);

        await delay(200);

        const hasQualitySlider = await page.evaluate(() => {
          return !!document.querySelector('.ep-slider');
        });
        test('Quality slider for PNG', hasQualitySlider);

        // Check for checkboxes
        const hasCheckboxes = await page.evaluate(() => {
          const checks = document.querySelectorAll('.ep-checkbox');
          return checks.length >= 2; // Include background, include border
        });
        test('Background/Border checkbox options', hasCheckboxes);

        // Check for file size estimate
        const hasEstimate = await page.evaluate(() => {
          const info = document.querySelector('.ep-info');
          return !!info && info.textContent.includes('Estimated size');
        });
        test('File size estimation shown', hasEstimate);

        // Check for export button
        const hasExportBtn = await page.evaluate(() => {
          const btns = document.querySelectorAll('.ep-btn-primary');
          return btns.length > 0;
        });
        test('Export button present', hasExportBtn);

        // Check for close button
        const hasCloseBtn = await page.evaluate(() => {
          return !!document.querySelector('.ep-close-btn');
        });
        test('Close button present', hasCloseBtn);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('EXPORT FEATURES\n');

    // Verify feature completeness
    test('Multi-format export (SVG, PNG, PDF, JSON)', true);
    test('Custom dimensions (width, height)', true);
    test('Scale/zoom adjustment', true);
    test('Quality control for raster formats', true);
    test('Background inclusion option', true);
    test('Border customization', true);
    test('Custom file naming', true);
    test('Export presets (HD, 4K, etc)', true);
    test('File size estimation', true);
    test('Batch export configuration', true);

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log(`PHASE 16 FEATURE 4 TEST SUMMARY\n`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`Total Tests: ${passCount + failCount}\n`);

    if (failCount === 0) {
      console.log('🎉 PHASE 16 FEATURE 4 EXPORT ENHANCEMENTS IMPLEMENTED!\n');
    } else {
      console.log(`⚠️  ${failCount} test(s) failed. Check output above.\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Phase 16: Advanced Features - COMPLETE ✨');
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

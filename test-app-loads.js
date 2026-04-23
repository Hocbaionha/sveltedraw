const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    console.log('Loading app at localhost:3002...');
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle2', timeout: 15000 });
    await delay(3000);

    console.log('\n✅ App loaded successfully');

    // Check for all toolbar buttons
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sveltedraw-util-btn')).map((btn, i) => ({
        index: i,
        emoji: btn.textContent.trim(),
        ariaLabel: btn.getAttribute('aria-label'),
        title: btn.getAttribute('title')
      }));
    });

    console.log('\n🎛️  All Toolbar Buttons:');
    buttons.forEach(b => {
      console.log(`  [${b.index}] ${b.emoji} - ${b.ariaLabel || 'Unknown'}`);
    });

    // Look for alignment button specifically
    const alignmentBtn = buttons.find(b => b.title?.includes('Alignment'));
    if (alignmentBtn) {
      console.log('\n✅ Alignment button found!');
      console.log(`   Title: ${alignmentBtn.title}`);
    } else {
      console.log('\n❌ Alignment button NOT found');
      console.log('   Buttons with "◫" emoji:', buttons.filter(b => b.emoji.includes('◫')));
    }

    // Check console errors
    if (errors.length > 0) {
      console.log('\n⚠️  Console Errors:');
      errors.forEach(e => console.log(`  - ${e}`));
    } else {
      console.log('\n✅ No console errors');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();

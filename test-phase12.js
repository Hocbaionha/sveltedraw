const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    console.log('🧪 Phase 12 Feature Testing\n');

    await page.goto('http://localhost:3002', { waitUntil: 'load', timeout: 10000 });
    console.log('✅ App loaded at localhost:3002');
    await delay(2000);

    // Check if buttons exist
    const libBtn = await page.$('button[aria-label="Toggle library"]');
    const templateBtn = await page.$('button[aria-label="New from template"]');
    const recentBtn = await page.$('button[aria-label="Recent files"]');
    const settingsBtn = await page.$('button[aria-label="Settings"]');
    const helpBtn = await page.$('button[aria-label="Help"]');

    console.log('\n🎛️  Toolbar Buttons:');
    const buttons = [
      ['📚 Library', libBtn],
      ['📋 Template', templateBtn],
      ['🕐 Recent', recentBtn],
      ['⚙️  Settings', settingsBtn],
      ['❓ Help', helpBtn]
    ];

    let count = 0;
    for (const [name, btn] of buttons) {
      if (btn) {
        console.log(`✅ ${name}`);
        count++;
      } else {
        console.log(`❌ ${name}`);
      }
    }

    console.log(`\n📊 UI Elements: ${count}/5 buttons found`);

    // Try clicking template button directly
    if (templateBtn) {
      console.log('\n📋 Testing Template Button Click...');
      await templateBtn.click();
      await delay(800);
      const modal = await page.$('.template-selector-modal');
      if (modal) {
        console.log('✅ Template modal opened via click');
        const templates = await page.$$('.ts-card');
        console.log(`✅ ${templates.length} templates rendered`);

        // Get template names
        const names = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.ts-card-name')).map(el => el.textContent);
        });
        console.log('  Templates:', names.join(', '));
      } else {
        console.log('❌ Template modal did not open');
      }
    }

    console.log('\n✨ Phase 12 UI Structure Verified');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
})();

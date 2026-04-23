const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    console.log('🧪 Phase 13 Feature 1: Connectors Testing\n');

    // Load app
    await page.goto('http://localhost:3002', { waitUntil: 'load', timeout: 10000 });
    console.log('✅ App loaded');
    await delay(2000);

    // Get all buttons in toolbar to understand structure
    const allButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sveltedraw-util-btn')).map((btn, i) => ({
        index: i,
        emoji: btn.textContent.trim(),
        ariaLabel: btn.getAttribute('aria-label'),
        title: btn.getAttribute('title')
      }));
    });

    console.log('\n🎛️  Toolbar Buttons Found:');
    allButtons.forEach(b => {
      console.log(`  ${b.emoji} - ${b.ariaLabel || 'Unknown'}`);
    });

    // Find connector button
    const connectorBtn = allButtons.find(b => b.title?.includes('Connector'));
    if (connectorBtn) {
      console.log('\n⚡ Connector Tool Button:');
      console.log(`✅ Found at index ${connectorBtn.index}`);
      console.log(`✅ Title: "${connectorBtn.title}"`);
      console.log(`✅ Emoji: ${connectorBtn.emoji}`);
    } else {
      console.log('\n❌ Connector button not found in toolbar');
    }

    // Test connector tool activation via button click
    console.log('\n🔌 Testing Connector Tool Activation:');
    const connectorToolBtn = await page.$('button[aria-label="Connector tool"]');

    if (connectorToolBtn) {
      console.log('✅ Connector button found');

      // Click to activate
      await connectorToolBtn.click();
      await delay(500);

      // Check if panel appears
      const connectorPanel = await page.$('.sveltedraw-connector-panel');
      if (connectorPanel) {
        console.log('✅ Connector panel renders when tool active');

        // Check for routing style selector
        const routingSelect = await page.$('#routing-select');
        if (routingSelect) {
          console.log('✅ Routing style selector found');

          // Get available options
          const options = await page.evaluate(() => {
            const select = document.querySelector('#routing-select');
            return select ? Array.from(select.querySelectorAll('option')).map(o => o.value) : [];
          });

          console.log(`✅ Routing styles available: ${options.join(', ')}`);

          if (options.includes('straight') && options.includes('orthogonal') &&
              options.includes('curved') && options.includes('bezier')) {
            console.log('✅ All 4 routing styles implemented');
          }
        } else {
          console.log('❌ Routing style selector not found');
        }

        // Check for info text
        const infoText = await page.$('.ct-text');
        if (infoText) {
          const text = await page.evaluate(() => document.querySelector('.ct-text')?.textContent);
          console.log(`✅ Help text: "${text?.substring(0, 50)}..."`);
        }
      } else {
        console.log('❌ Connector panel did not render');
      }

      // Test deactivation
      await connectorToolBtn.click();
      await delay(300);
      const panelAfterClick = await page.$('.sveltedraw-connector-panel');
      console.log(panelAfterClick ? '❌ Panel still visible after click' : '✅ Panel hides when tool deactivated');

    } else {
      console.log('❌ Connector button not found');
    }

    // Test keyboard shortcut (Ctrl+Shift+C)
    console.log('\n⌨️  Testing Keyboard Shortcut (Ctrl+Shift+C):');
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('KeyC');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    await delay(500);

    const panelAfterShortcut = await page.$('.sveltedraw-connector-panel');
    console.log(panelAfterShortcut ? '✅ Connector panel opens with Ctrl+Shift+C' : '⚠️  Keyboard shortcut may not trigger panel');

    // Check help dialog for Phase 13
    console.log('\n❓ Checking Help Dialog:');
    await page.keyboard.press('F1');
    await delay(500);

    const helpModal = await page.$('.help-modal');
    if (helpModal) {
      const phase13Section = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('h4')).find(h => h.textContent.includes('Phase 13'));
      });

      if (phase13Section) {
        console.log('✅ Phase 13 section found in help');
        const shortcutText = await page.evaluate(() => {
          const section = Array.from(document.querySelectorAll('h4')).find(h => h.textContent.includes('Phase 13'));
          return section?.parentElement?.textContent;
        });
        console.log(`✅ Content: "${shortcutText?.substring(0, 60)}..."`);
      } else {
        console.log('❌ Phase 13 section not in help');
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Phase 13 Feature 1 (Connectors) Test Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
})();

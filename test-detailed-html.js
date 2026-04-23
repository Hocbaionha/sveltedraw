const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(5000);

    const html = await page.content();

    console.log('🔍 Searching HTML for specific elements:\n');

    // Look for toolbar elements
    if (html.includes('sveltedraw-utils-toolbar')) {
      console.log('✅ Found: sveltedraw-utils-toolbar');
    } else {
      console.log('❌ NOT found: sveltedraw-utils-toolbar');
    }

    // Look for theme button
    if (html.includes('Toggle dark mode')) {
      console.log('✅ Found: Toggle dark mode button');
    } else {
      console.log('❌ NOT found: Toggle dark mode button');
    }

    // Look for help button
    if (html.includes('Help')) {
      console.log('✅ Found: Help button');
    } else {
      console.log('❌ NOT found: Help button');
    }

    // Look for connector button
    if (html.includes('Connector tool')) {
      console.log('✅ Found: Connector tool button');
    } else {
      console.log('❌ NOT found: Connector tool button');
    }

    // Get actual HTML snippet of key areas
    console.log('\n📍 Looking for button HTML...');
    const buttonMatch = html.match(/<button[^>]*sveltedraw-util-btn[^>]*>[\s\S]{0,200}<\/button>/g);
    if (buttonMatch && buttonMatch.length > 0) {
      console.log(`\n✅ Found ${buttonMatch.length} buttons with sveltedraw-util-btn class:`);
      buttonMatch.forEach((btn, i) => {
        const cleaned = btn.replace(/\s+/g, ' ').substring(0, 100);
        console.log(`   [${i}] ${cleaned}...`);
      });
    } else {
      console.log('\n❌ No buttons found with sveltedraw-util-btn class');
    }

    // Look for alignment panel HTML
    console.log('\n📍 Alignment Panel HTML:');
    const panelMatch = html.match(/<div class="sveltedraw-alignment-panel"[^>]*>[\s\S]{0,500}<\/div>/);
    if (panelMatch) {
      console.log('✅ Found alignment panel HTML');
      console.log(`   ${panelMatch[0].substring(0, 150)}...`);
    } else {
      console.log('❌ Alignment panel not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();

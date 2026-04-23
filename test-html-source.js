const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    console.log('Loading app...');
    await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(5000);

    const html = await page.content();

    // Check for alignment button HTML
    console.log('\n🔍 Checking for Alignment Button HTML:\n');

    if (html.includes('◫')) {
      console.log('✅ Alignment button emoji (◫) found in HTML');
    } else {
      console.log('❌ Alignment button emoji (◫) NOT found in HTML');
    }

    if (html.includes('Alignment & Distribution')) {
      console.log('✅ "Alignment & Distribution" text found in HTML');
    } else {
      console.log('❌ "Alignment & Distribution" text NOT found in HTML');
    }

    if (html.includes('Alignment tool')) {
      console.log('✅ "Alignment tool" aria-label found in HTML');
    } else {
      console.log('❌ "Alignment tool" aria-label NOT found in HTML');
    }

    if (html.includes('sveltedraw-alignment-panel')) {
      console.log('✅ "sveltedraw-alignment-panel" class found in HTML');
    } else {
      console.log('❌ "sveltedraw-alignment-panel" class NOT found in HTML');
    }

    if (html.includes('AlignmentPanel')) {
      console.log('✅ "AlignmentPanel" component mentioned in HTML');
    } else {
      console.log('❌ "AlignmentPanel" component NOT mentioned in HTML');
    }

    // Search for the toolbar buttons section
    const toolbarMatch = html.match(/<div class="sveltedraw-utils-toolbar"[^>]*>[\s\S]{0,3000}<\/div>/);
    if (toolbarMatch) {
      console.log('\n📍 Found toolbar HTML section:');
      const toolbar = toolbarMatch[0];

      // Count buttons
      const buttonCount = (toolbar.match(/<button[^>]*sveltedraw-util-btn/g) || []).length;
      console.log(`   Total buttons: ${buttonCount}`);

      // Show a snippet
      const snippet = toolbar.substring(0, 500);
      console.log(`   First 500 chars: ${snippet}...`);
    } else {
      console.log('\n❌ Could not find toolbar HTML section');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();

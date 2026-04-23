const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3002', { waitUntil: 'load', timeout: 10000 });
    await new Promise(r => setTimeout(r, 3000));

    const html = await page.content();
    const hasConnectorPanel = html.includes('sveltedraw-connector-panel');
    const hasConnectorTool = html.includes('ConnectorTool');
    const hasConnectorBtn = html.includes('Connector tool');
    const hasConnectorImport = html.includes('connectors/types');

    console.log('🔍 Phase 13 Feature 1 Debug:');
    console.log(`Connector panel CSS in HTML: ${hasConnectorPanel ? '✅' : '❌'}`);
    console.log(`ConnectorTool component used: ${hasConnectorTool ? '✅' : '❌'}`);
    console.log(`Connector button text in HTML: ${hasConnectorBtn ? '✅' : '❌'}`);
    console.log(`Connector import in bundle: ${hasConnectorImport ? '✅' : '❌'}`);

    // Check for sveltedraw-util-btn buttons
    const utilButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sveltedraw-util-btn')).length;
    });

    console.log(`\nUtility buttons rendered: ${utilButtons}`);

    if (utilButtons === 0) {
      console.log('⚠️  Utility bar not rendering - checking page structure...');
      const hasSvelteApp = await page.$('#app');
      console.log(`App container exists: ${hasSvelteApp ? '✅' : '❌'}`);
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();

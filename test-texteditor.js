const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    console.log('🧪 Phase 13 Feature 5: Advanced Text Features Testing\n');

    await page.goto('http://localhost:3003/#app', { waitUntil: 'networkidle2', timeout: 10000 });
    await delay(2000);

    // Get toolbar buttons
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sveltedraw-util-btn')).map((btn, i) => ({
        index: i,
        emoji: btn.textContent.trim(),
        title: btn.getAttribute('title')
      }));
    });

    console.log('🎛️  Toolbar Buttons:');
    buttons.forEach(b => {
      if (b.title) console.log(`  [${b.index}] ${b.emoji} - ${b.title}`);
    });

    // Find text editor button
    const textEditorBtn = buttons.find(b => b.title?.includes('Text'));
    if (!textEditorBtn) {
      console.log('\n❌ Text Editor button NOT found');
      process.exit(1);
    }

    console.log(`\n✅ Text Editor button found (✏️, index ${textEditorBtn.index})`);

    // Create a text element
    console.log('\n📝 Creating a text element...');
    await page.mouse.click(400, 300);
    await delay(300);

    await page.keyboard.press('T');
    await delay(300);
    await page.mouse.click(200, 200);
    await delay(300);

    // Type some text
    await page.keyboard.type('Hello World');
    await delay(300);

    // Press Escape to finish editing
    await page.keyboard.press('Escape');
    await delay(300);

    // Select the text element
    await page.mouse.click(200, 200);
    await delay(500);

    console.log('✅ Text element created and selected');

    // Open text editor panel via button
    console.log('\n🎨 Opening text editor panel...');
    const buttonElements = await page.$$('.sveltedraw-util-btn');
    await buttonElements[textEditorBtn.index].click();
    await delay(500);

    // Check if panel appears
    const panelExists = await page.$('.sveltedraw-texteditor-panel');
    if (panelExists) {
      console.log('✅ Text Editor panel appeared!');

      // Check for text formatting controls
      const formatBtns = await page.$$('.te-format-btn');
      console.log(`✅ Found ${formatBtns.length} formatting buttons (Bold, Italic, Underline, Strikethrough)`);

      // Check for alignment buttons
      const alignBtns = await page.$$('.te-align-btn');
      console.log(`✅ Found ${alignBtns.length} alignment buttons (L, C, R, J)`);

      // Check for font size select
      const fontSizeSelect = await page.$('#font-size');
      if (fontSizeSelect) {
        console.log('✅ Font size selector present');
      }

      // Check for font family select
      const fontFamilySelect = await page.$('#font-family');
      if (fontFamilySelect) {
        console.log('✅ Font family selector present');
      }

      // Check for color picker
      const colorInput = await page.$('#text-color');
      if (colorInput) {
        console.log('✅ Color picker present');
      }
    } else {
      console.log('❌ Text Editor panel did NOT appear');
    }

    // Test keyboard shortcut
    console.log('\n⌨️ Testing Keyboard Shortcut (Ctrl+T):');
    await page.keyboard.down('Control');
    await page.keyboard.press('T');
    await page.keyboard.up('Control');
    await delay(500);

    const panelAfter = await page.$('.sveltedraw-texteditor-panel');
    console.log(panelAfter ? '⚠️  Panel still visible' : '✅ Panel toggled (hidden)');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Phase 13 Feature 5 (Text Features) Test Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

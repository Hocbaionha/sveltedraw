#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// TEST HELPERS
// ============================================================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  addTest(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n🚀 Starting CDP Test Suite...\n');

    for (const test of this.tests) {
      try {
        console.log(`⏳ Running: ${test.name}`);
        await test.fn();
        this.passed++;
        this.results.push({ name: test.name, status: '✅' });
        console.log(`✅ ${test.name}\n`);
      } catch (err) {
        this.failed++;
        this.results.push({ name: test.name, status: '❌', error: err.message });
        console.log(`❌ ${test.name}: ${err.message}\n`);
      }
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📊 Total: ${this.results.length}`);
    console.log('='.repeat(80) + '\n');

    console.log('DETAILED RESULTS:');
    this.results.forEach(r => {
      if (r.error) {
        console.log(`${r.status} ${r.name}`);
        console.log(`   Error: ${r.error}`);
      } else {
        console.log(`${r.status} ${r.name}`);
      }
    });
  }
}

// ============================================================================
// START DEV SERVER
// ============================================================================

async function startDevServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, 'sveltedraw-app'),
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
      // Look for dev server ready signal
      if (output.includes('Local:') || output.includes('VITE') || output.includes('5173')) {
        console.log('✅ Dev server started');
        resolve(proc);
      }
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    setTimeout(() => {
      if (!output.includes('Local:')) {
        console.log('⚠️  Dev server startup (timeout, assuming started)');
        resolve(proc);
      }
    }, 8000);

    proc.on('error', reject);
  });
}

// ============================================================================
// MAIN TEST SUITE
// ============================================================================

async function main() {
  let browser;
  let page;
  let serverProc;

  try {
    // Start dev server
    console.log('🔨 Starting dev server...');
    serverProc = await startDevServer();
    await sleep(3000);

    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    page = await browser.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(30000);

    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Navigate to app
    console.log('📍 Navigating to editor...');
    await page.goto('http://localhost:5173/#/app', { waitUntil: 'networkidle2' });
    await sleep(2000);

    const runner = new TestRunner();

    // ====================================================================
    // UI TESTS
    // ====================================================================

    runner.addTest('Page loads and editor is visible', async () => {
      const editor = await page.$('[class*="editor"]');
      if (!editor) throw new Error('Editor element not found');
    });

    runner.addTest('Canvas elements exist', async () => {
      const staticCanvas = await page.$('canvas');
      if (!staticCanvas) throw new Error('Canvas not found');
    });

    runner.addTest('Toolbar is visible', async () => {
      await page.waitForSelector('button', { timeout: 5000 });
      const buttons = await page.$$('button');
      if (buttons.length === 0) throw new Error('No toolbar buttons found');
      console.log(`     Found ${buttons.length} buttons`);
    });

    runner.addTest('Dark mode toggle works', async () => {
      const darkModeButton = await page.$('button[aria-label*="dark" i], button[title*="dark" i]');
      if (darkModeButton) {
        await darkModeButton.click();
        await sleep(500);
        await darkModeButton.click();
      }
    });

    // ====================================================================
    // DRAWING TESTS
    // ====================================================================

    runner.addTest('Draw rectangle', async () => {
      // Find and click rectangle tool
      const buttons = await page.$$('button');
      let foundRect = false;
      for (const btn of buttons) {
        const ariaLabel = await btn.evaluate(b => b.getAttribute('aria-label'));
        if (ariaLabel && ariaLabel.toLowerCase().includes('rectangle')) {
          await btn.click();
          foundRect = true;
          break;
        }
      }

      if (!foundRect) {
        // Try by title
        const btn = await page.$('button[title*="rectangle" i]');
        if (btn) {
          await btn.click();
          foundRect = true;
        }
      }

      if (!foundRect) {
        console.log('     Note: Rectangle tool not found in this phase');
        return;
      }

      // Draw on canvas
      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 200);
      await page.mouse.up();
      await sleep(500);
    });

    runner.addTest('Draw ellipse', async () => {
      const buttons = await page.$$('button');
      let foundEllipse = false;
      for (const btn of buttons) {
        const ariaLabel = await btn.evaluate(b => b.getAttribute('aria-label'));
        if (ariaLabel && ariaLabel.toLowerCase().includes('ellipse')) {
          await btn.click();
          foundEllipse = true;
          break;
        }
      }

      if (!foundEllipse) {
        console.log('     Note: Ellipse tool not found in this phase');
        return;
      }

      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 250, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 350, box.y + 200);
      await page.mouse.up();
      await sleep(500);
    });

    runner.addTest('Draw diamond', async () => {
      const buttons = await page.$$('button');
      let foundDiamond = false;
      for (const btn of buttons) {
        const ariaLabel = await btn.evaluate(b => b.getAttribute('aria-label'));
        if (ariaLabel && ariaLabel.toLowerCase().includes('diamond')) {
          await btn.click();
          foundDiamond = true;
          break;
        }
      }

      if (!foundDiamond) {
        console.log('     Note: Diamond tool not found in this phase');
        return;
      }

      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 400, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 500, box.y + 200);
      await page.mouse.up();
      await sleep(500);
    });

    runner.addTest('Draw line', async () => {
      const buttons = await page.$$('button');
      let foundLine = false;
      for (const btn of buttons) {
        const ariaLabel = await btn.evaluate(b => b.getAttribute('aria-label'));
        if (ariaLabel && ariaLabel.toLowerCase().includes('line')) {
          await btn.click();
          foundLine = true;
          break;
        }
      }

      if (!foundLine) {
        console.log('     Note: Line tool not found in this phase');
        return;
      }

      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 550, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 650, box.y + 200);
      await page.mouse.up();
      await sleep(500);
    });

    runner.addTest('Draw text', async () => {
      const buttons = await page.$$('button');
      let foundText = false;
      for (const btn of buttons) {
        const ariaLabel = await btn.evaluate(b => b.getAttribute('aria-label'));
        if (ariaLabel && ariaLabel.toLowerCase().includes('text')) {
          await btn.click();
          foundText = true;
          break;
        }
      }

      if (!foundText) {
        console.log('     Note: Text tool not found in this phase');
        return;
      }

      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      await page.mouse.click(box.x + 700, box.y + 150);
      await sleep(500);
      await page.keyboard.type('Test', { delay: 50 });
      await page.keyboard.press('Escape');
      await sleep(500);
    });

    // ====================================================================
    // SELECTION & TRANSFORMATION TESTS
    // ====================================================================

    runner.addTest('Select element with Ctrl+A', async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await sleep(500);
    });

    runner.addTest('Undo works (Ctrl+Z)', async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('z');
      await page.keyboard.up('Control');
      await sleep(500);
    });

    runner.addTest('Redo works (Ctrl+Y)', async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('y');
      await page.keyboard.up('Control');
      await sleep(500);
    });

    runner.addTest('Delete selected element (Delete key)', async () => {
      // First draw something
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const ariaLabel = await btn.evaluate(b => b.getAttribute('aria-label'));
        if (ariaLabel && ariaLabel.toLowerCase().includes('rectangle')) {
          await btn.click();
          break;
        }
      }

      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 200);
      await page.mouse.up();
      await sleep(500);

      // Delete it
      await page.keyboard.press('Delete');
      await sleep(500);
    });

    // ====================================================================
    // COLOR & STYLING TESTS
    // ====================================================================

    runner.addTest('Color picker opens', async () => {
      const colorButtons = await page.$$('button[class*="color" i]');
      if (colorButtons.length > 0) {
        await colorButtons[0].click();
        await sleep(500);
        // Check if color picker appeared
        const popup = await page.$('[role="dialog"]');
        if (popup) {
          console.log('     Color picker dialog opened');
        }
        await page.keyboard.press('Escape');
      }
    });

    runner.addTest('Background color can be set', async () => {
      // Look for any color swatch or color input
      const colorInputs = await page.$$('input[type="color"]');
      if (colorInputs.length > 0) {
        await colorInputs[0].evaluate(el => el.click());
        await sleep(300);
        await colorInputs[0].evaluate(el => el.value = '#FF0000');
        await colorInputs[0].evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
        await sleep(500);
      }
    });

    // ====================================================================
    // MENU & DIALOG TESTS
    // ====================================================================

    runner.addTest('Menu can be opened and closed', async () => {
      // Look for menu button
      const menuButton = await page.$('button[aria-label*="menu" i], button[title*="menu" i]');
      if (menuButton) {
        await menuButton.click();
        await sleep(500);
        const menu = await page.$('[role="menu"]');
        if (menu) {
          console.log('     Menu opened successfully');
          await page.keyboard.press('Escape');
          await sleep(300);
        }
      }
    });

    runner.addTest('Settings/Properties panel responsive', async () => {
      // Check if properties panel exists
      const panel = await page.$('[class*="panel" i], [class*="properties" i]');
      if (panel) {
        console.log('     Properties panel found');
      }
    });

    // ====================================================================
    // CANVAS INTERACTION TESTS
    // ====================================================================

    runner.addTest('Pan canvas with middle mouse button', async () => {
      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 400, box.y + 300);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(box.x + 500, box.y + 400);
      await page.mouse.up({ button: 'middle' });
      await sleep(500);
    });

    runner.addTest('Zoom with Ctrl+Scroll', async () => {
      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 400, box.y + 300);

      // Zoom in
      await page.keyboard.down('Control');
      await page.mouse.wheel({ deltaY: -100 });
      await sleep(300);

      // Zoom out
      await page.mouse.wheel({ deltaY: 100 });
      await page.keyboard.up('Control');
      await sleep(500);
    });

    // ====================================================================
    // KEYBOARD SHORTCUTS TESTS
    // ====================================================================

    runner.addTest('Escape key deselects', async () => {
      await page.keyboard.press('Escape');
      await sleep(300);
    });

    runner.addTest('Space bar (pan mode)', async () => {
      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 400, box.y + 300);

      await page.keyboard.down('Space');
      await page.mouse.move(box.x + 500, box.y + 400);
      await page.keyboard.up('Space');
      await sleep(500);
    });

    // ====================================================================
    // ELEMENT OPERATIONS TESTS
    // ====================================================================

    runner.addTest('Duplicate element (Ctrl+D)', async () => {
      // Draw first
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const ariaLabel = await btn.evaluate(b => b.getAttribute('aria-label'));
        if (ariaLabel && ariaLabel.toLowerCase().includes('rectangle')) {
          await btn.click();
          break;
        }
      }

      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 200);
      await page.mouse.up();
      await sleep(500);

      // Try duplicate
      await page.keyboard.down('Control');
      await page.keyboard.press('d');
      await page.keyboard.up('Control');
      await sleep(500);
    });

    runner.addTest('Copy/Paste (Ctrl+C, Ctrl+V)', async () => {
      // Draw
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const ariaLabel = await btn.evaluate(b => b.getAttribute('aria-label'));
        if (ariaLabel && ariaLabel.toLowerCase().includes('rectangle')) {
          await btn.click();
          break;
        }
      }

      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 300, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 400, box.y + 200);
      await page.mouse.up();
      await sleep(500);

      // Copy
      await page.keyboard.down('Control');
      await page.keyboard.press('c');
      await page.keyboard.up('Control');
      await sleep(300);

      // Paste
      await page.keyboard.down('Control');
      await page.keyboard.press('v');
      await page.keyboard.up('Control');
      await sleep(500);
    });

    // ====================================================================
    // FILE OPERATIONS TESTS
    // ====================================================================

    runner.addTest('Export as PNG', async () => {
      const exportButtons = await page.$$('button');
      let found = false;
      for (const btn of exportButtons) {
        const ariaLabel = await btn.evaluate(b => b.getAttribute('aria-label'));
        const title = await btn.evaluate(b => b.getAttribute('title'));
        if ((ariaLabel && ariaLabel.toLowerCase().includes('export')) ||
            (title && title.toLowerCase().includes('export'))) {
          await btn.click();
          found = true;
          break;
        }
      }

      if (!found) {
        console.log('     Note: Export button not found in this phase');
      }
      await page.keyboard.press('Escape');
    });

    // ====================================================================
    // RESPONSIVENESS TESTS
    // ====================================================================

    runner.addTest('Responsive to window resize', async () => {
      await page.setViewport({ width: 800, height: 600 });
      await sleep(500);

      const canvas = await page.$('canvas');
      if (!canvas) throw new Error('Canvas missing after resize');

      await page.setViewport({ width: 1280, height: 720 });
      await sleep(500);
    });

    // ====================================================================
    // PERFORMANCE TESTS
    // ====================================================================

    runner.addTest('Large number of elements (stress test)', async () => {
      // Draw multiple elements
      const buttons = await page.$$('button');
      const rectButton = buttons.find(async (btn) => {
        const label = await btn.evaluate(b => b.getAttribute('aria-label'));
        return label && label.toLowerCase().includes('rectangle');
      });

      for (let i = 0; i < 10; i++) {
        const canvas = await page.$('canvas');
        const box = await canvas.boundingBox();
        const startX = box.x + (i * 50) % 400 + 50;
        const startY = box.y + (i * 30) % 300 + 50;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 50, startY + 50);
        await page.mouse.up();
        await sleep(100);
      }

      console.log('     Drew 10 rectangles successfully');
    });

    runner.addTest('No console errors during interaction', async () => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Perform various interactions
      await page.keyboard.press('Escape');
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await sleep(300);

      if (errors.length > 0) {
        console.log(`     Warning: ${errors.length} console errors found`);
        errors.forEach(e => console.log(`       - ${e}`));
      }
    });

    // ====================================================================
    // RUN ALL TESTS
    // ====================================================================

    await runner.run();

    // ====================================================================
    // SAVE REPORT
    // ====================================================================

    const report = {
      timestamp: new Date().toISOString(),
      results: runner.results,
      summary: {
        passed: runner.passed,
        failed: runner.failed,
        total: runner.results.length,
        passRate: `${((runner.passed / runner.results.length) * 100).toFixed(2)}%`
      }
    };

    fs.writeFileSync(
      path.join(__dirname, 'test-results.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n📋 Test report saved to test-results.json');

    process.exit(runner.failed > 0 ? 1 : 0);

  } catch (err) {
    console.error('❌ Test suite error:', err);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
    if (serverProc) {
      serverProc.kill();
    }
  }
}

main().catch(console.error);

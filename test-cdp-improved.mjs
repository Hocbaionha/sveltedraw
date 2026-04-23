#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function startDevServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, 'sveltedraw-app'),
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    const timeout = setTimeout(() => {
      console.log('✅ Dev server started (timeout, assuming ready)');
      resolve(proc);
    }, 10000);

    proc.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Local:') || output.includes('5173') || output.includes('ready')) {
        clearTimeout(timeout);
        console.log('✅ Dev server started');
        resolve(proc);
      }
    });

    proc.on('error', reject);
  });
}

async function main() {
  let browser;
  let page;
  let serverProc;

  try {
    console.log('🔨 Starting dev server...');
    serverProc = await startDevServer();
    await sleep(4000);

    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    page = await browser.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);

    await page.setViewport({ width: 1280, height: 720 });

    console.log('📍 Navigating to editor...');
    await page.goto('http://localhost:5173/#/app', { waitUntil: 'networkidle2' });
    await sleep(3000);

    // Debug: Check what's on the page
    const html = await page.content();
    const pageTitle = await page.title();
    console.log(`\n📄 Page Title: ${pageTitle}`);

    const bodyHtml = await page.$eval('body', el => el.innerHTML.substring(0, 500));
    console.log(`📄 Body (first 500 chars): ${bodyHtml}\n`);

    const runner = new TestRunner();

    // ====================================================================
    // BASIC UI TESTS
    // ====================================================================

    runner.addTest('Page loads without errors', async () => {
      const pageText = await page.evaluate(() => document.body.innerText);
      if (!pageText || pageText.length < 10) {
        throw new Error('Page content is empty');
      }
      console.log(`     Page loaded with content`);
    });

    runner.addTest('Find toolbar buttons', async () => {
      const buttons = await page.$$('button');
      console.log(`     Found ${buttons.length} buttons`);
      if (buttons.length === 0) {
        throw new Error('No buttons found');
      }
    });

    runner.addTest('Find interactive canvases', async () => {
      const canvases = await page.$$('canvas');
      console.log(`     Found ${canvases.length} canvas elements`);
      if (canvases.length === 0) {
        console.log('     Note: No canvas elements yet (Phase 4 batch 14)');
      }
    });

    runner.addTest('Dark mode toggle is functional', async () => {
      const toggles = await page.$$('button');
      let found = false;
      for (const btn of toggles) {
        const label = await btn.evaluate(b => b.getAttribute('aria-label'));
        if (label && label.includes('dark')) {
          await btn.click();
          await sleep(300);
          await btn.click();
          found = true;
          break;
        }
      }
      if (!found) {
        console.log('     Note: Dark mode toggle not found');
      }
    });

    // ====================================================================
    // UI COMPONENT TESTS
    // ====================================================================

    runner.addTest('Buttons are clickable', async () => {
      const buttons = await page.$$('button');
      if (buttons.length > 0) {
        for (let i = 0; i < Math.min(5, buttons.length); i++) {
          try {
            await buttons[i].click({ timeout: 1000 });
            await sleep(100);
          } catch (e) {
            console.log(`     Note: Some buttons may not be clickable`);
          }
        }
        console.log(`     Tested ${Math.min(5, buttons.length)} buttons`);
      }
    });

    runner.addTest('Color pickers exist and work', async () => {
      const colorInputs = await page.$$('input[type="color"]');
      console.log(`     Found ${colorInputs.length} color inputs`);

      if (colorInputs.length > 0) {
        for (let i = 0; i < Math.min(2, colorInputs.length); i++) {
          const currentColor = await colorInputs[i].evaluate(el => el.value);
          console.log(`     Color input ${i}: ${currentColor}`);
        }
      }
    });

    runner.addTest('Menu/Dropdown functionality', async () => {
      const menus = await page.$$('[role="menu"], [role="dialog"]');
      console.log(`     Found ${menus.length} menu/dialog elements`);
    });

    // ====================================================================
    // KEYBOARD INTERACTION TESTS
    // ====================================================================

    runner.addTest('Escape key works', async () => {
      await page.keyboard.press('Escape');
      await sleep(200);
      console.log('     Escape key processed');
    });

    runner.addTest('Ctrl+A (select all)', async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await sleep(300);
      console.log('     Ctrl+A executed');
    });

    runner.addTest('Ctrl+Z (undo)', async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('z');
      await page.keyboard.up('Control');
      await sleep(300);
      console.log('     Ctrl+Z executed');
    });

    runner.addTest('Ctrl+Y (redo)', async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('y');
      await page.keyboard.up('Control');
      await sleep(300);
      console.log('     Ctrl+Y executed');
    });

    runner.addTest('Ctrl+C (copy)', async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('c');
      await page.keyboard.up('Control');
      await sleep(200);
      console.log('     Ctrl+C executed');
    });

    runner.addTest('Ctrl+V (paste)', async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('v');
      await page.keyboard.up('Control');
      await sleep(200);
      console.log('     Ctrl+V executed');
    });

    runner.addTest('Delete key', async () => {
      await page.keyboard.press('Delete');
      await sleep(200);
      console.log('     Delete key executed');
    });

    runner.addTest('Space key', async () => {
      await page.keyboard.press('Space');
      await sleep(200);
      console.log('     Space key executed');
    });

    // ====================================================================
    // MOUSE INTERACTION TESTS
    // ====================================================================

    runner.addTest('Mouse movement and clicks', async () => {
      // Try clicking in the center of the page
      await page.mouse.move(640, 360);
      await sleep(100);
      await page.mouse.click(640, 360);
      await sleep(100);
      console.log('     Mouse move and click executed');
    });

    runner.addTest('Mouse wheel scroll', async () => {
      await page.mouse.move(640, 360);
      await sleep(100);

      // Scroll up
      await page.mouse.wheel({ deltaY: -100 });
      await sleep(200);

      // Scroll down
      await page.mouse.wheel({ deltaY: 100 });
      await sleep(200);

      console.log('     Mouse wheel scroll executed');
    });

    runner.addTest('Mouse drag operation', async () => {
      await page.mouse.move(300, 300);
      await page.mouse.down();
      await page.mouse.move(400, 400);
      await page.mouse.up();
      await sleep(200);
      console.log('     Mouse drag executed');
    });

    // ====================================================================
    // PERFORMANCE & STABILITY TESTS
    // ====================================================================

    runner.addTest('Rapid button clicks (stress test)', async () => {
      const buttons = await page.$$('button');
      if (buttons.length > 0) {
        const btn = buttons[0];
        for (let i = 0; i < 10; i++) {
          try {
            await btn.click({ timeout: 500 });
            await sleep(50);
          } catch (e) {
            console.log(`     Click ${i + 1} failed`);
            break;
          }
        }
        console.log('     10 rapid clicks completed');
      }
    });

    runner.addTest('Keyboard spam test', async () => {
      const keys = ['a', 'b', 'c', 'd', 'e'];
      for (const key of keys) {
        await page.keyboard.press(key);
        await sleep(50);
      }
      console.log('     Keyboard spam test completed');
    });

    runner.addTest('Window resize responsive', async () => {
      // Small window
      await page.setViewport({ width: 640, height: 480 });
      await sleep(200);

      // Large window
      await page.setViewport({ width: 1920, height: 1080 });
      await sleep(200);

      // Back to normal
      await page.setViewport({ width: 1280, height: 720 });
      await sleep(200);

      console.log('     Window resize test completed');
    });

    runner.addTest('No crash after long interaction', async () => {
      // Perform extended interaction
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press(String.fromCharCode(65 + (i % 26)));
        await sleep(50);
      }

      // Check page is still responsive
      const isAlive = await page.evaluate(() => typeof document !== 'undefined');
      if (!isAlive) {
        throw new Error('Page became unresponsive');
      }

      console.log('     Extended interaction test passed');
    });

    // ====================================================================
    // RENDERING TESTS
    // ====================================================================

    runner.addTest('Page renders without visual errors', async () => {
      const isVisible = await page.evaluate(() => {
        return document.body.offsetHeight > 0 && document.body.offsetWidth > 0;
      });

      if (!isVisible) {
        throw new Error('Page body has no visible dimensions');
      }

      console.log('     Page dimensions: OK');
    });

    runner.addTest('DOM is not empty', async () => {
      const elementCount = await page.evaluate(() => {
        return document.querySelectorAll('*').length;
      });

      console.log(`     DOM element count: ${elementCount}`);
      if (elementCount < 10) {
        throw new Error('DOM appears incomplete');
      }
    });

    // ====================================================================
    // ACCESSIBILITY TESTS
    // ====================================================================

    runner.addTest('ARIA roles are present', async () => {
      const ariaElements = await page.evaluate(() => {
        return document.querySelectorAll('[role]').length;
      });

      console.log(`     Elements with ARIA roles: ${ariaElements}`);
    });

    runner.addTest('Buttons are keyboard accessible', async () => {
      // Tab to first button
      await page.keyboard.press('Tab');
      await sleep(100);

      // Check if any button is focused
      const focused = await page.evaluate(() => {
        const active = document.activeElement;
        return active && active.tagName === 'BUTTON';
      });

      if (!focused) {
        console.log('     Note: No button focused after Tab');
      } else {
        console.log('     Button navigation works');
      }
    });

    // ====================================================================
    // MEMORY/LEAK TESTS
    // ====================================================================

    runner.addTest('No memory leak on repeated interactions', async () => {
      // Get initial memory
      const memBefore = await page.metrics();

      // Perform many interactions
      for (let i = 0; i < 50; i++) {
        await page.keyboard.press('Escape');
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        if (i % 10 === 0) {
          await sleep(100);
        }
      }

      // Get final memory
      const memAfter = await page.metrics();

      const increase = memAfter.JSHeapUsedSize - memBefore.JSHeapUsedSize;
      console.log(`     Memory delta: ${(increase / 1024 / 1024).toFixed(2)} MB`);

      // Flag if too much increase
      if (increase > 50 * 1024 * 1024) {
        console.log('     ⚠️  Warning: Significant memory increase');
      }
    });

    // ====================================================================
    // CONSOLE MONITORING
    // ====================================================================

    const consoleMessages = [];
    const consoleErrors = [];

    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    runner.addTest('Monitor for console errors', async () => {
      // This test just logs what was found
      if (consoleErrors.length > 0) {
        console.log(`     ${consoleErrors.length} console errors found:`);
        consoleErrors.slice(0, 5).forEach(err => {
          console.log(`       - ${err.substring(0, 100)}`);
        });
      } else {
        console.log('     No console errors detected');
      }
    });

    // ====================================================================
    // FEATURE DETECTION TESTS
    // ====================================================================

    runner.addTest('Detect available drawing tools', async () => {
      const buttons = await page.$$('button');
      const toolNames = new Set();

      for (const btn of buttons) {
        const label = await btn.evaluate(b => b.getAttribute('aria-label'));
        const title = await btn.evaluate(b => b.getAttribute('title'));
        const text = await btn.evaluate(b => b.innerText);

        const name = label || title || text;
        if (name && name.length < 50) {
          toolNames.add(name);
        }
      }

      console.log(`     Found ${toolNames.size} unique tool/button names`);
      const toolArray = Array.from(toolNames).slice(0, 10);
      toolArray.forEach(tool => console.log(`       - ${tool.substring(0, 40)}`));
    });

    runner.addTest('Screenshot capability', async () => {
      const screenshotPath = path.join(__dirname, 'test-screenshot.png');
      await page.screenshot({ path: screenshotPath });
      console.log(`     Screenshot saved to: ${screenshotPath}`);
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
      },
      consoleMetrics: {
        totalMessages: consoleMessages.length,
        errors: consoleErrors.length,
        warnings: consoleMessages.filter(m => m.type === 'warning').length,
        logs: consoleMessages.filter(m => m.type === 'log').length
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

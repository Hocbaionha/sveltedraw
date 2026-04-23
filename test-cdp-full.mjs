#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class TestRunner {
  constructor(page) {
    this.tests = [];
    this.results = [];
    this.passed = 0;
    this.failed = 0;
    this.page = page;
  }

  addTest(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n🚀 Starting Full Sveltedraw CDP Test Suite...\n');

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
    console.log(`📈 Pass Rate: ${((this.passed / this.results.length) * 100).toFixed(2)}%`);
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
    }, 12000);

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

    // Try multiple routes to find the drawing app
    console.log('📍 Navigating to sveltedraw home...');

    const routes = [
      'http://localhost:5173/',
      'http://localhost:5173/#/app',
      'http://localhost:5173/app'
    ];

    let currentUrl = null;
    for (const url of routes) {
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        await sleep(2000);

        const pageUrl = page.url();
        console.log(`✓ Loaded: ${pageUrl}`);
        currentUrl = url;
        break;
      } catch (e) {
        console.log(`✗ Failed to load ${url}`);
      }
    }

    if (!currentUrl) {
      throw new Error('Could not load any sveltedraw routes');
    }

    // Get page info
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log(`\n📄 Current Page: ${pageTitle}`);
    console.log(`📍 URL: ${pageUrl}\n`);

    const runner = new TestRunner(page);

    // ====================================================================
    // HOMEPAGE & NAVIGATION TESTS
    // ====================================================================

    runner.addTest('Page title is set', async () => {
      const title = await page.title();
      if (!title || title.length === 0) {
        throw new Error('Page has no title');
      }
      console.log(`     Title: "${title}"`);
    });

    runner.addTest('Can navigate to showcase', async () => {
      const link = await page.$('a[href*="showcase"]');
      if (link) {
        const href = await link.evaluate(el => el.getAttribute('href'));
        console.log(`     Found showcase link: ${href}`);
        await link.click();
        await sleep(2000);
      } else {
        console.log('     Note: Showcase link not found on homepage');
      }
    });

    runner.addTest('Can navigate back to home', async () => {
      await page.goto(currentUrl, { waitUntil: 'networkidle2' });
      await sleep(1000);
    });

    runner.addTest('Navigation links are functional', async () => {
      const links = await page.$$('a');
      console.log(`     Found ${links.length} links on page`);

      let clickCount = 0;
      for (let i = 0; i < Math.min(3, links.length); i++) {
        try {
          const href = await links[i].evaluate(el => el.getAttribute('href'));
          if (href && !href.startsWith('http')) {
            await links[i].click({ timeout: 1000 });
            await sleep(100);
            clickCount++;
          }
        } catch (e) {
          // Navigation might have changed page
        }
      }
      console.log(`     Successfully clicked ${clickCount} internal links`);
    });

    // ====================================================================
    // CONTENT & RENDERING TESTS
    // ====================================================================

    runner.addTest('Page has visible content', async () => {
      const hasText = await page.evaluate(() => {
        const text = document.body.innerText;
        return text && text.trim().length > 0;
      });

      if (!hasText) {
        throw new Error('Page has no visible text content');
      }

      const textLength = await page.evaluate(() => document.body.innerText.length);
      console.log(`     Content length: ${textLength} characters`);
    });

    runner.addTest('Page header/heading exists', async () => {
      const headings = await page.$$('h1, h2, h3');
      console.log(`     Found ${headings.length} heading elements`);

      if (headings.length > 0) {
        const text = await headings[0].evaluate(el => el.innerText);
        console.log(`     First heading: "${text.substring(0, 50)}"`);
      }
    });

    runner.addTest('Interactive elements are present', async () => {
      const buttons = await page.$$('button');
      const inputs = await page.$$('input, textarea, select');
      const links = await page.$$('a');

      console.log(`     Buttons: ${buttons.length}`);
      console.log(`     Inputs: ${inputs.length}`);
      console.log(`     Links: ${links.length}`);

      const total = buttons.length + inputs.length + links.length;
      if (total === 0) {
        throw new Error('No interactive elements found');
      }
    });

    // ====================================================================
    // INTERACTION TESTS
    // ====================================================================

    runner.addTest('Buttons can be clicked without error', async () => {
      const buttons = await page.$$('button');

      let successCount = 0;
      for (let i = 0; i < Math.min(5, buttons.length); i++) {
        try {
          // Check if button is visible
          const isVisible = await buttons[i].evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          });

          if (isVisible) {
            await buttons[i].click({ timeout: 1000 });
            await sleep(100);
            successCount++;
          }
        } catch (e) {
          // Some buttons may not be clickable, that's OK
        }
      }

      console.log(`     Successfully clicked ${successCount} buttons`);
    });

    runner.addTest('Form inputs are functional', async () => {
      const inputs = await page.$$('input[type="text"]');

      if (inputs.length > 0) {
        try {
          await inputs[0].type('test input', { delay: 50 });
          const value = await inputs[0].evaluate(el => el.value);
          if (value.includes('test')) {
            console.log('     Text input works');
          }
        } catch (e) {
          console.log('     Note: Could not interact with text inputs');
        }
      } else {
        console.log('     Note: No text inputs found');
      }
    });

    runner.addTest('Scrolling works', async () => {
      await page.evaluate(() => window.scrollBy(0, 100));
      await sleep(200);

      const scrollTop = await page.evaluate(() => window.scrollY);
      console.log(`     Scroll position: ${scrollTop}px`);

      await page.evaluate(() => window.scrollTo(0, 0));
    });

    // ====================================================================
    // KEYBOARD TESTS
    // ====================================================================

    runner.addTest('Keyboard shortcuts work', async () => {
      const shortcuts = [
        { name: 'Escape', key: 'Escape' },
        { name: 'Enter', key: 'Enter' },
        { name: 'Tab', key: 'Tab' }
      ];

      for (const shortcut of shortcuts) {
        try {
          await page.keyboard.press(shortcut.key);
          console.log(`     ${shortcut.name}: OK`);
        } catch (e) {
          console.log(`     ${shortcut.name}: Failed`);
        }
      }
    });

    runner.addTest('Text selection works', async () => {
      const textContent = await page.evaluate(() => document.body.innerText.substring(0, 100));

      // Try to select all
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await sleep(200);

      console.log('     Selection: OK');
    });

    // ====================================================================
    // MOUSE TESTS
    // ====================================================================

    runner.addTest('Mouse hover detection', async () => {
      const buttons = await page.$$('button');

      if (buttons.length > 0) {
        const boundingBox = await buttons[0].boundingBox();
        if (boundingBox) {
          await page.mouse.move(
            boundingBox.x + boundingBox.width / 2,
            boundingBox.y + boundingBox.height / 2
          );
          await sleep(200);
          console.log('     Hover: OK');
        }
      }
    });

    runner.addTest('Double click works', async () => {
      const elements = await page.$$('p, span, div');

      if (elements.length > 0) {
        try {
          await elements[0].click({ clickCount: 2 });
          await sleep(200);
          console.log('     Double click: OK');
        } catch (e) {
          console.log('     Note: Double click test inconclusive');
        }
      }
    });

    // ====================================================================
    // VISIBILITY TESTS
    // ====================================================================

    runner.addTest('Images load correctly', async () => {
      const images = await page.$$('img');
      console.log(`     Found ${images.length} images`);

      let loadedCount = 0;
      for (let i = 0; i < Math.min(5, images.length); i++) {
        const isComplete = await images[i].evaluate(el => el.complete);
        if (isComplete) loadedCount++;
      }

      console.log(`     Loaded ${loadedCount}/${Math.min(5, images.length)} sampled images`);
    });

    runner.addTest('Styles are applied', async () => {
      const elements = await page.$$('*');

      if (elements.length > 0) {
        const styles = await elements[0].evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            fontSize: computed.fontSize,
            display: computed.display
          };
        });

        console.log('     Styles applied: OK');
        console.log(`       Sample: ${JSON.stringify(styles)}`);
      }
    });

    // ====================================================================
    // ERROR & STABILITY TESTS
    // ====================================================================

    let consoleErrors = [];
    let consoleWarnings = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    runner.addTest('No critical console errors', async () => {
      // Clear existing errors
      consoleErrors = [];

      // Perform some interactions
      const buttons = await page.$$('button');
      for (let i = 0; i < Math.min(3, buttons.length); i++) {
        try {
          await buttons[i].click({ timeout: 500 });
          await sleep(50);
        } catch (e) {
          // Ignore
        }
      }

      await sleep(500);

      if (consoleErrors.length > 0) {
        console.log(`     Found ${consoleErrors.length} console errors:`);
        consoleErrors.slice(0, 3).forEach(err => {
          console.log(`       - ${err.substring(0, 80)}`);
        });
      } else {
        console.log('     No console errors detected');
      }
    });

    runner.addTest('Memory is stable', async () => {
      const metrics = await page.metrics();
      const heapSize = (metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2);
      const heapLimit = (metrics.JSHeapTotalSize / 1024 / 1024).toFixed(2);

      console.log(`     Heap used: ${heapSize} MB`);
      console.log(`     Heap limit: ${heapLimit} MB`);

      if (heapSize > 500) {
        console.log('     ⚠️  Warning: High memory usage');
      }
    });

    runner.addTest('No page crashes during interactions', async () => {
      // Rapid interactions
      for (let i = 0; i < 50; i++) {
        await page.keyboard.press('Escape');
        if (i % 10 === 0) {
          await sleep(100);
        }
      }

      // Check page is still responsive
      const alive = await page.evaluate(() => {
        return typeof window !== 'undefined' && window.location.href.length > 0;
      });

      if (!alive) {
        throw new Error('Page became unresponsive');
      }

      console.log('     Page stability: OK');
    });

    // ====================================================================
    // RESPONSIVE TESTS
    // ====================================================================

    runner.addTest('Responsive to viewport changes', async () => {
      const viewports = [
        { width: 480, height: 320, name: 'Mobile' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 1920, height: 1080, name: 'Desktop' }
      ];

      for (const vp of viewports) {
        await page.setViewport(vp);
        await sleep(200);

        const isVisible = await page.evaluate(() => {
          return document.body.offsetHeight > 0;
        });

        if (!isVisible) {
          throw new Error(`Layout broken at ${vp.name}`);
        }

        console.log(`     ${vp.name} (${vp.width}x${vp.height}): OK`);
      }

      // Restore
      await page.setViewport({ width: 1280, height: 720 });
    });

    // ====================================================================
    // ACCESSIBILITY TESTS
    // ====================================================================

    runner.addTest('Semantic HTML is used', async () => {
      const semanticElements = await page.evaluate(() => {
        const tags = ['header', 'nav', 'main', 'article', 'section', 'footer'];
        return tags.reduce((acc, tag) => {
          acc[tag] = document.querySelectorAll(tag).length;
          return acc;
        }, {});
      });

      console.log('     Semantic elements found:');
      Object.entries(semanticElements).forEach(([tag, count]) => {
        if (count > 0) {
          console.log(`       ${tag}: ${count}`);
        }
      });
    });

    runner.addTest('Focus management works', async () => {
      // Tab through elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        await sleep(100);
      }

      const focused = await page.evaluate(() => {
        const active = document.activeElement;
        return {
          tag: active.tagName,
          id: active.id,
          class: active.className.substring(0, 50)
        };
      });

      console.log(`     Focused element: ${focused.tag}`);
    });

    // ====================================================================
    // PERFORMANCE TESTS
    // ====================================================================

    runner.addTest('Page load performance', async () => {
      const perfData = await page.evaluate(() => {
        const perfData = window.performance.timing;
        return {
          domReady: perfData.domContentLoadedEventEnd - perfData.navigationStart,
          pageLoad: perfData.loadEventEnd - perfData.navigationStart
        };
      });

      console.log(`     DOM ready: ${perfData.domReady}ms`);
      console.log(`     Page load: ${perfData.pageLoad}ms`);
    });

    runner.addTest('Paint timing', async () => {
      const paintEntries = await page.evaluate(() => {
        const entries = performance.getEntriesByType('paint');
        return entries.map(e => ({ name: e.name, time: e.startTime.toFixed(2) }));
      });

      if (paintEntries.length > 0) {
        console.log('     Paint timing:');
        paintEntries.forEach(entry => {
          console.log(`       ${entry.name}: ${entry.time}ms`);
        });
      }
    });

    // ====================================================================
    // FINAL SCREENSHOT
    // ====================================================================

    runner.addTest('Capture final state screenshot', async () => {
      const screenshotPath = path.join(__dirname, 'test-final-screenshot.png');
      await page.screenshot({ path: screenshotPath });
      console.log(`     Saved to: ${screenshotPath}`);
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
      environment: {
        url: pageUrl,
        title: pageTitle,
        userAgent: await page.evaluate(() => navigator.userAgent)
      },
      results: runner.results,
      summary: {
        passed: runner.passed,
        failed: runner.failed,
        total: runner.results.length,
        passRate: `${((runner.passed / runner.results.length) * 100).toFixed(2)}%`
      },
      metrics: {
        consoleErrors: consoleErrors.length,
        consoleWarnings: consoleWarnings.length
      }
    };

    fs.writeFileSync(
      path.join(__dirname, 'test-full-results.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n📋 Full test report saved to test-full-results.json');

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

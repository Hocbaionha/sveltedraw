#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class PerfAudit {
  constructor(page) {
    this.page = page;
    this.results = {};
    this.errors = [];
  }

  async measureMemory(label) {
    const metrics = await this.page.metrics();
    return {
      label,
      jsHeapUsed: (metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2),
      jsHeapTotal: (metrics.JSHeapTotalSize / 1024 / 1024).toFixed(2),
      timestamp: new Date().toISOString()
    };
  }

  async measureRenderTime(fn, label) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    const duration = (end - start).toFixed(2);

    console.log(`⏱️  ${label}: ${duration}ms`);
    return { label, duration, timestamp: new Date().toISOString() };
  }

  async runMemoryLeakTest() {
    console.log('\n📊 MEMORY LEAK TEST');
    console.log('='.repeat(60));

    const memBefore = await this.measureMemory('Initial');
    console.log(`Start: ${memBefore.jsHeapUsed}MB / ${memBefore.jsHeapTotal}MB`);

    // Simulate heavy drawing - draw 100 rectangles
    const measurements = [memBefore];

    for (let i = 0; i < 10; i++) {
      // Draw 10 rectangles per iteration
      for (let j = 0; j < 10; j++) {
        const canvas = await this.page.$('canvas');
        if (canvas) {
          const box = await canvas.boundingBox();
          const x = box.x + (Math.random() * 400 + 100);
          const y = box.y + (Math.random() * 300 + 100);
          await this.page.mouse.move(x, y);
          await this.page.mouse.down();
          await this.page.mouse.move(x + 50, y + 50);
          await this.page.mouse.up();
          await sleep(50);
        }
      }

      // Measure memory every 10 rectangles
      const mem = await this.measureMemory(`After ${(i + 1) * 10} rects`);
      measurements.push(mem);
      console.log(`  ${(i + 1) * 10} elements: ${mem.jsHeapUsed}MB / ${mem.jsHeapTotal}MB`);

      // Undo all
      for (let k = 0; k < 10; k++) {
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('z');
        await this.page.keyboard.up('Control');
        await sleep(30);
      }
    }

    const memAfter = await this.measureMemory('After cleanup');
    console.log(`End: ${memAfter.jsHeapUsed}MB / ${memAfter.jsHeapTotal}MB`);

    const heapIncrease = parseFloat(memAfter.jsHeapUsed) - parseFloat(memBefore.jsHeapUsed);
    const heapIncreasePercent = ((heapIncrease / parseFloat(memBefore.jsHeapUsed)) * 100).toFixed(2);

    console.log(`\n📈 Memory Delta: ${heapIncrease > 0 ? '+' : ''}${heapIncrease.toFixed(2)}MB (${heapIncreasePercent}%)`);

    this.results.memoryLeak = {
      before: memBefore,
      after: memAfter,
      delta: heapIncrease,
      percentChange: heapIncreasePercent,
      measurements
    };

    if (heapIncrease > 10) {
      this.errors.push(`⚠️  MEMORY LEAK: Heap increased by ${heapIncrease.toFixed(2)}MB after cleanup`);
    }
  }

  async runRenderPerformanceTest() {
    console.log('\n⚡ RENDER PERFORMANCE TEST');
    console.log('='.repeat(60));

    const timings = [];

    // Test 1: Initial page load
    timings.push(await this.measureRenderTime(
      async () => {
        await this.page.goto('http://localhost:5173/#/app', { waitUntil: 'networkidle2' });
      },
      'Page load'
    ));

    await sleep(2000);

    // Test 2: Draw single rectangle (measure frame time)
    timings.push(await this.measureRenderTime(
      async () => {
        const canvas = await this.page.$('canvas');
        if (canvas) {
          const box = await canvas.boundingBox();
          await this.page.mouse.move(box.x + 100, box.y + 100);
          await this.page.mouse.down();
          await this.page.mouse.move(box.x + 150, box.y + 150);
          await this.page.mouse.up();
        }
      },
      'Draw single element'
    ));

    // Test 3: Rapid selection
    timings.push(await this.measureRenderTime(
      async () => {
        for (let i = 0; i < 10; i++) {
          await this.page.keyboard.down('Control');
          await this.page.keyboard.press('a');
          await this.page.keyboard.up('Control');
          await sleep(50);
          await this.page.keyboard.press('Escape');
          await sleep(50);
        }
      },
      'Rapid select/deselect (10x)'
    ));

    // Test 4: Undo/Redo stress
    timings.push(await this.measureRenderTime(
      async () => {
        for (let i = 0; i < 20; i++) {
          await this.page.keyboard.down('Control');
          await this.page.keyboard.press('z');
          await this.page.keyboard.up('Control');
          await sleep(50);
        }
      },
      'Undo stress (20x)'
    ));

    this.results.renderPerformance = { timings };
  }

  async runIDBTest() {
    console.log('\n💾 IDB (IndexedDB) AUDIT');
    console.log('='.repeat(60));

    // Monitor IDB operations
    const idbOperations = [];

    await this.page.evaluate(() => {
      // Hook into IndexedDB to track operations
      window.idbOperations = [];

      const originalOpen = indexedDB.open;
      indexedDB.open = function(...args) {
        window.idbOperations.push({
          type: 'open',
          args,
          timestamp: Date.now()
        });
        return originalOpen.apply(this, args);
      };

      const originalDelete = indexedDB.deleteDatabase;
      indexedDB.deleteDatabase = function(...args) {
        window.idbOperations.push({
          type: 'deleteDatabase',
          args,
          timestamp: Date.now()
        });
        return originalDelete.apply(this, args);
      };
    });

    // Draw several elements to trigger saves
    console.log('Drawing 5 elements to test IDB writes...');
    for (let i = 0; i < 5; i++) {
      const canvas = await this.page.$('canvas');
      if (canvas) {
        const box = await canvas.boundingBox();
        await this.page.mouse.move(box.x + (i * 60) + 100, box.y + 100);
        await this.page.mouse.down();
        await this.page.mouse.move(box.x + (i * 60) + 150, box.y + 150);
        await this.page.mouse.up();
        await sleep(500); // Wait for save
      }
    }

    // Get IDB operations
    const ops = await this.page.evaluate(() => window.idbOperations || []);
    console.log(`📊 IDB operations detected: ${ops.length}`);

    const openOps = ops.filter(op => op.type === 'open');
    console.log(`   - open() calls: ${openOps.length}`);
    console.log(`   - deleteDatabase() calls: ${ops.filter(op => op.type === 'deleteDatabase').length}`);

    // Check for connection per call pattern
    if (openOps.length > 5) {
      this.errors.push(`⚠️  IDB ISSUE: ${openOps.length} open() calls for 5 elements - possible conn-per-call pattern`);
    }

    this.results.idb = {
      totalOperations: ops.length,
      openCalls: openOps.length,
      operations: ops.slice(0, 10) // First 10
    };
  }

  async runRenderHotPathTest() {
    console.log('\n🔥 RENDER HOT-PATH PROFILE');
    console.log('='.repeat(60));

    // Use Performance API to measure rendering
    const perfData = await this.page.evaluate(() => {
      return {
        navigationTiming: {
          domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
          pageLoad: performance.timing.loadEventEnd - performance.timing.navigationStart
        },
        longTasks: performance.getEntriesByType('longtask').map(t => ({
          name: t.name,
          duration: t.duration.toFixed(2),
          startTime: t.startTime.toFixed(2)
        }))
      };
    });

    console.log(`DOM Ready: ${perfData.navigationTiming.domReady}ms`);
    console.log(`Page Load: ${perfData.navigationTiming.pageLoad}ms`);
    console.log(`Long Tasks: ${perfData.longTasks.length}`);

    if (perfData.longTasks.length > 0) {
      console.log('\nLong tasks detected:');
      perfData.longTasks.forEach(task => {
        console.log(`  - ${task.name}: ${task.duration}ms at ${task.startTime}ms`);
      });
      this.errors.push(`⚠️  PERFORMANCE: ${perfData.longTasks.length} long tasks detected`);
    }

    this.results.renderHotPath = perfData;
  }

  async runDomSizeTest() {
    console.log('\n🌳 DOM SIZE & MUTATION TEST');
    console.log('='.repeat(60));

    const domMetrics = await this.page.evaluate(() => {
      return {
        totalElements: document.querySelectorAll('*').length,
        buttons: document.querySelectorAll('button').length,
        inputs: document.querySelectorAll('input').length,
        canvases: document.querySelectorAll('canvas').length,
        maxDepth: Math.max(...Array.from(document.querySelectorAll('*')).map(el => {
          let depth = 0;
          let parent = el;
          while (parent) {
            depth++;
            parent = parent.parentElement;
          }
          return depth;
        }))
      };
    });

    console.log(`Total elements: ${domMetrics.totalElements}`);
    console.log(`Buttons: ${domMetrics.buttons}`);
    console.log(`Inputs: ${domMetrics.inputs}`);
    console.log(`Canvases: ${domMetrics.canvases}`);
    console.log(`Max depth: ${domMetrics.maxDepth}`);

    if (domMetrics.maxDepth > 30) {
      this.errors.push(`⚠️  DOM DEPTH: ${domMetrics.maxDepth} levels deep (potential performance issue)`);
    }

    this.results.domSize = domMetrics;
  }

  async runAltDragDuplicateTest() {
    console.log('\n📋 ALT-DRAG DUPLICATE PATH TEST');
    console.log('='.repeat(60));

    const canvas = await this.page.$('canvas');
    if (!canvas) {
      console.log('No canvas found, skipping alt-drag test');
      return;
    }

    const memBefore = await this.measureMemory('Before alt-drag');
    console.log(`Memory before: ${memBefore.jsHeapUsed}MB`);

    // Draw initial element
    const box = await canvas.boundingBox();
    await this.page.mouse.move(box.x + 100, box.y + 100);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + 150, box.y + 150);
    await this.page.mouse.up();
    await sleep(500);

    // Alt-drag to duplicate 10 times
    for (let i = 0; i < 10; i++) {
      await this.page.keyboard.down('Alt');
      await this.page.mouse.down();
      await this.page.mouse.move(box.x + 100 + (i * 60), box.y + 100 + (i * 30));
      await this.page.mouse.up();
      await this.page.keyboard.up('Alt');
      await sleep(100);
    }

    const memAfter = await this.measureMemory('After alt-drag');
    console.log(`Memory after: ${memAfter.jsHeapUsed}MB`);

    const delta = parseFloat(memAfter.jsHeapUsed) - parseFloat(memBefore.jsHeapUsed);
    console.log(`Delta: ${delta.toFixed(2)}MB`);

    this.results.altDragDuplicate = {
      before: memBefore,
      after: memAfter,
      delta
    };
  }

  printSummary() {
    console.log('\n\n' + '='.repeat(80));
    console.log('PERFORMANCE AUDIT SUMMARY');
    console.log('='.repeat(80));

    if (this.errors.length === 0) {
      console.log('\n✅ No performance issues detected\n');
    } else {
      console.log('\n⚠️  ISSUES FOUND:\n');
      this.errors.forEach(err => console.log(err));
      console.log();
    }

    console.log('\n📊 METRICS:');
    if (this.results.memoryLeak) {
      const mem = this.results.memoryLeak;
      console.log(`  Memory leak test: ${mem.percentChange}% change`);
    }
    if (this.results.domSize) {
      const dom = this.results.domSize;
      console.log(`  DOM elements: ${dom.totalElements} (depth: ${dom.maxDepth})`);
    }
    if (this.results.renderHotPath) {
      const perf = this.results.renderHotPath;
      console.log(`  DOM ready: ${perf.navigationTiming.domReady}ms`);
      console.log(`  Page load: ${perf.navigationTiming.pageLoad}ms`);
    }

    console.log('\n');
  }

  async run() {
    try {
      console.log('\n🚀 PERFORMANCE AUDIT\n');

      await this.runMemoryLeakTest();
      await sleep(1000);

      await this.runRenderPerformanceTest();
      await sleep(1000);

      await this.runDomSizeTest();
      await sleep(1000);

      await this.runRenderHotPathTest();
      await sleep(1000);

      await this.runIDBTest();
      await sleep(1000);

      // await this.runAltDragDuplicateTest();

      this.printSummary();

      return {
        passed: this.errors.length === 0,
        errors: this.errors,
        results: this.results
      };
    } catch (err) {
      console.error('Audit error:', err);
      return { passed: false, error: err.message };
    }
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
      console.log('✅ Dev server started');
      resolve(proc);
    }, 10000);

    proc.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Local:') || output.includes('5173')) {
        clearTimeout(timeout);
        console.log('✅ Dev server started');
        resolve(proc);
      }
    });

    proc.on('error', reject);
  });
}

async function main() {
  let browser, page, serverProc;

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
    page.setDefaultTimeout(20000);

    await page.setViewport({ width: 1280, height: 720 });

    console.log('📍 Navigating to editor...');
    await page.goto('http://localhost:5173/#/app', { waitUntil: 'networkidle2' });
    await sleep(3000);

    const audit = new PerfAudit(page);
    const result = await audit.run();

    // Save results
    fs.writeFileSync(
      path.join(__dirname, 'perf-audit-results.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...result
      }, null, 2)
    );

    console.log('📋 Results saved to perf-audit-results.json\n');

    process.exit(result.passed ? 0 : 1);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    if (serverProc) serverProc.kill();
  }
}

main();

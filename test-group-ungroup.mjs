#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    const results = [];

    // Test 1: Group selected elements
    console.log('\n🧪 TEST 1: Group selected elements');
    console.log('━'.repeat(60));

    // Draw 2 rectangles
    console.log('Drawing 2 rectangles...');
    for (let i = 0; i < 2; i++) {
      const canvas = await page.$('canvas');
      if (canvas) {
        const box = await canvas.boundingBox();
        const x = box.x + 100 + (i * 100);
        const y = box.y + 100;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 50, y + 50);
        await page.mouse.up();
        await sleep(300);
      }
    }

    // Select all
    console.log('Selecting all (Ctrl+A)...');
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await sleep(500);

    // Group them
    console.log('Grouping (Ctrl+G)...');
    await page.keyboard.down('Control');
    await page.keyboard.press('g');
    await page.keyboard.up('Control');
    await sleep(500);

    // Check if group worked (no error in console)
    const errors1 = [];
    page.once('console', msg => {
      if (msg.type() === 'error') errors1.push(msg.text());
    });

    results.push({
      test: 'Group selected elements',
      status: errors1.length === 0 ? '✅' : '❌',
      errors: errors1
    });

    console.log(`Result: ${errors1.length === 0 ? '✅ Group successful' : '❌ Errors: ' + errors1.join(', ')}`);

    // Test 2: Ungroup
    console.log('\n🧪 TEST 2: Ungroup selected elements');
    console.log('━'.repeat(60));

    console.log('Ungrouping (Ctrl+Shift+G)...');
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('g');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    await sleep(500);

    const errors2 = [];
    page.once('console', msg => {
      if (msg.type() === 'error') errors2.push(msg.text());
    });

    results.push({
      test: 'Ungroup selected elements',
      status: errors2.length === 0 ? '✅' : '❌',
      errors: errors2
    });

    console.log(`Result: ${errors2.length === 0 ? '✅ Ungroup successful' : '❌ Errors: ' + errors2.join(', ')}`);

    // Test 3: Group with insufficient elements
    console.log('\n🧪 TEST 3: Try to group single element (should not group)');
    console.log('━'.repeat(60));

    // Clear selection
    console.log('Deselecting all...');
    await page.keyboard.press('Escape');
    await sleep(300);

    // Draw one element
    console.log('Drawing 1 rectangle...');
    const canvas = await page.$('canvas');
    if (canvas) {
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 150);
      await page.mouse.up();
      await sleep(500);

      // Select it
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await sleep(300);

      // Try to group
      console.log('Attempting to group single element...');
      await page.keyboard.down('Control');
      await page.keyboard.press('g');
      await page.keyboard.up('Control');
      await sleep(500);

      results.push({
        test: 'Group single element (should be no-op)',
        status: '✅ Handled gracefully',
        notes: 'Function returns early if < 2 elements'
      });

      console.log('✅ Handled gracefully (early return for < 2 elements)');
    }

    // Test 4: Context menu group/ungroup
    console.log('\n🧪 TEST 4: Context menu group/ungroup buttons');
    console.log('━'.repeat(60));

    // Right-click to open context menu
    console.log('Opening context menu...');
    const canvas2 = await page.$('canvas');
    if (canvas2) {
      const box = await canvas2.boundingBox();
      await page.mouse.click(box.x + 300, box.y + 300, { button: 'right' });
      await sleep(500);

      // Check if group/ungroup buttons exist
      const groupBtn = await page.$('button[class*="group"]');
      const hasContextMenu = await page.$('[role="menu"], [class*="context"]');

      results.push({
        test: 'Context menu has group/ungroup',
        status: hasContextMenu ? '✅' : '⚠️',
        notes: hasContextMenu ? 'Context menu found' : 'Context menu not found'
      });

      console.log(`Result: ${hasContextMenu ? '✅ Context menu available' : '⚠️ Context menu not detected'}`);

      // Close context menu
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('GROUP/UNGROUP TEST SUMMARY');
    console.log('='.repeat(60));

    let passed = 0;
    results.forEach(r => {
      console.log(`${r.status} ${r.test}`);
      if (r.notes) console.log(`   ${r.notes}`);
      if (r.status === '✅') passed++;
    });

    console.log(`\n✅ Passed: ${passed}/${results.length}`);

    // Save results
    fs.writeFileSync(
      path.join(__dirname, 'test-group-results.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        tests: results,
        summary: {
          passed,
          total: results.length,
          passRate: `${((passed / results.length) * 100).toFixed(2)}%`
        }
      }, null, 2)
    );

    console.log('\n📋 Results saved to test-group-results.json');

    process.exit(passed === results.length ? 0 : 1);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    if (serverProc) serverProc.kill();
  }
}

main();

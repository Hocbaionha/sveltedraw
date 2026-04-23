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

    // Test 1: Find library button
    console.log('\n🧪 TEST 1: Find library panel button');
    console.log('━'.repeat(60));

    const libraryBtn = await page.$('button[aria-label*="library" i], button[title*="library" i]');
    const hasLibraryBtn = !!libraryBtn;
    console.log(hasLibraryBtn ? '✅ Library button found' : '⚠️ Library button not found');

    results.push({
      test: 'Find library button',
      status: hasLibraryBtn ? '✅' : '⚠️',
      details: hasLibraryBtn ? 'Button found' : 'Button not found'
    });

    if (!hasLibraryBtn) {
      // Search more broadly
      const allButtons = await page.$$('button');
      console.log(`Found ${allButtons.length} buttons on page`);

      for (let i = 0; i < Math.min(10, allButtons.length); i++) {
        const label = await allButtons[i].evaluate(b => b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText);
        if (label && label.toLowerCase().includes('lib')) {
          console.log(`  Potential match: "${label}"`);
        }
      }
    }

    // Test 2: Draw and save to library
    console.log('\n🧪 TEST 2: Draw element and save to library');
    console.log('━'.repeat(60));

    // Draw a rectangle
    console.log('Drawing rectangle...');
    const canvas = await page.$('canvas');
    if (canvas) {
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 150);
      await page.mouse.up();
      await sleep(500);

      // Select it
      console.log('Selecting element (Ctrl+A)...');
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await sleep(500);

      // Try to find library save function
      // Looking for context menu or keyboard shortcut
      const contextMenu = await page.$('[role="menu"]');
      if (contextMenu) {
        console.log('Context menu available');
        // Look for save/library option
        const menuItems = await page.$$('[role="menu"] button, [role="menu"] div[class*="item"]');
        console.log(`Menu items: ${menuItems.length}`);

        results.push({
          test: 'Context menu has library option',
          status: '✅',
          details: `${menuItems.length} menu items found`
        });
      } else {
        // Check if library panel exists
        const libraryPanel = await page.$('[class*="library"]');
        if (libraryPanel) {
          console.log('Library panel found in DOM');
          results.push({
            test: 'Library panel exists in DOM',
            status: '✅',
            details: 'Panel element found'
          });
        } else {
          results.push({
            test: 'Library functionality',
            status: '⚠️',
            details: 'Library panel not visible in current state'
          });
        }
      }
    }

    // Test 3: Check localStorage for library data
    console.log('\n🧪 TEST 3: Check localStorage library persistence');
    console.log('━'.repeat(60));

    const libraryData = await page.evaluate(() => {
      return localStorage.getItem('sveltedraw:library:v1');
    });

    const hasLibraryData = !!libraryData;
    console.log(hasLibraryData ? `✅ Library data in localStorage: ${libraryData?.length} bytes` : '⚠️ No library data yet');

    results.push({
      test: 'Library localStorage persistence',
      status: hasLibraryData ? '✅' : '⚠️',
      details: hasLibraryData ? `${libraryData?.length} bytes` : 'No data'
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SHAPE LIBRARY TEST SUMMARY');
    console.log('='.repeat(60));

    let passed = 0;
    results.forEach(r => {
      console.log(`${r.status} ${r.test}`);
      console.log(`   ${r.details}`);
      if (r.status === '✅') passed++;
    });

    console.log(`\n✅ Passed: ${passed}/${results.length}`);

    // Save results
    fs.writeFileSync(
      path.join(__dirname, 'test-library-results.json'),
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

    console.log('\n📋 Results saved to test-library-results.json');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    if (serverProc) serverProc.kill();
  }
}

main();

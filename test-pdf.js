// A7: PDF export via jsPDF.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--window-size=1600,1000'],
    defaultViewport: { width: 1600, height: 1000 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('BROWSER ERR:', m.text());
  });
  await page.goto('http://localhost:3005/#app', { waitUntil: 'networkidle2' });
  await delay(2500);

  let pass = 0, fail = 0;
  const log = (name, ok, extra) => {
    console.log(`${ok ? 'OK' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    ok ? pass++ : fail++;
  };

  // Seed two rects + an arrow
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements([
      { id: 'a', type: 'rectangle', x: 100, y: 100, width: 120, height: 80, angle: 0,
        strokeColor: '#000', backgroundColor: '#ffc9c9', fillStyle: 'solid',
        strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
        seed: 1, versionNonce: 1, version: 1, isDeleted: false,
        groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
        link: null, locked: false, roundness: null },
      { id: 'b', type: 'rectangle', x: 400, y: 300, width: 120, height: 80, angle: 0,
        strokeColor: '#000', backgroundColor: '#a5d8ff', fillStyle: 'solid',
        strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
        seed: 2, versionNonce: 2, version: 1, isDeleted: false,
        groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
        link: null, locked: false, roundness: null },
    ], { skipValidation: true });
    p.pushHistory();
  });
  await delay(200);

  // Install download hook that captures (blob, filename) instead of
  // triggering a browser download. Then call handleExport(type:pdf).
  const result = await page.evaluate(async () => {
    return new Promise(async (resolve) => {
      window.__sveltedrawDownloadHook = async (blob, filename) => {
        const buf = await blob.arrayBuffer();
        const arr = new Uint8Array(buf);
        // Stringify to transport over CDP
        let bin = '';
        for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
        resolve({
          ok: true,
          filename,
          len: arr.length,
          b64: btoa(bin),
          first4: Array.from(arr.slice(0, 4)),
        });
      };
      try {
        await window.__sveltedrawProbe.handleExport({
          format: 'pdf',
          fileName: 'test-pdf',
          width: 800, height: 600,
          scale: 1, quality: 0.92,
          includeBackground: true,
          includeBorder: false, borderWidth: 2, borderColor: '#000',
        });
        setTimeout(() => resolve({ ok: false, error: 'hook never fired' }), 100);
      } catch (err) {
        resolve({ ok: false, error: String(err) });
      }
    });
  });
  log('PDF export produced a blob', result.ok,
    result.ok ? `filename=${result.filename} len=${result.len}` : result.error);

  // Diagnostic: try PNG to confirm hook wiring works for the simpler path
  if (!result.ok) {
    const png = await page.evaluate(async () => {
      return new Promise(async (resolve) => {
        window.__sveltedrawDownloadHook = (blob, filename) =>
          resolve({ ok: true, filename, size: blob.size });
        try {
          await window.__sveltedrawProbe.handleExport({
            format: 'png', fileName: 'diag', width: 400, height: 300,
            scale: 1, quality: 0.92, includeBackground: true,
            includeBorder: false, borderWidth: 2, borderColor: '#000',
          });
          setTimeout(() => resolve({ ok: false, error: 'png hook never fired' }), 200);
        } catch (e) { resolve({ ok: false, error: String(e) }); }
      });
    });
    console.log('DIAG (png):', JSON.stringify(png));
  }

  if (!result.ok) {
    console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
    await browser.close();
    process.exit(1);
  }

  log('downloadFile called with .pdf filename',
    /\.pdf$/.test(result.filename), result.filename);
  log('PDF blob starts with %PDF magic bytes',
    result.first4[0] === 0x25 && result.first4[1] === 0x50 &&
    result.first4[2] === 0x44 && result.first4[3] === 0x46,
    `first4=${result.first4.map(b => b.toString(16)).join(' ')}`);
  log('PDF size > 3KB (contains image data)',
    result.len > 3000, `len=${result.len}`);

  // Save for manual inspection
  fs.writeFileSync('C:\\Users\\phank\\workspace-win\\sveltedraw\\test-export.pdf',
    Buffer.from(result.b64, 'base64'));
  console.log('saved test-export.pdf');

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

// B4: PNG paste metadata restoration.
const puppeteer = require('puppeteer');
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

  const mkRect = (id, x, y, bg) => ({
    id, type: 'rectangle', x, y, width: 120, height: 80, angle: 0,
    strokeColor: '#000', backgroundColor: bg, fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    seed: 1, versionNonce: 1, version: 1, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
    link: null, locked: false, roundness: null,
  });

  // TEST 1: export PNG with metadata → has tEXt chunk
  await page.evaluate((els) => {
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements(els, { skipValidation: true });
    p.pushHistory();
    p.bumpSceneRepaint();
  }, [mkRect('a', 200, 200, '#ffc9c9'), mkRect('b', 500, 350, '#a5d8ff')]);
  await delay(200);

  const hasMetadata = await page.evaluate(async () => {
    const blob = await window.__sveltedrawProbe.exportPngWithMetadata();
    if (!blob) return { ok: false };
    const buf = await blob.arrayBuffer();
    const arr = new Uint8Array(buf);
    // Look for tEXt chunk in PNG — just scan for the ASCII "tEXt" bytes.
    let hasText = false;
    for (let i = 0; i < arr.length - 4; i++) {
      if (arr[i] === 0x74 && arr[i + 1] === 0x45 && arr[i + 2] === 0x58 && arr[i + 3] === 0x74) {
        hasText = true;
        break;
      }
    }
    return { ok: true, hasText, size: arr.length };
  });
  log('PNG export with metadata contains tEXt chunk',
    hasMetadata.ok && hasMetadata.hasText,
    JSON.stringify(hasMetadata));

  // TEST 2: round trip — clear scene, paste PNG, original elements restored
  await page.evaluate(async () => {
    // Save the PNG for pasting
    window.__savedPng = await window.__sveltedrawProbe.exportPngWithMetadata();
    // Clear scene
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements([], { skipValidation: true });
    p.bumpSceneRepaint();
  });
  await delay(100);

  const cleared = await page.evaluate(() =>
    window.__sveltedrawProbe.scene.getNonDeletedElements().length);
  log('scene cleared before paste test', cleared === 0, `count=${cleared}`);

  const restored = await page.evaluate(async () => {
    const blob = window.__savedPng;
    if (!blob) return { ok: false, error: 'no saved PNG' };
    const ok = await window.__sveltedrawProbe.tryRestoreSceneFromPng(blob);
    const els = window.__sveltedrawProbe.scene.getNonDeletedElements();
    return {
      ok,
      count: els.length,
      ids: els.map((e) => e.id).sort(),
      types: els.map((e) => e.type),
    };
  });
  log('tryRestoreSceneFromPng returns true for Excalidraw PNG',
    restored.ok, JSON.stringify(restored));
  log('restored scene has the original 2 rectangles',
    restored.count === 2 && restored.ids.join(',') === 'a,b',
    JSON.stringify(restored));

  // TEST 3: non-Excalidraw PNG → returns false (fall through to image insert)
  const plainFails = await page.evaluate(async () => {
    // Create a plain PNG blob from a canvas (no metadata chunk)
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#00f';
    ctx.fillRect(0, 0, 16, 16);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    return await window.__sveltedrawProbe.tryRestoreSceneFromPng(blob);
  });
  log('plain PNG → tryRestoreSceneFromPng returns false',
    plainFails === false, `returned=${plainFails}`);

  // TEST 4: paste via ClipboardEvent simulates real paste flow
  await page.evaluate(async () => {
    const p = window.__sveltedrawProbe;
    p.scene.replaceAllElements([], { skipValidation: true });
    p.bumpSceneRepaint();
  });
  await delay(100);
  const pasted = await page.evaluate(async () => {
    const blob = window.__savedPng;
    const file = new File([blob], 'scene.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const evt = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(evt);
    // tryRestore is async; give it a beat
    await new Promise((r) => setTimeout(r, 250));
    return window.__sveltedrawProbe.scene.getNonDeletedElements().length;
  });
  log('real ClipboardEvent paste restores scene (2 elements)',
    pasted === 2, `count=${pasted}`);

  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();

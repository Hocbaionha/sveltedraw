// Phase 16 honest integration test
//
// Unlike the per-feature scripts that only click buttons and hardcode
// `test(name, true)`, this test verifies real behavior:
//   - side panels are *on-screen* (right edge within the viewport)
//   - opening one panel closes others (mutual exclusion)
//   - exporting PNG produces a real PNG signature; exporting SVG contains
//     actual drawing primitives (path/rect/line/circle), not a placeholder
//   - PDF shows an honest alert and does NOT write a fake file
//   - history panel lists the real undo stack and jump restores state
//   - library insert actually adds elements to the scene
//   - presentation shows pre-rendered SVG content, not just a title
//
// Usage: node test-phase16-honest.js  (vite dev must be on :3005)

const puppeteer = require('puppeteer');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = 3005;

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--window-size=1600,1000'],
    defaultViewport: { width: 1600, height: 1000 },
  });
  const page = await browser.newPage();

  let pass = 0, fail = 0;
  const log = (name, ok, extra) => {
    if (ok) { console.log(`OK   ${name}${extra ? ' — ' + extra : ''}`); pass++; }
    else    { console.log(`FAIL ${name}${extra ? ' — ' + extra : ''}`); fail++; }
  };

  // Collect alerts/blobs from the page.
  const alertMessages = [];
  page.on('dialog', async (d) => { alertMessages.push(d.message()); await d.dismiss(); });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      console.log(`BROWSER ${m.type()}:`, m.text());
    }
  });
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) console.log('NAV:', f.url());
  });

  try {
    console.log(`\n== Phase 16 honest integration test ==\n`);

    await page.goto(`http://localhost:${PORT}/#app`, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });
    await delay(2500);

    // Hook blob downloads: intercept anchor clicks and record blob contents
    // as base64 so Node can verify the byte signature.
    await page.evaluate(() => {
      (window).__downloads = [];
      const blobStore = new Map();
      const origCreate = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const url = origCreate(blob);
        blobStore.set(url, blob);
        return url;
      };
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = async function () {
        if (this.download && this.href.startsWith('blob:')) {
          const blob = blobStore.get(this.href);
          if (blob) {
            const buf = await blob.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let b64 = '';
            for (let i = 0; i < bytes.byteLength; i++) b64 += String.fromCharCode(bytes[i]);
            (window).__downloads.push({
              filename: this.download,
              type: blob.type,
              size: blob.size,
              head: Array.from(bytes.slice(0, 16)).map(n => n.toString(16).padStart(2, '0')).join(''),
              text: blob.type.startsWith('image/svg') || blob.type.includes('json') || blob.type.includes('text')
                ? new TextDecoder().decode(bytes.slice(0, Math.min(bytes.byteLength, 20000)))
                : undefined,
            });
            return; // suppress actual download
          }
        }
        return origClick.call(this);
      };
    });

    // ── 1. PANEL POSITIONING & MUTUAL EXCLUSION ─────────────────────────
    console.log('\n--- Panel positioning ---');

    // Close anything potentially open from a previous session
    await page.evaluate(() => (window).__sveltedrawProbe?.closeAllSidePanels?.());
    await delay(100);

    const panelSpecs = [
      { name: 'history',     ariaLabel: 'History',       selector: '.sveltedraw-history-panel' },
      { name: 'library',     ariaLabel: 'Shape Library', selector: '.sveltedraw-shape-library-panel' },
      { name: 'layer',       ariaLabel: 'Layers',        selector: '.sveltedraw-layer-panel' },
      { name: 'grid',        ariaLabel: 'Grid & Snap',   selector: '.sveltedraw-grid-panel' },
      { name: 'texteditor',  ariaLabel: 'Text Editor',   selector: '.sveltedraw-texteditor-panel' },
      { name: 'measurement', ariaLabel: 'Measurements',  selector: '.sveltedraw-measurement-panel' },
      { name: 'autolayout',  ariaLabel: 'Auto Layout',   selector: '.sveltedraw-autolayout-panel' },
    ];

    for (const spec of panelSpecs) {
      // Open via the toolbar button (not probe) so we exercise the click path.
      const clicked = await page.evaluate((label) => {
        const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
          .find(b => b.getAttribute('aria-label') === label);
        if (btn) { btn.click(); return true; }
        return false;
      }, spec.ariaLabel);
      log(`Button '${spec.ariaLabel}' exists`, clicked);
      await delay(150);

      const geom = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, visible: r.width > 0 && r.height > 0 };
      }, spec.selector);
      log(`Panel '${spec.name}' renders`, !!geom);
      if (geom) {
        const onScreen = geom.left >= 0 && geom.right <= 1600 && geom.visible;
        log(`Panel '${spec.name}' on-screen`, onScreen,
          `left=${geom.left.toFixed(0)} right=${geom.right.toFixed(0)}`);
      }
    }

    // Mutual exclusion: open history, open library → history must close.
    await page.evaluate(() => (window).__sveltedrawProbe?.closeAllSidePanels?.());
    await delay(100);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
        .find(b => b.getAttribute('aria-label') === 'History');
      btn?.click();
    });
    await delay(100);
    const historyOpenBefore = await page.evaluate(() => !!document.querySelector('.sveltedraw-history-panel'));
    log('History panel open after click', historyOpenBefore);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
        .find(b => b.getAttribute('aria-label') === 'Shape Library');
      btn?.click();
    });
    await delay(150);
    const historyClosedAfter = await page.evaluate(() => !document.querySelector('.sveltedraw-history-panel'));
    const libraryOpen = await page.evaluate(() => !!document.querySelector('.sveltedraw-shape-library-panel'));
    log('Opening Library closes History (mutual exclusion)', historyClosedAfter && libraryOpen);

    // Second click on same button → closes it.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
        .find(b => b.getAttribute('aria-label') === 'Shape Library');
      btn?.click();
    });
    await delay(150);
    const libraryClosed = await page.evaluate(() => !document.querySelector('.sveltedraw-shape-library-panel'));
    log('Second click on active button closes it', libraryClosed);

    // ── 2. SEED A SIMPLE SCENE VIA THE PROBE ────────────────────────────
    console.log('\n--- Seed scene ---');
    const seeded = await page.evaluate(() => {
      const p = (window).__sveltedrawProbe;
      if (!p) return false;
      const el = {
        id: 'e_rect_' + Date.now(),
        type: 'rectangle',
        x: 200, y: 200, width: 160, height: 100,
        angle: 0,
        strokeColor: '#1e1e1e',
        backgroundColor: '#ffc9c9',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        seed: Math.floor(Math.random() * 2 ** 31),
        versionNonce: 1,
        version: 1,
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        roundness: null,
      };
      p.scene.replaceAllElements([el], { skipValidation: true });
      p.pushHistory();
      return true;
    });
    log('Probe available + scene seeded', seeded);

    const sceneCount = await page.evaluate(() => (window).__sveltedrawProbe.scene.getNonDeletedElements().length);
    log('Scene has 1 element', sceneCount === 1, `count=${sceneCount}`);

    // ── 3. HISTORY PANEL WIRING ─────────────────────────────────────────
    console.log('\n--- History panel wiring ---');
    const historyLen = await page.evaluate(() => (window).__sveltedrawHistoryLen());
    log('Real history has >= 2 entries (init + rect)', historyLen >= 2, `len=${historyLen}`);

    const editorHistLen = await page.evaluate(() => (window).__sveltedrawProbe.getEditorHistory().length);
    log('HistoryPanel view matches real history length', editorHistLen === historyLen,
      `panel=${editorHistLen} real=${historyLen}`);

    // Open history panel and confirm empty state is NOT shown.
    await page.evaluate(() => (window).__sveltedrawProbe.toggleSidePanel('history'));
    await delay(200);
    const emptyMessageVisible = await page.evaluate(() => {
      const el = document.querySelector('.hp-empty');
      return !!el && el.offsetParent !== null;
    });
    log('History panel does NOT show "No history yet"', !emptyMessageVisible);

    const listItemCount = await page.evaluate(() => document.querySelectorAll('.hp-item').length);
    log('History panel lists at least one item', listItemCount >= 1, `items=${listItemCount}`);

    // Add a second element so we have something to jump back FROM.
    await page.evaluate(() => {
      const p = (window).__sveltedrawProbe;
      const existing = p.scene.getNonDeletedElements();
      const el2 = {
        id: 'e_ellipse_' + Date.now(),
        type: 'ellipse',
        x: 500, y: 300, width: 120, height: 80,
        angle: 0,
        strokeColor: '#1e1e1e',
        backgroundColor: '#a5d8ff',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        seed: Math.floor(Math.random() * 2 ** 31),
        versionNonce: 2,
        version: 1,
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        roundness: null,
      };
      p.scene.replaceAllElements([...existing, el2], { skipValidation: true });
      p.pushHistory();
    });
    await delay(150);
    const lenBefore = await page.evaluate(() => (window).__sveltedrawProbe.scene.getNonDeletedElements().length);
    log('Scene has 2 elements before jump', lenBefore === 2, `count=${lenBefore}`);

    // Jump to the first history state (index 0 — empty scene).
    await page.evaluate(() => (window).__sveltedrawProbe.jumpHistory(0));
    await delay(150);
    const lenAfterJump = await page.evaluate(() => (window).__sveltedrawProbe.scene.getNonDeletedElements().length);
    log('History jump to index 0 restores empty scene', lenAfterJump === 0, `count=${lenAfterJump}`);

    // Jump forward to last state — should restore 2 elements.
    const lastIdx = await page.evaluate(() => (window).__sveltedrawProbe.getEditorHistory().length - 1);
    await page.evaluate((i) => (window).__sveltedrawProbe.jumpHistory(i), lastIdx);
    await delay(150);
    const lenAfterForward = await page.evaluate(() => (window).__sveltedrawProbe.scene.getNonDeletedElements().length);
    log('History jump to latest restores 2 elements', lenAfterForward === 2, `count=${lenAfterForward}`);

    // Clear history — should reset list to 1 entry (the current state).
    await page.evaluate(() => (window).__sveltedrawProbe.clearHistory());
    await delay(150);
    const lenAfterClear = await page.evaluate(() => (window).__sveltedrawProbe.getEditorHistory().length);
    log('Clear history reduces list to 1', lenAfterClear === 1, `len=${lenAfterClear}`);
    const sceneStillThere = await page.evaluate(() => (window).__sveltedrawProbe.scene.getNonDeletedElements().length);
    log('Clear history preserves scene', sceneStillThere === 2, `count=${sceneStillThere}`);

    // ── 4. LIBRARY INSERT ───────────────────────────────────────────────
    console.log('\n--- Library insert ---');

    // Create a component directly (bypass the prompt dialog).
    const componentCreated = await page.evaluate(() => {
      const p = (window).__sveltedrawProbe;
      const [a, b] = p.scene.getNonDeletedElements();
      // Build a fake library component using the saved scene elements.
      const fakeComp = {
        id: 'comp-test',
        name: 'Test Component',
        category: 'custom',
        tags: [],
        created: Date.now(),
        modified: Date.now(),
        elements: [JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))],
        usage: 0,
      };
      return fakeComp;
    });

    const beforeInsert = await page.evaluate(() => (window).__sveltedrawProbe.scene.getNonDeletedElements().length);
    await page.evaluate((comp) => (window).__sveltedrawProbe.insertLibraryComponent(comp), componentCreated);
    await delay(150);
    const afterInsert = await page.evaluate(() => (window).__sveltedrawProbe.scene.getNonDeletedElements().length);
    log('Library insert adds elements to scene', afterInsert === beforeInsert + 2,
      `before=${beforeInsert} after=${afterInsert}`);

    const insertedAtCenter = await page.evaluate((beforeCount) => {
      const all = (window).__sveltedrawProbe.scene.getNonDeletedElements();
      const inserted = all.slice(beforeCount);
      return inserted.every(el => Number.isFinite(el.x) && Number.isFinite(el.y));
    }, beforeInsert);
    log('Inserted elements have finite coordinates', insertedAtCenter);

    // ── TEXT STYLING (renderer + UI) ────────────────────────────────────
    console.log('\n--- Text styling renderer + UI ---');

    // Seed a text element
    await page.evaluate(() => {
      const p = (window).__sveltedrawProbe;
      const el = {
        id: 't_style', type: 'text', x: 100, y: 100, width: 300, height: 60,
        angle: 0, strokeColor: '#111', backgroundColor: 'transparent',
        fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0,
        opacity: 100, seed: 1, versionNonce: 1, version: 1, isDeleted: false,
        groupIds: [], frameId: null, boundElements: null, updated: Date.now(),
        link: null, locked: false, roundness: null,
        text: 'Hello', fontSize: 32, fontFamily: 2, textAlign: 'left',
        verticalAlign: 'top', baseline: 28, containerId: null, originalText: 'Hello',
      };
      p.scene.replaceAllElements([el], { skipValidation: true });
      p.appState.selectedElementIds = { t_style: true };
      p.pushHistory();
    });
    await delay(300);

    // Format row visible for text
    const formatRowVisible = await page.evaluate(() => {
      const rows = document.querySelectorAll('.sveltedraw-style-panel .sp-row');
      for (const r of rows) {
        const l = r.querySelector('.sp-label');
        if (l && l.textContent.trim() === 'Format') return true;
      }
      return false;
    });
    log('Format row visible when text is selected', formatRowVisible);

    // Click Bold → element fontWeight = "bold"
    await page.evaluate(() => {
      document.querySelector('[data-preset="fontWeight"][data-value="bold"]').click();
    });
    await delay(200);
    const bold = await page.evaluate(() =>
      (window).__sveltedrawProbe.scene.getNonDeletedElements()[0].fontWeight);
    log('Click Bold → fontWeight="bold"', bold === 'bold');

    // SVG export reflects bold
    const svgBold = await page.evaluate(async () => {
      const svg = await (window).__sveltedrawProbe.exportAsSvg();
      return svg ? svg.outerHTML : '';
    });
    log('SVG export honors bold (font-weight="bold" in <text>)',
      /font-weight=["']bold["']/.test(svgBold));

    // Click Italic
    await page.evaluate(() => {
      document.querySelector('[data-preset="fontStyle"][data-value="italic"]').click();
    });
    await delay(200);
    const svgItalic = await page.evaluate(async () => {
      const svg = await (window).__sveltedrawProbe.exportAsSvg();
      return svg ? svg.outerHTML : '';
    });
    log('SVG export honors italic (font-style="italic")',
      /font-style=["']italic["']/.test(svgItalic));

    // Click Underline
    await page.evaluate(() => {
      document.querySelector('[data-preset="textDecoration"][data-value="underline"]').click();
    });
    await delay(200);
    const svgUnder = await page.evaluate(async () => {
      const svg = await (window).__sveltedrawProbe.exportAsSvg();
      return svg ? svg.outerHTML : '';
    });
    log('SVG export honors underline (text-decoration="underline")',
      /text-decoration=["']underline["']/.test(svgUnder));

    // PNG bytes differ between styled and plain (canvas honored the props)
    const pngBytes = async () => await page.evaluate(async () => {
      const blob = await (window).__sveltedrawProbe.exportAsPng();
      const arr = new Uint8Array(await blob.arrayBuffer());
      return Array.from(arr);
    });
    const pngStyled = await pngBytes();

    // Clear all text styles
    await page.evaluate(() => {
      const p = (window).__sveltedrawProbe;
      const el = p.scene.getNonDeletedElements()[0];
      p.scene.mutateElement(el, { fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none' }, { informMutation: false, isDragging: false });
      p.pushHistory();
    });
    await delay(200);
    const pngPlain = await pngBytes();
    const bytesDiffer = pngStyled.length !== pngPlain.length ||
      pngStyled.some((b, i) => b !== pngPlain[i]);
    log('PNG bytes differ between styled and plain text (canvas honored props)',
      bytesDiffer, `styled=${pngStyled.length}b plain=${pngPlain.length}b`);

    // Clean up text element so subsequent tests see a clean slate
    await page.evaluate(() => {
      const p = (window).__sveltedrawProbe;
      p.scene.replaceAllElements([], { skipValidation: true });
      p.appState.selectedElementIds = {};
      p.pushHistory();
    });
    await delay(150);

    // Re-seed base scene for the rest of the suite (rect + ellipse)
    await page.evaluate(() => {
      const p = (window).__sveltedrawProbe;
      const mk = (o) => ({
        id: 'e_' + Math.random().toString(36).slice(2),
        type: 'rectangle', x: 200, y: 200, width: 160, height: 100, angle: 0,
        strokeColor: '#1e1e1e', backgroundColor: '#ffc9c9', fillStyle: 'solid',
        strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
        seed: Math.floor(Math.random() * 2 ** 31), versionNonce: 1, version: 1,
        isDeleted: false, groupIds: [], frameId: null, boundElements: null,
        updated: Date.now(), link: null, locked: false, roundness: null, ...o,
      });
      p.scene.replaceAllElements([
        mk({ x: 300, y: 300 }),
        mk({ x: 600, y: 400, type: 'ellipse', backgroundColor: '#a5d8ff' }),
      ], { skipValidation: true });
      p.pushHistory();
    });
    await delay(200);

    // ── 5. EXPORT: JSON, SVG, PNG, PDF ──────────────────────────────────
    console.log('\n--- Export JSON ---');
    await page.evaluate(() => ((window).__downloads = []));
    await page.evaluate(() => {
      const p = (window).__sveltedrawProbe;
      return p.handleExport({
        format: 'json',
        width: 1920, height: 1080, scale: 1, quality: 0.95,
        includeBackground: true, includeBorder: false,
        borderWidth: 8, borderColor: '#ffffff',
        fileName: 'test-drawing',
      });
    });
    await delay(300);
    const jsonDl = await page.evaluate(() => (window).__downloads.slice());
    log('JSON download fired', jsonDl.length === 1);
    if (jsonDl[0]) {
      log('JSON filename is test-drawing.json', jsonDl[0].filename === 'test-drawing.json');
      log('JSON mime is application/json', jsonDl[0].type === 'application/json');
      try {
        const parsed = JSON.parse(jsonDl[0].text);
        log('JSON body is valid excalidraw', parsed.type === 'excalidraw' && Array.isArray(parsed.elements));
      } catch (e) {
        log('JSON body is valid excalidraw', false, e.message);
      }
    }

    console.log('\n--- Export SVG ---');
    await page.evaluate(() => ((window).__downloads = []));
    await page.evaluate(() => {
      const p = (window).__sveltedrawProbe;
      return p.handleExport({
        format: 'svg',
        width: 1920, height: 1080, scale: 1, quality: 0.95,
        includeBackground: true, includeBorder: false,
        borderWidth: 8, borderColor: '#ffffff',
        fileName: 'test-drawing',
      });
    });
    await delay(500);
    const svgDl = await page.evaluate(() => (window).__downloads.slice());
    log('SVG download fired', svgDl.length === 1);
    if (svgDl[0]) {
      log('SVG filename is test-drawing.svg', svgDl[0].filename === 'test-drawing.svg');
      log('SVG mime is image/svg+xml', svgDl[0].type === 'image/svg+xml');
      const body = svgDl[0].text || '';
      log('SVG body starts with <svg>', /^<svg\s|^<\?xml[^>]*\?>\s*<svg/.test(body.trim()));
      const hasRealContent = /<(path|rect|line|circle|ellipse|g\b)/i.test(body);
      log('SVG body contains real draw primitives (not just a <!-- N elements --> placeholder)',
        hasRealContent);
      log('SVG body does NOT contain placeholder comment',
        !/<!--\s*\d+\s+elements\s*-->/.test(body));
    }

    console.log('\n--- Export PNG ---');
    await page.evaluate(() => ((window).__downloads = []));
    await page.evaluate(() => {
      const p = (window).__sveltedrawProbe;
      return p.handleExport({
        format: 'png',
        width: 800, height: 600, scale: 1, quality: 0.95,
        includeBackground: true, includeBorder: false,
        borderWidth: 8, borderColor: '#ffffff',
        fileName: 'test-drawing',
      });
    });
    await delay(1500);
    const pngDl = await page.evaluate(() => (window).__downloads.slice());
    log('PNG download fired', pngDl.length === 1);
    if (pngDl[0]) {
      log('PNG filename is test-drawing.png', pngDl[0].filename === 'test-drawing.png');
      log('PNG mime is image/png', pngDl[0].type === 'image/png');
      // Real PNG signature: 89 50 4E 47 0D 0A 1A 0A
      const isRealPng = pngDl[0].head.startsWith('89504e470d0a1a0a');
      log('PNG body has real PNG signature (not stub text)', isRealPng, `head=${pngDl[0].head}`);
      log('PNG body is larger than 100 bytes', pngDl[0].size > 100, `size=${pngDl[0].size}`);
    }

    // Read PNG IHDR dimensions. PNG spec: bytes 8-15 are IHDR chunk length + "IHDR",
    // bytes 16-19 = width (big-endian u32), bytes 20-23 = height.
    const readPngDims = (headHex) => {
      const hex = headHex.replace(/\s+/g, '');
      const b = (i) => parseInt(hex.substr(i * 2, 2), 16);
      const u32 = (i) => (b(i) << 24) | (b(i + 1) << 16) | (b(i + 2) << 8) | b(i + 3);
      return { width: u32(16) >>> 0, height: u32(20) >>> 0 };
    };

    console.log('\n--- Export dimensions ---');

    // Base reference: small export at scale=1, width=400, height=300
    await page.evaluate(() => ((window).__downloads = []));
    await page.evaluate(() =>
      (window).__sveltedrawProbe.handleExport({
        format: 'png', width: 400, height: 300, scale: 1, quality: 0.95,
        includeBackground: true, includeBorder: false,
        borderWidth: 8, borderColor: '#ffffff', fileName: 'small',
      }));
    await delay(1200);
    // Grab more bytes for IHDR read — we only stored 16 bytes of head, which is enough.
    const smallDl = await page.evaluate(() =>
      (window).__downloads.slice().map((d) => ({
        ...d,
        // Head is 16 bytes, but IHDR starts at byte 8 and width is at byte 16.
        // We need 24 bytes total. Store wider head via re-hook:
      })));
    // Re-run with wider head capture: rehook URL.createObjectURL once to store 32 bytes.
    await page.evaluate(() => {
      (window).__widePngHeads = [];
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = async function () {
        // Only re-capture PNG downloads we're about to fire.
        if (this.download?.endsWith('.png') && this.href.startsWith('blob:')) {
          const resp = await fetch(this.href);
          const buf = new Uint8Array(await resp.arrayBuffer());
          (window).__widePngHeads.push({
            filename: this.download,
            headHex: Array.from(buf.slice(0, 32)).map(n => n.toString(16).padStart(2, '0')).join(''),
            size: buf.byteLength,
          });
          return;
        }
        return origClick.call(this);
      };
    });

    await page.evaluate(() => ((window).__widePngHeads = []));
    await page.evaluate(() =>
      (window).__sveltedrawProbe.handleExport({
        format: 'png', width: 400, height: 300, scale: 1, quality: 0.95,
        includeBackground: true, includeBorder: false,
        borderWidth: 8, borderColor: '#ffffff', fileName: 'scale1',
      }));
    await delay(1200);
    await page.evaluate(() =>
      (window).__sveltedrawProbe.handleExport({
        format: 'png', width: 400, height: 300, scale: 2, quality: 0.95,
        includeBackground: true, includeBorder: false,
        borderWidth: 8, borderColor: '#ffffff', fileName: 'scale2',
      }));
    await delay(1200);
    await page.evaluate(() =>
      (window).__sveltedrawProbe.handleExport({
        format: 'png', width: 800, height: 600, scale: 1, quality: 0.95,
        includeBackground: true, includeBorder: false,
        borderWidth: 8, borderColor: '#ffffff', fileName: 'big',
      }));
    await delay(1200);

    const heads = await page.evaluate(() => (window).__widePngHeads.slice());
    const byName = Object.fromEntries(heads.map((h) => [h.filename, h]));

    const s1 = byName['scale1.png'];
    const s2 = byName['scale2.png'];
    const big = byName['big.png'];

    log('scale1.png produced', !!s1);
    log('scale2.png produced', !!s2);
    log('big.png produced', !!big);

    if (s1 && s2) {
      const d1 = readPngDims(s1.headHex);
      const d2 = readPngDims(s2.headHex);
      log('scale=1 PNG dims ≈ target 400×300', d1.width === 400 && d1.height === 300,
        `${d1.width}×${d1.height}`);
      log('scale=2 PNG dims = 800×600 (2× target)', d2.width === 800 && d2.height === 600,
        `${d2.width}×${d2.height}`);
      log('scale=2 file is larger than scale=1', s2.size > s1.size,
        `s1=${s1.size} s2=${s2.size}`);
    }
    if (big && s1) {
      const dB = readPngDims(big.headHex);
      log('width=800 PNG is 800×600 (bigger than 400×300)',
        dB.width === 800 && dB.height === 600, `${dB.width}×${dB.height}`);
    }

    // Border SVG is valid (numeric, no calc())
    console.log('\n--- Border SVG validity ---');
    await page.evaluate(() => ((window).__downloads = []));
    await page.evaluate(() =>
      (window).__sveltedrawProbe.handleExport({
        format: 'svg', width: 1920, height: 1080, scale: 1, quality: 0.95,
        includeBackground: true, includeBorder: true,
        borderWidth: 8, borderColor: '#ff00ff', fileName: 'bordered',
      }));
    await delay(400);
    const borderDl = await page.evaluate(() => (window).__downloads.slice());
    if (borderDl[0]) {
      const body = borderDl[0].text || '';
      log('Border SVG body contains no calc() in attributes', !/=\s*["']calc\(/.test(body));
      log('Border SVG body contains border rect with numeric attrs',
        /<rect[^>]+stroke="#ff00ff"[^>]+stroke-width="8"/.test(body));
      // Parse as XML to verify validity.
      const parsed = await page.evaluate((xml) => {
        const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
        const err = doc.querySelector('parsererror');
        return err ? err.textContent : null;
      }, body);
      log('Bordered SVG parses as valid XML', parsed === null, parsed ?? '');
    }

    console.log('\n--- Export PDF (graceful) ---');
    alertMessages.length = 0;
    await page.evaluate(() => ((window).__downloads = []));
    await page.evaluate(() => {
      const p = (window).__sveltedrawProbe;
      return p.handleExport({
        format: 'pdf',
        width: 1920, height: 1080, scale: 1, quality: 0.95,
        includeBackground: true, includeBorder: false,
        borderWidth: 8, borderColor: '#ffffff',
        fileName: 'test-drawing',
      });
    });
    await delay(300);
    const pdfDl = await page.evaluate(() => (window).__downloads.slice());
    log('PDF does NOT produce a download', pdfDl.length === 0);
    log('PDF shows user-facing alert (honest not-supported)',
      alertMessages.some(m => /pdf/i.test(m) && /not.*supported|support/i.test(m)));

    // ── 6. PRESENTATION MODE ────────────────────────────────────────────
    console.log('\n--- Presentation mode ---');
    await page.evaluate(() => (window).__sveltedrawProbe.closeAllSidePanels());
    await delay(100);

    await page.evaluate(async () => { await (window).__sveltedrawProbe.startPresentation(); });
    await delay(1500); // SVG pre-render is async

    const active = await page.evaluate(() => (window).__sveltedrawProbe.isPresentationActive());
    let presentationOpen = await page.evaluate(() => !!document.querySelector('.presentation-mode'));
    if (active && !presentationOpen) {
      // Svelte may still be in an async flush — try waiting for the selector.
      try {
        await page.waitForSelector('.presentation-mode', { timeout: 3000 });
        presentationOpen = true;
      } catch {
        // diagnostic: dump the DOM around where PresentationMode should mount
        const diag = await page.evaluate(() => ({
          hasExcalidraw: !!document.querySelector('.excalidraw'),
          bodyChildCount: document.body.children.length,
          lastChildTag: document.body.lastElementChild?.tagName,
          fixedElements: Array.from(document.querySelectorAll('*')).filter(e => {
            const s = getComputedStyle(e); return s.position === 'fixed' && s.zIndex === '1000';
          }).length,
        }));
        console.log('  DIAG:', JSON.stringify(diag));
      }
    }
    log('Presentation mode opens', presentationOpen,
      `active=${active} dom=${presentationOpen}`);

    const slidesCount = await page.evaluate(() =>
      (window).__sveltedrawProbe.getPresentationSlides().length);
    log('Has at least one slide', slidesCount >= 1, `slides=${slidesCount}`);

    const slideSvgCount = await page.evaluate(() =>
      (window).__sveltedrawProbe.getPresentationSlideSvgs().filter(s => s && s.length > 50).length);
    log('Pre-rendered SVG exists for slides (actual content)', slideSvgCount >= 1,
      `svgs=${slideSvgCount}`);

    const canvasHasSvg = await page.evaluate(() => {
      const canvas = document.querySelector('.pm-slide-canvas');
      return !!canvas && !!canvas.querySelector('svg');
    });
    log('Presentation canvas renders a real SVG element', canvasHasSvg);

    const canvasSvgHasContent = await page.evaluate(() => {
      const canvas = document.querySelector('.pm-slide-canvas');
      const svg = canvas?.querySelector('svg');
      if (!svg) return false;
      return !!svg.querySelector('path, rect, line, circle, ellipse, g > *');
    });
    log('Slide SVG contains draw primitives (not empty)', canvasSvgHasContent);

    // Exit presentation via Escape key.
    await page.keyboard.press('Escape');
    await delay(300);
    const presentationClosed = await page.evaluate(() => !document.querySelector('.presentation-mode'));
    log('Escape exits presentation mode', presentationClosed);

    // ── Summary ─────────────────────────────────────────────────────────
    console.log(`\n== SUMMARY ==`);
    console.log(`PASS: ${pass}`);
    console.log(`FAIL: ${fail}`);
    console.log(`TOTAL: ${pass + fail}`);
    if (fail === 0) {
      console.log(`\nAll honest checks passed.`);
    } else {
      console.log(`\n${fail} honest check(s) failed.`);
    }
  } catch (err) {
    console.error('\nFatal test error:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await browser.close();
    if (fail > 0) process.exitCode = 1;
  }
})();

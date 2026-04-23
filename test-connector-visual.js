const puppeteer = require('puppeteer');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--window-size=1600,1000'], defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 2 }});
  const page = await browser.newPage();
  await page.goto('http://localhost:3005/#app', { waitUntil: 'networkidle2' });
  await delay(2500);

  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const mk = (id, x, y, bg) => ({
      id, type: 'rectangle', x, y, width: 160, height: 90, angle: 0,
      strokeColor: '#1e1e1e', backgroundColor: bg, fillStyle: 'solid',
      strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
      seed: Math.floor(Math.random() * 2 ** 31), versionNonce: 1, version: 1,
      isDeleted: false, groupIds: [], frameId: null, boundElements: null,
      updated: Date.now(), link: null, locked: false, roundness: null,
    });
    p.scene.replaceAllElements([
      mk('A', 200, 250, '#ffc9c9'),
      mk('B', 700, 450, '#a5d8ff'),
    ], { skipValidation: true });
    p.pushHistory();
  });
  await delay(400);

  // Create connector via probe (bypass pointer events)
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    // Force connector-tool path via simulated clicks
    const canvas = document.querySelector('canvas.excalidraw__canvas.interactive');
    const rect = canvas.getBoundingClientRect();
    const zoom = p.appState.zoom.value;
    const click = (sx, sy) => canvas.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: rect.left + sx * zoom, clientY: rect.top + sy * zoom,
      button: 0, bubbles: true, pointerType: 'mouse',
    }));
    // Toggle tool
    const btn = Array.from(document.querySelectorAll('.sveltedraw-util-btn'))
      .find(b => b.getAttribute('aria-label') === 'Connector tool');
    btn.click();
    // Click shape A center
    click(280, 295);
    click(780, 495);
  });
  await delay(500);
  await page.screenshot({ path: 'connector-initial.png', clip: { x: 0, y: 200, width: 1200, height: 600 }});
  console.log('saved connector-initial.png');

  // Move shape A — replicate the real drag flow:
  // scene.mutateElement + updateBoundElements + bumpSceneRepaint()
  await page.evaluate(() => {
    const p = window.__sveltedrawProbe;
    const a = p.scene.getElement('A');
    p.scene.mutateElement(a, { x: a.x - 50, y: a.y + 200 }, { informMutation: false, isDragging: false });
    p.updateBoundElements(a);
    p.bumpSceneRepaint();
  });
  await delay(400);
  await page.screenshot({ path: 'connector-moved.png', clip: { x: 0, y: 200, width: 1200, height: 600 }});
  console.log('saved connector-moved.png');

  await browser.close();
})();

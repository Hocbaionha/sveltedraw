const puppeteer = require('puppeteer');
const delay = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1600, height: 1000 } });
  const p = await b.newPage();
  await p.goto('http://localhost:3005/#app', { waitUntil: 'networkidle2' });
  await delay(3500);
  const info = await p.evaluate(() => {
    return {
      utilBtns: document.querySelectorAll('.sveltedraw-util-btn').length,
      toolBtns: document.querySelectorAll('.sveltedraw-tool-btn').length,
      alignBtn: !!Array.from(document.querySelectorAll('.sveltedraw-util-btn')).find(x => x.getAttribute('aria-label') === 'Alignment tool'),
      eraserBtn: !!Array.from(document.querySelectorAll('[aria-label]')).find(x => x.getAttribute('aria-label') === 'Eraser'),
      laserBtn: !!Array.from(document.querySelectorAll('[aria-label]')).find(x => x.getAttribute('aria-label') === 'Laser pointer'),
      frameBtn: !!Array.from(document.querySelectorAll('[aria-label]')).find(x => x.getAttribute('aria-label') === 'Create frame'),
      connBtn: !!Array.from(document.querySelectorAll('[aria-label]')).find(x => x.getAttribute('aria-label') === 'Connector tool'),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  let pass = 0, fail = 0;
  const log = (n, ok) => { console.log(`${ok?'OK':'FAIL'} ${n}`); ok?pass++:fail++; };
  log('util buttons present', info.utilBtns > 5);
  log('tool buttons present', info.toolBtns > 5);
  log('Alignment button present', info.alignBtn);
  log('Eraser button present', info.eraserBtn);
  log('Laser button present', info.laserBtn);
  log('Frame button present', info.frameBtn);
  log('Connector button present', info.connBtn);
  console.log(`\nPASS: ${pass}, FAIL: ${fail}`);
  await b.close();
  process.exitCode = fail ? 1 : 0;
})();

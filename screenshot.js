const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800 });
  await page.goto('http://localhost:8000/extension/sidepanel/analysis-ui.html', { waitUntil: 'networkidle0' });

  // Wait a bit for animations
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: 'ui_screenshot.png' });
  await browser.close();
})();

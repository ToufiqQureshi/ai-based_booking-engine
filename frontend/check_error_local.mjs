import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`PAGE ERROR: ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`UNCAUGHT EXCEPTION: ${error.message}`);
    console.log(`STACK: ${error.stack}`);
  });

  console.log('Navigating to http://localhost:4174...');
  try {
    await page.goto('http://localhost:4174', { waitUntil: 'networkidle' });
  } catch (e) {
    console.log(`NAVIGATION ERROR: ${e.message}`);
  }
  
  await browser.close();
})();

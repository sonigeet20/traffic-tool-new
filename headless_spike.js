const puppeteer = require('puppeteer');

const marker = process.argv[2] || 'headless-spike';
const total = Number(process.argv[3] || 40);
const concurrency = Number(process.argv[4] || 16);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runOne(i) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--proxy-server=http://brd.superproxy.io:33335',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.authenticate({
      username: 'brd-customer-hl_a908b07a-zone-isp-country-US',
      password: 'mihmos3ifhay',
    });
    const u = `https://techdim.com/?${marker}=${i}`;
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(18000);
    console.log('OK', i, u);
  } catch (e) {
    console.log('FAIL', i, e.message);
  } finally {
    await browser.close().catch(() => {});
  }
}

(async () => {
  let idx = 1;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx <= total) {
      const i = idx++;
      await runOne(i);
      await sleep(80);
    }
  });
  await Promise.all(workers);
})();

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const marker = process.argv[2] || 'headful-spike';
const total = Number(process.argv[3] || 30);
const concurrency = Number(process.argv[4] || 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// SimilarWeb extension ID
const EXTENSION_ID = 'hoklmmgfnpapgjgcpechhaamimifchmp';
const EXT_DIR = path.join('/tmp', `ext_${EXTENSION_ID}`);

async function ensureExtension() {
  const manifest = path.join(EXT_DIR, 'manifest.json');
  if (fs.existsSync(manifest)) {
    console.log(`[EXT] SimilarWeb extension already cached at ${EXT_DIR}`);
    return EXT_DIR;
  }
  console.log('[EXT] Downloading SimilarWeb extension from Chrome Web Store...');
  const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0&acceptformat=crx2,crx3&x=id%3D${EXTENSION_ID}%26uc`;
  const crxPath = path.join('/tmp', `${EXTENSION_ID}.crx`);
  
  await new Promise((resolve, reject) => {
    const download = (url, redirects = 5) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirects <= 0) return reject(new Error('Too many redirects'));
          return download(res.headers.location, redirects - 1);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const file = fs.createWriteStream(crxPath);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    download(crxUrl);
  });

  // Extract CRX (it's a zip with a header)
  fs.mkdirSync(EXT_DIR, { recursive: true });
  try {
    // CRX3 header: skip first bytes until PK signature
    const buf = fs.readFileSync(crxPath);
    let zipStart = 0;
    for (let i = 0; i < Math.min(buf.length, 1000); i++) {
      if (buf[i] === 0x50 && buf[i+1] === 0x4B && buf[i+2] === 0x03 && buf[i+3] === 0x04) {
        zipStart = i;
        break;
      }
    }
    const zipPath = crxPath + '.zip';
    fs.writeFileSync(zipPath, buf.slice(zipStart));
    execSync(`unzip -o -q "${zipPath}" -d "${EXT_DIR}"`, { stdio: 'ignore' });
    fs.unlinkSync(zipPath);
    console.log(`[EXT] SimilarWeb extension extracted to ${EXT_DIR}`);
  } catch (e) {
    console.log(`[EXT] Extraction failed: ${e.message}, continuing without extension`);
    return null;
  }
  fs.unlinkSync(crxPath).catch?.(() => {});
  return fs.existsSync(manifest) ? EXT_DIR : null;
}

async function runOne(i, extPath) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--proxy-server=http://brd.superproxy.io:33335',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080',
  ];
  if (extPath) {
    args.push(`--disable-extensions-except=${extPath}`);
    args.push(`--load-extension=${extPath}`);
  }
  const browser = await puppeteer.launch({
    headless: false,
    args,
  });

  try {
    const page = await browser.newPage();
    // Block only heavy assets (images, media, fonts) — save bandwidth but keep GA alive
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'image' || type === 'media' || type === 'font') {
        return req.abort();
      }
      req.continue();
    });
    await page.authenticate({
      username: 'brd-customer-hl_a908b07a-zone-isp-country-US',
      password: 'mihmos3ifhay',
    });
    const u = `https://techdim.com/?${marker}=${i}`;
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // Wait long enough for GA / GTM to fully fire
    await sleep(18000);
    console.log('OK', i, u);
  } catch (e) {
    console.log('FAIL', i, e.message);
  } finally {
    await browser.close().catch(() => {});
  }
}

(async () => {
  const extPath = await ensureExtension();
  if (extPath) console.log(`[EXT] SimilarWeb extension loaded from ${extPath}`);
  else console.log('[EXT] Running without SimilarWeb extension');

  let idx = 1;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx <= total) {
      const i = idx++;
      await runOne(i, extPath);
      await sleep(80);
    }
  });
  await Promise.all(workers);
})();

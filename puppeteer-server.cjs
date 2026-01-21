const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

// Add stealth plugin with all evasions
puppeteer.use(StealthPlugin());

// ════════════════════════════════════════════════════════════════════════
// REAL DEVICE MODE - Advanced Fingerprinting & Anti-Detection
// ════════════════════════════════════════════════════════════════════════

// Realistic device profiles database with real hardware signatures
const DEVICE_PROFILES = {
  'windows_chrome_high': {
    name: 'Windows 11 - Chrome 120 - High-end',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    platform: 'Win32',
    screenWidth: 1920,
    screenHeight: 1080,
    devicePixelRatio: 1,
    hardwareConcurrency: 16,
    deviceMemory: 32,
    touchEvents: false,
    gpu: { vendor: 'NVIDIA', model: 'RTX 4070' },
    chromeVersion: '120.0.0.0',
    plugins: ['Chrome PDF Plugin', 'Chrome PDF Viewer', 'Native Client Plugin'],
    audioContext: true,
    webGL: { vendor: 'NVIDIA', version: '4.6' },
  },
  'windows_chrome_mid': {
    name: 'Windows 10 - Chrome 120 - Mid-range',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    platform: 'Win32',
    screenWidth: 1366,
    screenHeight: 768,
    devicePixelRatio: 1,
    hardwareConcurrency: 8,
    deviceMemory: 16,
    touchEvents: false,
    gpu: { vendor: 'Intel', model: 'UHD Graphics 730' },
    chromeVersion: '120.0.0.0',
    plugins: ['Chrome PDF Plugin', 'Chrome PDF Viewer'],
    audioContext: true,
    webGL: { vendor: 'Intel', version: '4.4' },
  },
  'mac_chrome_high': {
    name: 'macOS Sonoma - Chrome 120',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    screenWidth: 1440,
    screenHeight: 900,
    devicePixelRatio: 2,
    hardwareConcurrency: 10,
    deviceMemory: 16,
    touchEvents: false,
    gpu: { vendor: 'Apple', model: 'M2 Max' },
    chromeVersion: '120.0.0.0',
    plugins: ['Chrome PDF Plugin', 'Chrome PDF Viewer'],
    audioContext: true,
    webGL: { vendor: 'Apple', version: '4.5' },
  },
  'linux_chrome_mid': {
    name: 'Ubuntu 22.04 - Chrome 120',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    platform: 'Linux x86_64',
    screenWidth: 1920,
    screenHeight: 1080,
    devicePixelRatio: 1,
    hardwareConcurrency: 8,
    deviceMemory: 16,
    touchEvents: false,
    gpu: { vendor: 'NVIDIA', model: 'RTX 3060' },
    chromeVersion: '120.0.0.0',
    plugins: [],
    audioContext: true,
    webGL: { vendor: 'NVIDIA', version: '4.5' },
  },
  'mobile_chrome': {
    name: 'Android - Chrome Mobile',
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    platform: 'Linux aarch64',
    screenWidth: 1080,
    screenHeight: 2340,
    devicePixelRatio: 2.75,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    touchEvents: true,
    gpu: { vendor: 'Qualcomm', model: 'Adreno 8cx' },
    chromeVersion: '120.0.0.0',
    plugins: [],
    audioContext: true,
    webGL: { vendor: 'Qualcomm', version: '3.0' },
  },
};

// Generate random device profile with geo-location bias
function generateDeviceProfile(geoLocation = 'US') {
  const profileKeys = Object.keys(DEVICE_PROFILES);
  let selectedKey;
  
  // Bias selection based on geo location
  if (geoLocation === 'CN') {
    selectedKey = 'linux_chrome_mid';
  } else if (['JP', 'KR', 'SG', 'IN'].includes(geoLocation)) {
    selectedKey = 'mobile_chrome';
  } else if (geoLocation === 'US') {
    const choices = ['windows_chrome_high', 'windows_chrome_mid', 'mac_chrome_high'];
    selectedKey = choices[Math.floor(Math.random() * choices.length)];
  } else {
    selectedKey = profileKeys[Math.floor(Math.random() * profileKeys.length)];
  }
  
  const profile = { ...DEVICE_PROFILES[selectedKey] };
  
  // Add randomization to avoid fingerprinting patterns
  if (Math.random() > 0.5) {
    profile.hardwareConcurrency = [4, 6, 8, 12, 16][Math.floor(Math.random() * 5)];
  }
  if (Math.random() > 0.5) {
    profile.deviceMemory = [4, 8, 16, 32][Math.floor(Math.random() * 4)];
  }
  
  return profile;
}

// Inject advanced fingerprint spoofing to avoid Google bot detection
async function injectRealDeviceFingerprint(page, deviceProfile) {
  try {
    // WebGL fingerprint
    const webglScript = `
      (function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!ctx) return;
        
        const getParameter = ctx.getParameter.bind(ctx);
        const unmaskedVendor = '${deviceProfile.webGL.vendor}';
        const unmaskedRenderer = 'WebGL Implementation';
        
        Object.defineProperty(ctx, 'getParameter', {
          value: function(parameter) {
            if (parameter === 37445) return unmaskedVendor; // UNMASKED_VENDOR_WEBGL
            if (parameter === 37446) return unmaskedRenderer; // UNMASKED_RENDERER_WEBGL
            return getParameter(parameter);
          }
        });
      })();
    `;
    
    // Canvas fingerprint - consistent but non-detectable
    const canvasScript = `
      (function() {
        const canvasFingerprintCache = new Map();
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        
        HTMLCanvasElement.prototype.toDataURL = function(type) {
          const key = this.width + 'x' + this.height + ':' + type;
          if (!canvasFingerprintCache.has(key)) {
            canvasFingerprintCache.set(key, originalToDataURL.call(this, type));
          }
          return canvasFingerprintCache.get(key);
        };
      })();
    `;
    
    // Audio context fingerprint
    const audioScript = `
      (function() {
        const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
        if (!OriginalAudioContext) return;
        
        const fakeAudioContext = class extends OriginalAudioContext {
          constructor() {
            super();
            this._sampleRate = 44100 + Math.floor(Math.random() * 100);
          }
          get sampleRate() {
            return this._sampleRate;
          }
        };
        
        window.AudioContext = window.webkitAudioContext = fakeAudioContext;
      })();
    `;
    
    // Hardware concurrency and device memory
    const hardwareScript = `
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: ${deviceProfile.hardwareConcurrency},
        writable: false,
        configurable: true
      });
      
      Object.defineProperty(navigator, 'deviceMemory', {
        value: ${deviceProfile.deviceMemory},
        writable: false,
        configurable: true
      });
    `;
    
    // Screen properties matching device profile
    const screenScript = `
      Object.defineProperty(screen, 'width', {
        value: ${deviceProfile.screenWidth},
        writable: false,
        configurable: true
      });
      
      Object.defineProperty(screen, 'height', {
        value: ${deviceProfile.screenHeight},
        writable: false,
        configurable: true
      });
      
      Object.defineProperty(screen, 'availWidth', {
        value: ${deviceProfile.screenWidth},
        writable: false,
        configurable: true
      });
      
      Object.defineProperty(screen, 'availHeight', {
        value: ${deviceProfile.screenHeight - 100},
        writable: false,
        configurable: true
      });
      
      Object.defineProperty(screen, 'colorDepth', {
        value: 24,
        writable: false,
        configurable: true
      });
      
      Object.defineProperty(screen, 'pixelDepth', {
        value: 24,
        writable: false,
        configurable: true
      });
      
      Object.defineProperty(window, 'devicePixelRatio', {
        value: ${deviceProfile.devicePixelRatio},
        writable: false,
        configurable: true
      });
    `;
    
    // Touch events
    const touchScript = `
      ${deviceProfile.touchEvents ? `
        window.ontouchstart = null;
        Object.defineProperty(navigator, 'maxTouchPoints', {
          value: 5,
          writable: false,
          configurable: true
        });
      ` : `
        Object.defineProperty(navigator, 'maxTouchPoints', {
          value: 0,
          writable: false,
          configurable: true
        });
      `}
    `;
    
    // Plugins fingerprint
    const pluginsScript = `
      (function() {
        const plugins = ${JSON.stringify(deviceProfile.plugins)};
        Object.defineProperty(navigator, 'plugins', {
          value: plugins.map((name, i) => ({
            name: name,
            description: name + ' description',
            length: 1,
            filename: name.toLowerCase().replace(/ /g, '_') + '.so'
          })),
          writable: false,
          configurable: true
        });
      })();
    `;
    
    // Chrome version spoof
    const chromeScript = `
      Object.defineProperty(navigator, 'appVersion', {
        value: '5.0 (${deviceProfile.platform})',
        writable: false,
        configurable: true
      });
    `;
    
    // Inject all scripts
    await page.evaluateOnNewDocument(webglScript);
    await page.evaluateOnNewDocument(canvasScript);
    await page.evaluateOnNewDocument(audioScript);
    await page.evaluateOnNewDocument(hardwareScript);
    await page.evaluateOnNewDocument(screenScript);
    await page.evaluateOnNewDocument(touchScript);
    await page.evaluateOnNewDocument(pluginsScript);
    await page.evaluateOnNewDocument(chromeScript);
    
    console.log(`[FINGERPRINT] ✓ Injected real device: ${deviceProfile.name}`);
    
  } catch (err) {
    console.log(`[FINGERPRINT] Warning: ${err.message}`);
  }
}

// Set realistic headers
async function setRealisticHeaders(page, deviceProfile) {
  try {
    await page.setUserAgent(deviceProfile.userAgent);
    
    await page.setViewport({
      width: deviceProfile.screenWidth,
      height: deviceProfile.screenHeight,
      deviceScaleFactor: deviceProfile.devicePixelRatio
    });
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
      'DNT': '1',
      'Connection': 'keep-alive'
    });
    
    console.log(`[HEADERS] ✓ Applied realistic headers`);
  } catch (err) {
    console.log(`[HEADERS] Warning: ${err.message}`);
  }
}

// Simulate human search behavior on Google
async function simulateGoogleSearch(page) {
  try {
    // Wait for SERP results
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    
    // Random scrolling (Google tracks scroll depth)
    const scrolls = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < scrolls; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    }
    
    // Mouse movements (human cursor behavior)
    const moves = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < moves; i++) {
      await page.mouse.move(Math.random() * 800, Math.random() * 600);
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    }
    
    console.log(`[GOOGLE] ✓ Simulated human search behavior`);
  } catch (err) {
    console.log(`[GOOGLE] Note: ${err.message}`);
  }
}

const app = express();
app.use(express.json());

console.log('🚀 Puppeteer Real-Device Mode with SERP + Luna Proxy');

// ════════════════════════════════════════════════════════════════════════
// COOKIES & PERSISTENCE
// ════════════════════════════════════════════════════════════════════════

const COOKIES_DIR = path.join(__dirname, 'cookies');
if (!fs.existsSync(COOKIES_DIR)) {
  fs.mkdirSync(COOKIES_DIR, { recursive: true });
}

function loadOrCreateCookies(proxyIdentifier) {
  const cookieFile = path.join(COOKIES_DIR, `cookies_${proxyIdentifier}.json`);
  
  if (fs.existsSync(cookieFile)) {
    try {
      return JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
    } catch (e) {
      console.log(`[COOKIES] Error loading, creating new ones`);
    }
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  const futureTime = currentTime + (365 * 24 * 60 * 60);
  
  const cookies = [
    {
      name: 'PREF',
      value: `ID=${Math.random().toString(36).substring(2, 15)}:TM=${currentTime}:LM=${currentTime}:S=${Math.random().toString(36).substring(2, 10)}`,
      domain: '.google.com',
      path: '/',
      expires: futureTime,
      secure: true,
      sameSite: 'None'
    },
    {
      name: 'NID',
      value: `${Math.floor(Math.random() * 1000)}=${Math.random().toString(36).substring(2, 40)}`,
      domain: '.google.com',
      path: '/',
      expires: futureTime,
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    }
  ];
  
  fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
  return cookies;
}

// ════════════════════════════════════════════════════════════════════════
// BRIGHT DATA SERP API
// ════════════════════════════════════════════════════════════════════════

async function searchWithBrightDataSERP(searchKeyword, geoLocation, serpConfig) {
  try {
    const { api_token, customer_id, zone_name, endpoint, port } = serpConfig;
    
    console.log(`[SERP] Searching "${searchKeyword}" (geo: ${geoLocation})`);
    
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchKeyword)}&gl=${geoLocation.toLowerCase()}&num=10`;
    
    const response = await axios.get(googleUrl, {
      proxy: {
        host: endpoint,
        port: parseInt(port),
        auth: {
          username: `brd-customer-${customer_id}-zone-${zone_name}`,
          password: api_token
        }
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    // Parse HTML for organic results
    const html = response.data;
    const urlRegex = /<a[^>]*href="\/url\?q=([^&"]+)[^"]*"[^>]*>/g;
    const matches = [];
    let match;
    
    while ((match = urlRegex.exec(html)) !== null) {
      try {
        const url = decodeURIComponent(match[1]);
        if (!url.includes('google.com') && url.startsWith('http')) {
          matches.push(url);
        }
      } catch (e) {}
    }
    
    if (matches.length > 0) {
      console.log(`[SERP] ✓ Found ${matches.length} results`);
      return matches;
    }
    
    console.log('[SERP] No results found');
    return null;
  } catch (error) {
    console.error(`[SERP] Error: ${error.message}`);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════
// MAIN AUTOMATION ENDPOINT
// ════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ status: 'ok', features: ['Real-Device Mode', 'SERP API', 'Luna Proxy', 'Fingerprinting'] });
});

app.post('/api/automate', async (req, res) => {
  const {
    url, geoLocation, proxy, proxyUsername, proxyPassword,
    searchKeyword, userJourney, sessionId, supabaseUrl, supabaseKey,
    sessionDurationMin, sessionDurationMax,
    useSerpApi, proxy_provider,
    serp_api_token, serp_customer_id, serp_zone_name, serp_endpoint, serp_port,
    useBrowserAutomation, browser_customer_id, browser_zone, browser_password,
    browser_endpoint, browser_port, extensionCrxUrl, customReferrer, maxBandwidthMB
  } = req.body;

  console.log(`[SESSION] Starting - Search: ${searchKeyword ? 'Yes' : 'No'}, Target: ${url}`);
  
  let browser;
  let page;
  let totalBandwidthBytes = 0;
  const normalizedMaxBandwidthMB = maxBandwidthMB ? Number(maxBandwidthMB) : 0.2; // default ultra-thrifty
  const maxBandwidthBytes = normalizedMaxBandwidthMB * 1024 * 1024;
  
  try {
    // Generate realistic device profile
    const deviceProfile = generateDeviceProfile(geoLocation || 'US');
    console.log(`[DEVICE] Using: ${deviceProfile.name}`);
    if (maxBandwidthBytes) {
      console.log(`[BANDWIDTH] Limit: ${normalizedMaxBandwidthMB} MB`);
    }
    
    // Step 1: Use SERP API for search (if enabled)
    let clickedUrl = url;
    
    if (useSerpApi && searchKeyword && serp_api_token && serp_customer_id) {
      console.log('[FLOW] SERP API mode - using dual-proxy approach');
      
      const serpConfig = {
        api_token: serp_api_token,
        customer_id: serp_customer_id,
        zone_name: serp_zone_name || 'serp',
        endpoint: serp_endpoint || 'brd.superproxy.io',
        port: serp_port || '33335'
      };
      
      // Launch temporary browser for SERP search with real device mode - HEADFUL for extension support
      let serpBrowser = await puppeteer.launch({
        headless: false,
        ignoreHTTPSErrors: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          `--window-size=${deviceProfile.screenWidth},${deviceProfile.screenHeight}`,
        ]
      });
      
      let serpPage = await serpBrowser.newPage();
      
      // Apply real device fingerprinting to SERP search
      await injectRealDeviceFingerprint(serpPage, deviceProfile);
      await setRealisticHeaders(serpPage, deviceProfile);
      
      // Perform SERP search
      const searchResults = await searchWithBrightDataSERP(searchKeyword, geoLocation, serpConfig);
      
      if (searchResults && searchResults.length > 0) {
        // Find target URL or pick random
        const targetDomain = new URL(url).hostname.replace('www.', '');
        let foundUrl = searchResults.find(resultUrl => {
          try {
            const resultDomain = new URL(resultUrl).hostname.replace('www.', '');
            return resultDomain.includes(targetDomain) || targetDomain.includes(resultDomain);
          } catch {
            return false;
          }
        });
        
        if (!foundUrl) {
          const randomIdx = Math.floor(Math.random() * Math.min(5, searchResults.length));
          foundUrl = searchResults[randomIdx];
          console.log(`[SERP] Using result #${randomIdx + 1}: ${foundUrl}`);
        } else {
          console.log(`[SERP] Found target URL in results`);
        }
        
        clickedUrl = foundUrl;
      }
      
      // Close SERP browser
      await serpBrowser.close();
      console.log('[SERP] ✓ Closed SERP browser, launching Luna proxy browser');
    }
    
    // Step 2: Launch final browser with Luna proxy (or Browser Automation)
    if (useBrowserAutomation && !useSerpApi) {
      // Use Bright Data Browser Automation
      const wsEndpoint = `wss://brd-customer-${browser_customer_id}-zone-${browser_zone || 'unblocker'}-country-${geoLocation || 'US'}:${browser_password}@${browser_endpoint || 'brd.superproxy.io'}:${browser_port || '9222'}`;
      
      console.log('[BROWSER AUTO] Connecting to Bright Data Browser Automation...');
      browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        ignoreHTTPSErrors: true
      });
      console.log('[BROWSER AUTO] ✓ Connected');
      
      const pages = await browser.pages();
      page = pages[0] || await browser.newPage();
    } else {
      // Launch local browser with Luna proxy - HEADFUL for extension support
      // Step 1: Launch without proxy to load extension using server bandwidth
      const normalizedGeo = (geoLocation || 'us').toLowerCase();
      const normalizedProxy = proxy
        ? (proxy.startsWith('http://') || proxy.startsWith('https://') ? proxy : `http://${proxy}`)
        : null;
      
      console.log('[BROWSER] Launching HEADFUL mode (extension support)');
      
      // Launch browser WITHOUT proxy first
      const launchConfig = {
        headless: false,
        ignoreHTTPSErrors: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-images',
          '--blink-settings=imagesEnabled=false',
          `--window-size=${deviceProfile.screenWidth},${deviceProfile.screenHeight}`,
        ]
      };
      
      // Load extension if provided
      if (extensionCrxUrl) {
        console.log('[EXTENSION] Loading extension via server bandwidth (no proxy)');
        launchConfig.args.push(`--disable-extensions-except=/tmp/extension`);
        launchConfig.args.push(`--load-extension=/tmp/extension`);
      }
      
      browser = await puppeteer.launch(launchConfig);
      page = await browser.newPage();
      
      // Step 2: Now set proxy authentication for actual navigation + aggressive blocking
      if (normalizedProxy && proxyUsername && proxyPassword) {
        console.log('[PROXY] Setting up proxy for navigation (extension already loaded)');
        
        // Create a new page with CDP session for proxy override
        const client = await page.target().createCDPSession();
        await client.send('Network.enable');
        
        // Block heavy resource types
        const blockedTypes = new Set(['Image', 'Media', 'Font', 'Stylesheet']);
        const blockedPattern = /\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|mov|avi|mkv|mp3|wav|ogg|woff|woff2|ttf|otf|css)(\?|$)/i;
        const gaAllowlist = ['www.google-analytics.com', 'www.googletagmanager.com', 'stats.g.doubleclick.net'];
        const hasRegionTag = proxyUsername.includes('-region-');
        const authUsername = hasRegionTag ? proxyUsername : `${proxyUsername}-region-${normalizedGeo}`;
        
        // Set authentication handler
        await page.authenticate({ username: authUsername, password: proxyPassword });
        
        // Enable Fetch interception for proxy header + blocking
        await client.send('Fetch.enable', {
          patterns: [{ urlPattern: '*', requestStage: 'Request' }]
        });
        
        client.on('Fetch.requestPaused', async (event) => {
          const { requestId, request, resourceType } = event;
          try {
            // Block unwanted types and heavy assets unless GA allowlist
            const urlHost = (() => {
              try { return new URL(request.url).hostname; } catch { return ''; }
            })();
            const isGA = gaAllowlist.includes(urlHost);
            const isBlockedType = blockedTypes.has(resourceType);
            const isBlockedByPattern = blockedPattern.test(request.url);
            if (!isGA && (isBlockedType || isBlockedByPattern)) {
              await client.send('Fetch.failRequest', { requestId, errorReason: 'Aborted' });
              return;
            }
            await client.send('Fetch.continueRequest', {
              requestId,
              headers: [
                ...Object.entries(request.headers).map(([name, value]) => ({ name, value })),
                { name: 'Proxy-Authorization', value: `Basic ${Buffer.from(`${authUsername}:${proxyPassword}`).toString('base64')}` }
              ]
            });
          } catch (e) {
            console.log('[PROXY] Request continue error:', e.message);
          }
        });
        
        console.log(hasRegionTag ? '[PROXY] ✓ Authenticated' : '[PROXY] ✓ Authenticated (region appended)');
      }
    }
    
    // Apply real device fingerprinting to final browser
    await injectRealDeviceFingerprint(page, deviceProfile);
    await setRealisticHeaders(page, deviceProfile);
    
    // Load cookies
    const proxyIdentifier = proxy ? proxy.replace(/[^a-zA-Z0-9]/g, '_') : sessionId || 'default';
    const cookies = loadOrCreateCookies(proxyIdentifier);
    await page.setCookie(...cookies);
    
    // Set custom referrer if provided
    if (customReferrer) {
      await page.setExtraHTTPHeaders({ 'Referer': customReferrer });
      console.log(`[REFERRER] Set to: ${customReferrer}`);
    }
    
    // Enable bandwidth tracking if limit is set
    if (maxBandwidthBytes) {
      const client = await page.target().createCDPSession();
      await client.send('Network.enable');
      
      client.on('Network.responseReceived', (params) => {
        const response = params.response;
        if (response.encodedDataLength) {
          totalBandwidthBytes += response.encodedDataLength;
        }
      });
      
      client.on('Network.dataReceived', (params) => {
        totalBandwidthBytes += params.dataLength;
        if (totalBandwidthBytes > maxBandwidthBytes) {
          console.log(`[BANDWIDTH] ⚠️ Stopping - limit reached (${(totalBandwidthBytes / 1024 / 1024).toFixed(2)} MB / ${normalizedMaxBandwidthMB} MB)`);
          page.close().catch(() => {});
        }
      });
    }
    
    // Navigate to target URL
    console.log(`[NAVIGATE] Going to: ${clickedUrl}`);
    await page.goto(clickedUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('[NAVIGATE] ✓ Page loaded');
    
    if (maxBandwidthBytes) {
      console.log(`[BANDWIDTH] Used: ${(totalBandwidthBytes / 1024 / 1024).toFixed(2)} MB / ${normalizedMaxBandwidthMB} MB`);
    }
    
    // Execute user journey or random behavior
    if (userJourney && userJourney.length > 0) {
      console.log('[JOURNEY] Executing user actions...');
      for (const action of userJourney) {
        const { type, selector, url: actionUrl, text, delay } = action;
        try {
          if (type === 'click' && selector) {
            await page.click(selector);
            console.log(`[JOURNEY] ✓ Clicked: ${selector}`);
          } else if (type === 'type' && selector) {
            await page.type(selector, text, { delay: 100 });
            console.log(`[JOURNEY] ✓ Typed in: ${selector}`);
          } else if (type === 'navigate' && actionUrl) {
            await page.goto(actionUrl, { waitUntil: 'networkidle2' });
            console.log(`[JOURNEY] ✓ Navigated to: ${actionUrl}`);
          }
          
          if (delay) {
            await new Promise(r => setTimeout(r, delay));
          }
        } catch (err) {
          console.log(`[JOURNEY] Note: ${err.message}`);
        }
      }
      console.log('[JOURNEY] ✓ Completed');
    } else {
      // Random browsing behavior
      const scrolls = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < scrolls; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
      }
      console.log('[BEHAVIOR] ✓ Random browsing simulated');
    }
    
    // Session duration
    const minDuration = (sessionDurationMin || 30) * 1000;
    const maxDuration = (sessionDurationMax || 120) * 1000;
    const duration = minDuration + Math.random() * (maxDuration - minDuration);
    await new Promise(r => setTimeout(r, duration));
    
    console.log('[SESSION] ✓ Completed successfully');
    res.json({ success: true, sessionId, clickedUrl });
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        console.log('[CLEANUP] Browser close error:', err.message);
      }
    }
  }
});

app.listen(3000, () => {
  console.log('✅ Server running on port 3000 - Real-Device Mode Active');
});

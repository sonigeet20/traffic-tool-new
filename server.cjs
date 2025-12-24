const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const { getExtensionPath } = require('./extension-loader.js');

// Temporary hardcoded Browser API token (HTTP API). Replace with env/config when available.
const FALLBACK_BROWSER_API_TOKEN = process.env.BROWSER_API_TOKEN || 'cb3070be589695116882cfd8f6a37d4e3c0d19fe971d68b468ef4ab6d7437d1f';

// Extract organic links from Google HTML (handles multiple markup variants)
function extractOrganicLinksFromHtml(html) {
  const links = new Set();
  const blocklist = ['google.com', 'gstatic.com', 'youtube.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com'];

  const patterns = [
    /href="\/url\?q=([^"&]+)/g,                                    // /url?q=
    /data-href="\/url\?q=([^"&]+)/g,                               // data-href variant
    /href="(https?:\/\/[^"\s]+)"/g                               // any absolute link
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const raw = match[1];
      try {
        const decoded = decodeURIComponent(raw);
        if (!decoded.startsWith('http')) continue;
        if (blocklist.some(b => decoded.includes(b))) continue;
        links.add(decoded);
      } catch (e) {
        // ignore decode errors
      }
    }
    if (links.size >= 10) break;
  }

  return Array.from(links).slice(0, 10);
}

// Add stealth plugin with all evasions
puppeteer.use(StealthPlugin());

// Global session concurrency control (forcefully enforced)
const MAX_CONCURRENT_SESSIONS = 3;
let activeSessionCount = 0;

// ════════════════════════════════════════════════════════════════════════
// JOB QUEUE (FIFO) WITH CONCURRENCY CONTROL
// ════════════════════════════════════════════════════════════════════════
const JOBS = new Map();       // jobId -> { status, result|error, logs, timestamps }
const QUEUE = [];             // [{ jobId, payload }]

function genJobId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function runQueue() {
  while (activeSessionCount < MAX_CONCURRENT_SESSIONS && QUEUE.length > 0) {
    const { jobId, payload } = QUEUE.shift();
    startJob(jobId, payload).catch(() => {}); // fire-and-forget
  }
}

async function startJob(jobId, payload) {
  activeSessionCount++;
  console.log(`[QUEUE] Starting job ${jobId} (${activeSessionCount}/${MAX_CONCURRENT_SESSIONS})`);
  JOBS.set(jobId, { status: 'running', startedAt: Date.now(), sessionId: jobId });

  try {
    const result = await processAutomateJob(payload, jobId);
    JOBS.set(jobId, {
      status: 'completed',
      finishedAt: Date.now(),
      result
    });
    console.log(`[QUEUE] Job ${jobId} completed successfully`);
  } catch (err) {
    JOBS.set(jobId, {
      status: 'failed',
      finishedAt: Date.now(),
      error: err.message,
      stack: err.stack
    });
    console.error(`[QUEUE] Job ${jobId} failed: ${err.message}`);
  } finally {
    activeSessionCount--;
    console.log(`[QUEUE] Job ${jobId} finished (${activeSessionCount}/${MAX_CONCURRENT_SESSIONS} active)`);
    runQueue(); // Process next queued job
  }
}

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

// Cache store for generated device profiles
const deviceProfileCache = {};

// Lightweight bandwidth tracker (response headers only)
function createBandwidthTracker(sessionLogger) {
  let totalBytes = 0;
  const onResponse = (response) => {
    try {
      const headers = response.headers() || {};
      const len = headers['content-length'] || headers['Content-Length'];
      if (len) {
        const parsed = parseInt(len, 10);
        if (!Number.isNaN(parsed)) totalBytes += parsed;
      }
    } catch (_) {
      // ignore parsing issues
    }
  };
  const attachToPage = (page) => {
    if (page && page.on) {
      page.on('response', onResponse);
    }
  };
  const getTotalBytes = () => totalBytes;
  const report = (targetUrl, actualDurationSec) => {
    const mb = (totalBytes / (1024 * 1024)).toFixed(3);
    const message = `${targetUrl} | bytes=${totalBytes} (${mb} MB) | duration=${actualDurationSec}s`;
    console.log(`[BANDWIDTH] ${message}`);
    if (sessionLogger && sessionLogger.log) {
      sessionLogger.log('BANDWIDTH', message, 'info');
    }
  };
  return { attachToPage, getTotalBytes, report };
}

// Ultra-lean resource guards: aggressive bandwidth reduction to <300KB/session
function initLeanResourceGuards(page, mainHost) {
  const analyticsHosts = [
    // Google Analytics & Tag Manager
    'google-analytics.com',
    'www.google-analytics.com',
    'ssl.google-analytics.com',
    'googletagmanager.com',
    'www.googletagmanager.com',
    'gtm-msr.appspot.com',
    'analytics.google.com',
    'www.googletagmanager.com/gtag/',
    'google.com',
    'www.google.com',
    
    // Microsoft Clarity
    'clarity.ms',
    'www.clarity.ms',
    'static.clarity.ms',
    'clr.ms',
    'clrouter.clr.ms',
    'config.clarity.ms',
    
    // Hotjar
    'hotjar.com',
    'static.hotjar.com',
    'script.hotjar.com',
    'hjcdn.com',
    'hjus.com',
    'hjcdn.hjus.com',
    'ws.hotjar.com',
    'vars.hotjar.com',
    
    // Segment
    'cdn.segment.com',
    'api.segment.io',
    'segment.com',
    
    // Mixpanel
    'mixpanel.com',
    'cdn.mixpanel.com',
    'api.mixpanel.com',
    
    // SimilarWeb
    'similarweb.com',
    'www.similarweb.com',
    'cdn.similarweb.com',
    'swzjjqqe.similarweb.com',
    
    // Google APIs (for extensions and page functionality)
    'googleapis.com',
    'google-analytics-bundle.js',
    'recaptcha.net',
    'gstatic.com',
    
    // Additional analytics
    'amplitude.com',
    'api.amplitude.com',
    'fullstory.com',
    'api.fullstory.com',
    'amplitude-js.fullstory.com'
  ];

  const isAnalytics = (url) => {
    try {
      const u = new URL(url);
      return analyticsHosts.some(h => u.hostname.includes(h));
    } catch {
      return false;
    }
  };

  page.setRequestInterception(true).catch(() => {});
  page.on('request', (req) => {
    try {
      const url = req.url();
      const type = req.resourceType();
      const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();

      // CRITICAL: Allow extension:// URLs (extension resources)
      if (url.startsWith('extension://') || url.startsWith('chrome-extension://')) {
        return req.continue();
      }

      // Always allow main document
      if (req.isNavigationRequest() || type === 'document') return req.continue();

      // Block all heavy types globally (including stylesheets)
      if (type === 'image' || type === 'media' || type === 'font' || type === 'stylesheet') return req.abort();

      // Allow analytics and extension scripts
      if (type === 'script') {
        if (host === mainHost || isAnalytics(url)) return req.continue();
        return req.abort();
      }

      // Allow extension XHR/fetch and analytics (critical for data transmission)
      if (type === 'xhr' || type === 'fetch') {
        // Always allow same-origin (extension calls)
        if (host === mainHost) return req.continue();
        // Allow all analytics trackers
        if (isAnalytics(url)) return req.continue();
        // Block third-party services
        return req.abort();
      }

      // Block anything else third-party (except analytics)
      if (host !== mainHost && !isAnalytics(url)) return req.abort();
      
      return req.continue();
    } catch {
      try { req.continue(); } catch {}
    }
  });
}

// Random browsing helper: scroll + optional multi-page navigation
async function maybeMultiPageBrowse(page, baseUrl, sessionLogger) {
  // Always scroll a bit on the current page
  const scrolls = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < scrolls; i++) {
    try {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    } catch (err) {
      if (sessionLogger) sessionLogger.warning('BEHAVIOR', `Scroll failed: ${err.message}`);
    }
  }

  // Increased probability to 70% for multi-page navigation
  const shouldMulti = Math.random() < 0.70;
  if (!shouldMulti) {
    if (sessionLogger) sessionLogger.log('BEHAVIOR', 'Single-page browsing (no multi-page)', 'info');
    return;
  }

  if (sessionLogger) sessionLogger.log('BEHAVIOR', 'Starting multi-page navigation', 'info');
  
  const pagesToVisit = Math.floor(Math.random() * 3) + 2; // total pages = 2-4
  const origin = (() => {
    try { return new URL(baseUrl).origin; } catch { return null; }
  })();

  if (sessionLogger) sessionLogger.log('BEHAVIOR', `Will visit ${pagesToVisit} total pages (including current)`, 'info');

  for (let i = 0; i < pagesToVisit - 1; i++) {
    try {
      const nextUrl = await page.evaluate((originHint) => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const hrefs = anchors.map(a => a.href).filter(Boolean);
        if (!hrefs.length) return null;
        const sameOrigin = originHint ? hrefs.filter(h => h.startsWith(originHint)) : [];
        const pool = sameOrigin.length ? sameOrigin : hrefs;
        const capped = pool.slice(0, 50);
        return capped[Math.floor(Math.random() * capped.length)];
      }, origin);

      if (!nextUrl) {
        if (sessionLogger) sessionLogger.log('BEHAVIOR', `No more links found after page ${i + 1}`, 'info');
        break;
      }

      if (sessionLogger) sessionLogger.log('BEHAVIOR', `Navigating to page ${i + 2}/${pagesToVisit}: ${nextUrl.substring(0, 60)}...`, 'info');
      await page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (sessionLogger) sessionLogger.log('BEHAVIOR', `Multi-page nav to: ${nextUrl}`, 'success');

      // Light scroll on the new page
      await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
      await new Promise(r => setTimeout(r, 800 + Math.random() * 1500));
    } catch (err) {
      if (sessionLogger) sessionLogger.warning('BEHAVIOR', `Multi-page nav issue: ${err.message}`);
      break;
    }
  }
  
  if (sessionLogger) sessionLogger.success('BEHAVIOR', 'Multi-page browsing completed');
}

// Generate random device profile with geo-location bias (cached)
function generateDeviceProfile(geoLocation = 'US') {
  // Check cache first (same geo = same profile for this minute)
  const cacheKey = `${geoLocation}_${Math.floor(Date.now() / 60000)}`;
  if (deviceProfileCache[cacheKey]) {
    return deviceProfileCache[cacheKey];
  }
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
  
  // Cache for 1 minute
  deviceProfileCache[cacheKey] = profile;
  // Clean old cache entries
  Object.keys(deviceProfileCache).forEach(k => {
    if (!k.startsWith(geoLocation)) delete deviceProfileCache[k];
  });
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
    
    // Anti-headless detection - hide headless indicators
    const antiHeadlessScript = `
      (function() {
        // Hide headless mode detection
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
          configurable: true
        });
        
        // Chrome headless detection bypass
        const originalQuery = window.matchMedia;
        window.matchMedia = function(query) {
          if (query === '(prefers-color-scheme: dark)') {
            return Object.assign(originalQuery(query), {
              matches: false,
              media: query
            });
          }
          return originalQuery(query);
        };
        
        // Spoof document properties
        Object.defineProperty(document, 'hidden', {
          get: () => false,
          configurable: true
        });
        
        Object.defineProperty(document, 'visibilityState', {
          get: () => 'visible',
          configurable: true
        });
        
        // Runtime handler detection
        chrome = {
          runtime: {
            id: 'fake-extension-id'
          }
        };
        
        // Inject plugin detection
        Object.defineProperty(navigator, 'permissions', {
          value: {
            query: () => Promise.resolve({ state: 'granted' })
          },
          writable: false,
          configurable: true
        });
      })();
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
    await page.evaluateOnNewDocument(antiHeadlessScript);
    
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
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    
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

// Add CORS support
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

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
// BRIGHT DATA BROWSER API - GOOGLE SEARCH WITH FULL UNBLOCKING
// ════════════════════════════════════════════════════════════════════════

// HTTP API Method (Alternative) - More reliable for Google searches
async function searchWithBrowserAPIHTTP(searchKeyword, geoLocation, browserConfig) {
  try {
    const { browser_api_token, browser_zone } = browserConfig;
    
    if (!browser_api_token || !browser_zone) {
      console.error('[BROWSER API HTTP] Missing API token or zone');
      console.log('[BROWSER API HTTP] Note: HTTP API requires API token (64-char hex), not password');
      return null;
    }
    
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchKeyword)}&gl=${geoLocation.toLowerCase()}&hl=en&num=10`;
    
    console.log(`[BROWSER API HTTP] Fetching Google search via HTTP API...`);
    console.log(`[BROWSER API HTTP] Zone: ${browser_zone}, Geo: ${geoLocation}`);
    console.log(`[BROWSER API HTTP] Using API token authentication`);
    
    // Use minimal payload; some zones reject extra flags like direct/country
    const response = await axios.post('https://api.brightdata.com/request', {
      zone: browser_zone,
      url: googleUrl,
      format: 'raw'
    }, {
      headers: {
        'Authorization': `Bearer ${browser_api_token}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000,
      validateStatus: () => true
    });
    
    const html = response.data;
    const status = response.status;
    console.log(`[BROWSER API HTTP] Response received (status: ${status}), length: ${html ? html.length : 0} bytes`);
    if (!html || html.length === 0 || status !== 200) {
      console.log('[BROWSER API HTTP] Response body empty or non-200; headers:', response.headers);
    }
    
    // Parse results from HTML
    const extracted = extractOrganicLinksFromHtml(html);
    console.log(`[BROWSER API HTTP] ✓ Extracted ${extracted.length} results`);
    if (extracted.length > 0) {
      console.log(`[BROWSER API HTTP] Results:`, extracted.slice(0, 5).map((url, idx) => `\n  ${idx + 1}. ${url}`).join(''));
      return { links: extracted, debug: { method: 'http_api' } };
    }
    
    return null;
  } catch (error) {
    console.error(`[BROWSER API HTTP] Error: ${error.message}`);
    if (error.response) {
      console.error('[BROWSER API HTTP] Error status:', error.response.status, 'data length:', error.response.data ? error.response.data.length : 0);
    }
    return null;
  }
}

// Direct navigation via Browser API HTTP (for direct traffic)
async function navigateWithBrowserAPIHTTP(targetUrl, geoLocation, browserConfig) {
  try {
    const { browser_api_token, browser_zone } = browserConfig;
    
    if (!browser_api_token || !browser_zone) {
      console.error('[BROWSER API HTTP DIRECT] Missing API token or zone');
      return null;
    }
    
    console.log(`[BROWSER API HTTP DIRECT] Navigating to: ${targetUrl}`);
    console.log(`[BROWSER API HTTP DIRECT] Zone: ${browser_zone}, Geo: ${geoLocation}`);
    
    const response = await axios.post('https://api.brightdata.com/request', {
      zone: browser_zone,
      url: targetUrl,
      format: 'raw'
    }, {
      headers: {
        'Authorization': `Bearer ${browser_api_token}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000,
      validateStatus: () => true
    });
    
    const html = response.data;
    const status = response.status;
    console.log(`[BROWSER API HTTP DIRECT] Response received (status: ${status}), length: ${html ? html.length : 0} bytes`);
    
    if (status === 200 && html && html.length > 0) {
      console.log(`[BROWSER API HTTP DIRECT] ✓ Successfully loaded page`);
      return { success: true, html, status };
    }
    
    console.log('[BROWSER API HTTP DIRECT] ⚠️ Non-200 status or empty response');
    return null;
  } catch (error) {
    console.error(`[BROWSER API HTTP DIRECT] Error: ${error.message}`);
    return null;
  }
}

// WebSocket Method (Original) - Full browser control
async function searchWithBrowserAPI(searchKeyword, geoLocation, browserConfig, options = {}) {
  try {
    const { browser_customer_id, browser_username, browser_zone, browser_password, browser_endpoint, browser_port } = browserConfig;
    const { headless = true, extensionPath = null } = options; // Accept headless and extension options
    
    console.log(`[BROWSER API SEARCH] Starting search "${searchKeyword}" (geo: ${geoLocation})`);
    console.log(`[BROWSER API SEARCH] Mode: ${headless ? 'headless: true' : 'headless: false (extension support)'}`);
    if (extensionPath) {
      console.log(`[BROWSER API SEARCH] Extension will be loaded: ${extensionPath}`);
    }
    console.log(`[BROWSER API SEARCH] Credential check:`, {
      username: browser_username ? '✓' : '✗',
      password: browser_password ? '✓' : '✗',
      zone: browser_zone || 'scraping_browser1',
      endpoint: browser_endpoint || 'brd.superproxy.io',
      port: browser_port || '9222'
    });
    
    if (!browser_username || !browser_password) {
      console.error('[BROWSER API SEARCH] Missing Browser API credentials (username or password)');
      return null;
    }
    
    // Connect to Bright Data Browser API via HTTP Proxy (not WebSocket)
    // Format: http://username:password@brd.superproxy.io:33335
    // This works for scraping_browser zones
    
    console.log(`[BROWSER API SEARCH] Raw credentials received:`, {
      browser_username: browser_username,
      browser_password: '***',
      browser_zone: browser_zone
    });
    
    // For scraping_browser zones, use local Chrome with HTTP proxy authentication
    // The zone doesn't support WebSocket - it uses HTTP CONNECT tunneling
    const proxyHost = browser_endpoint || 'brd.superproxy.io';
    const proxyPort = '33335'; // HTTP proxy port for scraping_browser zones
    
    // Add geo-targeting to username
    const geoCode = geoLocation ? geoLocation.toUpperCase() : 'US';
    let authUsername = browser_username || '';
    
    // Bright Data uses -country-, Luna uses -region-
    const isLunaProxy = authUsername.includes('admin_') || authUsername.includes('lunaproxy');
    
    if (isLunaProxy && !authUsername.includes('-region-')) {
      authUsername = `${authUsername}-region-${geoCode.toLowerCase()}`;
    } else if (!isLunaProxy && !authUsername.includes('-country-')) {
      authUsername = `${authUsername}-country-${geoCode}`;
    }
    
    console.log(`[BROWSER API SEARCH] Launching Chrome with HTTP proxy (${proxyHost}:${proxyPort})...`);
    console.log(`[BROWSER API SEARCH] Geo-targeting: ${geoCode} (username: ${authUsername.substring(0, 40)}...) [${isLunaProxy ? 'Luna' : 'Bright Data'}]`);
    console.log(`[BROWSER API SEARCH] Headless mode: ${headless}`);
    
    // Build browser args - extension FIRST (loads from server), then proxy
    const searchBrowserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--proxy-bypass-list=<-loopback>'
    ];
    
    // IMPORTANT: Load extension FIRST (uses server bandwidth, not proxy)
    if (extensionPath) {
      searchBrowserArgs.push(`--disable-extensions-except=${extensionPath}`);
      searchBrowserArgs.push(`--load-extension=${extensionPath}`);
      console.log(`[BROWSER API SEARCH] Loading extension from server (not through proxy): ${extensionPath}`);
    }
    
    // Add proxy AFTER extension
    searchBrowserArgs.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
    
    const searchBrowser = await puppeteer.launch({
      headless: headless, // Use provided headless setting
      ignoreHTTPSErrors: true,
      args: searchBrowserArgs
    });
    
    console.log('[BROWSER API SEARCH] ✓ Browser launched');
    
    const searchPage = await searchBrowser.newPage();
    
    // Set proxy authentication with geo-targeted username
    await searchPage.authenticate({
      username: authUsername,
      password: browser_password
    });
    
    console.log('[BROWSER API SEARCH] ✓ Proxy authentication configured with geo-targeting');
    
    // Add minimal error handlers
    searchPage.on('error', (err) => {
      console.log('[BROWSER API SEARCH] Page error:', err.message);
    });
    
    // Suppress WebGL warnings from console
    searchPage.on('console', (msg) => {
      if (!msg.text().includes('WebGL') && !msg.text().includes('GroupMarkerNotSet')) {
        console.log('[PAGE]', msg.text());
      }
    });
    
    // Apply device profile for realistic behavior
    const deviceProfile = generateDeviceProfile(geoLocation);
    await injectRealDeviceFingerprint(searchPage, deviceProfile);
    await setRealisticHeaders(searchPage, deviceProfile);
    
    // Build Google search URL with geo parameter
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchKeyword)}&gl=${geoLocation.toLowerCase()}&hl=en&num=10`;
    
    console.log(`[BROWSER API SEARCH] Navigating to Google: ${googleUrl}`);
    
    // Try to navigate with retries for certificate issues
    let navigationSuccess = false;
    let navigationError = null;
    let lastStatusCode = null;
    
    // Intercept responses to check for actual connectivity
    let responseReceived = false;
    const responseHandler = (response) => {
      if (response.url().includes('google.com')) {
        responseReceived = true;
        lastStatusCode = response.status();
        console.log(`[BROWSER API SEARCH] Response received: ${response.status()} from ${response.url().substring(0, 80)}`);
      }
    };
    searchPage.on('response', responseHandler);
    
    try {
      const response = await searchPage.goto(googleUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      if (response) {
        lastStatusCode = response.status();
        console.log(`[BROWSER API SEARCH] Level 1 success: ${response.status()}`);
        navigationSuccess = true;
      }
    } catch (err) {
      navigationError = err;
      console.log(`[BROWSER API SEARCH] ⚠️ Level 1 (networkidle2) failed: ${err.message}`);
      
      try {
        // Retry with domcontentloaded
        const response = await searchPage.goto(googleUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        if (response) {
          lastStatusCode = response.status();
          console.log(`[BROWSER API SEARCH] Level 2 success: ${response.status()}`);
          navigationSuccess = true;
        }
      } catch (retryErr) {
        console.log(`[BROWSER API SEARCH] ⚠️ Level 2 (domcontentloaded) failed: ${retryErr.message}`);
        navigationError = retryErr;
        
        try {
          // Fallback: load event only
          const response = await searchPage.goto(googleUrl, {
            waitUntil: 'load',
            timeout: 20000
          });
          if (response) {
            lastStatusCode = response.status();
            console.log(`[BROWSER API SEARCH] Level 3 success: ${response.status()}`);
            navigationSuccess = true;
          }
        } catch (fallbackErr) {
          console.log(`[BROWSER API SEARCH] ⚠️ Level 3 (load) failed: ${fallbackErr.message}`);
          navigationError = fallbackErr;
          
          // Final attempt: navigate with 0 wait and promise race
          try {
            const navigationPromise = searchPage.goto(googleUrl, { 
              waitUntil: 'networkidle0',
              timeout: 15000 
            }).catch(() => null);
            
            const result = await Promise.race([
              navigationPromise,
              new Promise(r => setTimeout(() => r({ partial: true }), 10000))
            ]);
            
            if (result !== null) {
              navigationSuccess = true;
              console.log(`[BROWSER API SEARCH] Level 4 partial load (timeout tolerance)`);
            }
          } catch (finalErr) {
            console.log(`[BROWSER API SEARCH] ⚠️ Level 4 (networkidle0) failed: ${finalErr.message}`);
            navigationError = finalErr;
          }
        }
      }
    }
    
    // Check final URL to diagnose issue
    const finalUrl = searchPage.url();
    const isErrorPage = finalUrl.includes('chrome-error://') || finalUrl.includes('about:blank');
    
    if (isErrorPage) {
      console.log(`[BROWSER API SEARCH] ⚠️ Chrome error page detected: ${finalUrl}`);
      console.log(`[BROWSER API SEARCH] This indicates proxy connection failed at network level`);
      console.log(`[BROWSER API SEARCH] Possible causes:`);
      console.log(`  - Proxy server (brd.superproxy.io:33335) is unreachable`);
      console.log(`  - Network interface cannot route through proxy`);
      console.log(`  - Proxy credentials are invalid`);
      console.log(`  - DNS resolution failed for proxy endpoint`);
    }
    
    if (!navigationSuccess && !responseReceived) {
      console.log(`[BROWSER API SEARCH] ⚠️ No valid response received from any navigation attempt`);
      console.log(`[BROWSER API SEARCH] Last error: ${navigationError ? navigationError.message : 'Unknown'}`);
      console.log(`[BROWSER API SEARCH] Status code received: ${lastStatusCode}`);
      // Continue anyway to check what loaded
    }
    
    searchPage.off('response', responseHandler);
    
    // Check page content
    const pageTitle = await searchPage.title().catch(() => 'Unknown');
    const pageUrl = searchPage.url();
    console.log(`[BROWSER API SEARCH] Page Title: ${pageTitle}`);
    console.log(`[BROWSER API SEARCH] Final URL: ${pageUrl}`);
    
    // Get initial page content to check status
    let pageContent = await searchPage.content().catch(() => '');
    const isSorryPage = pageUrl.includes('/sorry') || pageContent.includes('/sorry') || pageContent.includes('unusual traffic');
    const hasCaptchaForm = pageContent.includes('recaptcha') || pageContent.includes('I\'m not a robot');
    
    console.log(`[BROWSER API SEARCH] Initial page checks:`, {
      isSorryPage: isSorryPage ? 'YES - BLOCKED' : 'NO',
      hasCaptchaForm: hasCaptchaForm ? 'YES' : 'NO',
      pageLength: pageContent.length,
      has_url_pattern: pageContent.includes('/url?q=') ? 'YES' : 'NO'
    });
    
    if (isSorryPage || hasCaptchaForm) {
      console.log('[BROWSER API SEARCH] ⚠️ CAPTCHA or blocking detected - waiting for Browser API to solve...');
      console.log('[BROWSER API SEARCH] Zone configured: scraping_browser (with auto-CAPTCHA solving enabled)');
      // Wait longer for Browser API to solve CAPTCHA
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 5000));
        pageContent = await searchPage.content();
        const stillBlocked = pageContent.includes('/sorry') || pageContent.includes('unusual traffic');
        const currentTitle = await searchPage.title();
        console.log(`[BROWSER API SEARCH] CAPTCHA check ${i + 1}/8 - ${stillBlocked ? 'Still blocked' : 'May be solved'} - Title: ${currentTitle.substring(0, 60)}`);
        if (!stillBlocked && pageContent.includes('/url?q=')) {
          console.log('[BROWSER API SEARCH] ✓ CAPTCHA appears to be solved!');
          break;
        }
      }
    }
    
    // Wait for results to load with longer timeout
    console.log('[BROWSER API SEARCH] Waiting for results selectors...');
    await Promise.race([
      searchPage.waitForSelector('div[data-sokoban-container]', { timeout: 15000 }),
      searchPage.waitForSelector('a[href*="/url?q="]', { timeout: 15000 }),
      searchPage.waitForSelector('h3', { timeout: 15000 }),
      new Promise(r => setTimeout(r, 15000))
    ]).catch(() => {
      console.log('[BROWSER API SEARCH] Selectors did not appear, continuing anyway...');
    });
    
    // Additional wait for JS rendering
    await new Promise(r => setTimeout(r, 3000));
    
    // Final check of page content before extraction
    pageContent = await searchPage.content();
    const hasSearchResults = pageContent.includes('/url?q=') || pageContent.includes('data-sokoban-container');
    console.log('[BROWSER API SEARCH] Final page checks before extraction:', {
      hasSearchResults: hasSearchResults ? 'YES' : 'NO',
      pageLength: pageContent.length,
      bytes: `${pageContent.length} bytes`
    });
    
    // Check if still on sorry page
    if (pageContent.includes('/sorry') || pageContent.includes('unusual traffic')) {
      console.log('[BROWSER API SEARCH] ⚠️ Still on sorry/block page - Browser API may not have solved CAPTCHA');
    }
    
    // Simulate human behavior
    const scrolls = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < scrolls; i++) {
      try {
        await searchPage.evaluate(() => window.scrollBy(0, window.innerHeight / 3));
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));
      } catch (err) {
        console.log('[BROWSER API SEARCH] Note: scroll failed (page may be in error state)');
        break;
      }
    }
    
    // Extract organic results from SERP
    let results = { links: [], debug: { totalLinksOnPage: 0, method1Count: 0, method2Count: 0, method3Count: 0, method4Count: 0, resultCount: 0 } };
    
    try {
      results = await searchPage.evaluate(() => {
        const links = new Set();
        const debugInfo = {
          method1Count: 0,
          method2Count: 0,
          method3Count: 0,
          method4Count: 0,
          totalLinksOnPage: 0,
          finalLinks: []
        };
        
        // Count ALL links on page for debugging
        const allLinks = document.querySelectorAll('a[href]');
        debugInfo.totalLinksOnPage = allLinks.length;
        
        // Method 1: /url?q= pattern (standard Google SERP)
        document.querySelectorAll('a[href*="/url?q="]').forEach(el => {
          try {
            const href = el.getAttribute('href');
            if (href && href.includes('/url?q=')) {
              const match = href.match(/\/url\?q=([^&]+)/);
              if (match) {
                const decoded = decodeURIComponent(match[1]);
                if (decoded.startsWith('http') && !decoded.includes('google.com')) {
                  links.add(decoded);
                  debugInfo.method1Count++;
                }
              }
            }
          } catch (e) {}
        });
        
        // Method 2: Direct links from main content
        if (links.size === 0) {
          document.querySelectorAll('div[role="main"] a[href^="http"]').forEach(el => {
            const href = el.getAttribute('href');
            if (href && href.startsWith('http') && !href.includes('google.com') && !href.includes('youtube.com')) {
              links.add(href);
              debugInfo.method2Count++;
            }
          });
        }
        
        // Method 3: H3 parent links
        if (links.size === 0) {
          document.querySelectorAll('h3').forEach(h3 => {
            const a = h3.closest('a') || h3.querySelector('a');
            if (a) {
              const href = a.getAttribute('href');
              if (href && href.startsWith('http') && !href.includes('google.com')) {
                links.add(href);
                debugInfo.method3Count++;
              }
            }
          });
        }
        
        // Method 4: Fallback - any external link from divs with g class (Google result containers)
        if (links.size === 0) {
          document.querySelectorAll('div.g a[href^="http"]').forEach(el => {
            const href = el.getAttribute('href');
            if (href && href.startsWith('http') && !href.includes('google.com')) {
              links.add(href);
              debugInfo.method4Count++;
            }
          });
        }
        
        debugInfo.finalLinks = Array.from(links).slice(0, 10);
        return { links: debugInfo.finalLinks, debug: debugInfo };
      });
    } catch (err) {
      console.log('[BROWSER API SEARCH] Error extracting results (page context may be destroyed):', err.message);
      // Continue with empty results
    }
    
    console.log(`[BROWSER API SEARCH] Extraction debug:`, {
      totalLinksOnPage: results.debug.totalLinksOnPage,
      method1: results.debug.method1Count,
      method2: results.debug.method2Count,
      method3: results.debug.method3Count,
      method4: results.debug.method4Count,
      resultCount: results.links.length
    });
    console.log(`[BROWSER API SEARCH] ✓ Found ${results.links.length} organic results`);
    if (results.links.length > 0) {
      console.log(`[BROWSER API SEARCH] Results found:`, results.links.map((url, idx) => `\n  ${idx + 1}. ${url}`).join(''));
    }
    
    await searchBrowser.close();
    
    return results.length > 0 ? results : null;
    
  } catch (error) {
    console.error(`[BROWSER API SEARCH] Error: ${error.message}`);
    return null;
  }
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
// SESSION LOGGER - Capture all logs for frontend display
// ════════════════════════════════════════════════════════════════════════

class SessionLogger {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.logs = [];
    this.startTime = new Date();
  }

  log(stage, message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      stage,
      message,
      type // 'info', 'success', 'warning', 'error'
    };
    this.logs.push(logEntry);
    console.log(`[${stage}] ${message}`);
  }

  success(stage, message) {
    this.log(stage, `✓ ${message}`, 'success');
  }

  warning(stage, message) {
    this.log(stage, `⚠️ ${message}`, 'warning');
  }

  error(stage, message) {
    this.log(stage, `✗ ${message}`, 'error');
  }

  getLogs() {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime: new Date(),
      totalLogs: this.logs.length,
      logs: this.logs
    };
  }
}

// ════════════════════════════════════════════════════════════════════════
// LUNA HEADFUL DIRECT - Direct traffic with extension support
// ════════════════════════════════════════════════════════════════════════

async function navigateWithLunaHeadful(targetUrl, geoLocation, lunaConfig, deviceProfile, extensionPath = null, searchKeyword = null, customReferrer = null) {
  try {
    const { proxy, proxyUsername, proxyPassword } = lunaConfig;
    
    // Use custom referrer if provided, otherwise blank
    const googleReferrer = customReferrer || '';
    if (customReferrer) {
      console.log(`[LUNA HEADFUL DIRECT] Using custom referrer: ${googleReferrer}`);
    } else {
      console.log(`[LUNA HEADFUL DIRECT] No custom referrer - using blank referrer`);
    }
    
    console.log(`[LUNA HEADFUL DIRECT] Starting direct navigation to: ${targetUrl}`);
    console.log(`[LUNA HEADFUL DIRECT] Geo: ${geoLocation}, Proxy: ${proxy ? 'configured' : 'none'}`);
    console.log(`[LUNA HEADFUL DIRECT] Extension: ${extensionPath ? 'yes' : 'no'}`);
    
    // Validate proxy credentials before launching Chrome
    if (!proxyUsername || !proxyPassword) {
      throw new Error('Luna Headful Direct requires proxyUsername and proxyPassword');
    }
    
    console.log(`[LUNA HEADFUL DIRECT] Proxy validation: credentials present`);
    console.log(`[LUNA HEADFUL DIRECT] Username format: ${proxyUsername.substring(0, 20)}...`);
    
    // Parse proxy host/port from proxy string (format: http://host:port)
    let proxyHost = 'na.lunaproxy.com';
    let proxyPort = '12233';
    if (proxy) {
      const match = proxy.match(/https?:\/\/([^:]+):(\d+)/);
      if (match) {
        proxyHost = match[1];
        proxyPort = match[2];
      }
    }
    
    console.log(`[LUNA HEADFUL DIRECT] Proxy endpoint: ${proxyHost}:${proxyPort}`);
    
    // Build browser args - extension FIRST, then proxy
    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--proxy-bypass-list=<-loopback>',
      `--window-size=${deviceProfile.screenWidth},${deviceProfile.screenHeight}`,
      '--remote-debugging-port=0'
    ];
    
    // Add extension FIRST if provided
    if (extensionPath) {
      browserArgs.push(`--disable-extensions-except=${extensionPath}`);
      browserArgs.push(`--load-extension=${extensionPath}`);
      console.log(`[LUNA HEADFUL DIRECT] Loading extension: ${extensionPath}`);
    }
    
    // Add proxy AFTER extension
    if (proxy) {
      browserArgs.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
    }
    
    // Launch with headless: false
    const lunaDirectBrowser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      args: browserArgs
    });
    
    console.log('[LUNA HEADFUL DIRECT] ✓ Browser launched (headless: false)');
    
    console.log('[LUNA HEADFUL DIRECT] Creating new page (may take time with extension + proxy)...');
    const startPageTime = Date.now();
    const lunaDirectPage = await lunaDirectBrowser.newPage();
    const pageCreationTime = Date.now() - startPageTime;
    console.log(`[LUNA HEADFUL DIRECT] ✓ Page created (${pageCreationTime}ms)`);
    
    // Set extra headers for referrer tracking (only if referrer provided)
    const headers = {
      'User-Agent': deviceProfile.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    if (googleReferrer) {
      headers['Referer'] = googleReferrer;
    }
    await lunaDirectPage.setExtraHTTPHeaders(headers);
    console.log(`[LUNA HEADFUL DIRECT] ✓ Extra HTTP headers set${googleReferrer ? ' (with Referer)' : ' (no Referer)'}`);
    
    // Set proxy auth if provided
    if (proxyUsername && proxyPassword) {
      const authUsername = proxyUsername.includes('-region-') 
        ? proxyUsername 
        : `${proxyUsername}-region-${geoLocation.toLowerCase()}`;
      
      console.log(`[LUNA HEADFUL DIRECT] Setting proxy authentication...`);
      await lunaDirectPage.authenticate({
        username: authUsername,
        password: proxyPassword
      });
      console.log(`[LUNA HEADFUL DIRECT] ✓ Proxy authentication configured`);
      console.log(`[LUNA HEADFUL DIRECT] Auth username: ${authUsername.substring(0, 40)}...`);
      console.log(`[LUNA HEADFUL DIRECT] Auth password: ${'*'.repeat(Math.min(proxyPassword.length, 8))}`);
    } else {
      console.warn(`[LUNA HEADFUL DIRECT] ⚠️ No proxy credentials provided!`);
    }
    
    // Apply device fingerprinting
    console.log(`[LUNA HEADFUL DIRECT] Injecting device fingerprint...`);
    await injectRealDeviceFingerprint(lunaDirectPage, deviceProfile);
    await setRealisticHeaders(lunaDirectPage, deviceProfile);
    console.log(`[LUNA HEADFUL DIRECT] ✓ Device fingerprinting injected`);
    
    // Attach lean resource guards to reduce bandwidth while preserving analytics
    try {
      const host = new URL(targetUrl).hostname;
      initLeanResourceGuards(lunaDirectPage, host);
      console.log(`[LUNA HEADFUL DIRECT] ✓ Lean resource guards attached for host: ${host}`);
    } catch (err) {
      console.log(`[LUNA HEADFUL DIRECT] Resource guards attach failed: ${err.message}`);
    }

    // Navigate to target URL
    console.log(`[LUNA HEADFUL DIRECT] Starting navigation...`);
    console.log(`[LUNA HEADFUL DIRECT] Target: ${targetUrl}`);
    console.log(`[LUNA HEADFUL DIRECT] Proxy: ${proxyHost}:${proxyPort}`);
    console.log(`[LUNA HEADFUL DIRECT] Timeout: 120000ms (2 minutes)`);
    
    try {
      console.log(`[LUNA HEADFUL DIRECT] goto()${googleReferrer ? ' with referrer...' : ' (no referrer)...'}`);
      if (googleReferrer) {
        console.log(`[LUNA HEADFUL DIRECT] Referrer: ${googleReferrer}`);
      }
      const startNavTime = Date.now();
      const gotoOptions = { waitUntil: 'domcontentloaded', timeout: 45000 };
      if (googleReferrer) {
        gotoOptions.referer = googleReferrer;
      }
      await lunaDirectPage.goto(targetUrl, gotoOptions);
      
      // Wait for GA/GTM scripts to fire after domcontentloaded
      await new Promise(r => setTimeout(r, 2000));
      console.log(`[LUNA HEADFUL DIRECT] ✓ Allowed 2s for GA scripts to fire`);
      
      const navTime = Date.now() - startNavTime;
      const finalUrl = lunaDirectPage.url();
      console.log(`[LUNA HEADFUL DIRECT] ✓ Page loaded successfully (${navTime}ms)`);
      console.log(`[LUNA HEADFUL DIRECT] Final URL: ${finalUrl}`);
      
      // Check if we ended up on an error page
      if (finalUrl.includes('chrome-error') || finalUrl.includes('about:error')) {
        console.error(`[LUNA HEADFUL DIRECT] ✗ ERROR PAGE DETECTED: ${finalUrl}`);
        const errorText = await lunaDirectPage.evaluate(() => document.body.innerText);
        console.error(`[LUNA HEADFUL DIRECT] Error details: ${errorText.substring(0, 500)}`);
      }
    } catch (err) {
      console.log(`[LUNA HEADFUL DIRECT] ⚠️ Navigation error: ${err.message}, retrying with domcontentloaded...`);
      try {
        const gotoOptions = { waitUntil: 'domcontentloaded', timeout: 15000 };
        if (googleReferrer) {
          gotoOptions.referer = googleReferrer;
        }
        await lunaDirectPage.goto(targetUrl, gotoOptions);
        const finalUrl = lunaDirectPage.url();
        console.log(`[LUNA HEADFUL DIRECT] ✓ Page loaded (networkidle0 fallback)`);
        console.log(`[LUNA HEADFUL DIRECT] Final URL: ${finalUrl}`);
        
        if (finalUrl.includes('chrome-error') || finalUrl.includes('about:error')) {
          console.error(`[LUNA HEADFUL DIRECT] ✗ ERROR PAGE DETECTED: ${finalUrl}`);
        }
      } catch (retryErr) {
        console.log(`[LUNA HEADFUL DIRECT] ⚠️ Final navigation attempt failed: ${retryErr.message}`);
        const finalUrl = lunaDirectPage.url();
        console.error(`[LUNA HEADFUL DIRECT] Final URL after error: ${finalUrl}`);
      }
    }
    
    // Simulate human behavior
    const scrolls = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < scrolls; i++) {
      try {
        await lunaDirectPage.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
      } catch (err) {
        console.log('[LUNA HEADFUL DIRECT] Note: scroll failed');
        break;
      }
    }
    
    console.log(`[LUNA HEADFUL DIRECT] ✓ Navigation completed successfully`);
    
    return { browser: lunaDirectBrowser, page: lunaDirectPage, success: true };
    
  } catch (error) {
    console.error(`[LUNA HEADFUL DIRECT] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ════════════════════════════════════════════════════════════════════════
// MAIN AUTOMATION ENDPOINT
// ════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ status: 'ok', features: ['Real-Device Mode', 'SERP API', 'Luna Proxy', 'Fingerprinting'] });
});

// Debug endpoint to check if we're receiving Browser API creds
app.post('/api/debug', (req, res) => {
  const { browser_customer_id, browser_password, useLunaProxySearch, searchKeyword } = req.body;
  console.log('[DEBUG ENDPOINT]', {
    browser_customer_id: !!browser_customer_id ? 'PRESENT' : 'MISSING',
    browser_password: !!browser_password ? 'PRESENT' : 'MISSING',
    useLunaProxySearch,
    searchKeyword
  });
  res.json({ 
    received: {
      browser_customer_id: !!browser_customer_id,
      browser_password: !!browser_password,
      useLunaProxySearch,
      searchKeyword
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// PROCESS AUTOMATE JOB (EXTRACTED FROM /api/automate)
// ════════════════════════════════════════════════════════════════════════
async function processAutomateJob(reqBody, jobId) {
  const sessionLogger = new SessionLogger(jobId);
  const sessionStartMs = Date.now();
  const bandwidthTracker = createBandwidthTracker(sessionLogger);

  let browser;
  let page;
  let clickedUrl = reqBody.url;

  try {
    const {
      url,
      geoLocation,
      searchKeyword,
      campaignType, // 'direct' or 'search'
      customReferrer, // Custom referrer from campaign settings
      // Direct traffic params
      proxy,
      proxyUsername,
      proxyPassword,
      // Search traffic params
      browser_api_token,
      browser_zone,
      browser_customer_id,
      browser_username,
      browser_password,
      browser_endpoint,
      browser_port,
      // Extension params
      extensionId, // Chrome Web Store extension ID
      // Common params
      sessionId,
      userJourney,
      sessionDurationMin,
      sessionDurationMax,
      supabaseUrl,
      supabaseKey,
      bounceRate
    } = reqBody;

  // Optional feature flags / extra params (provide safe defaults)
  let useLunaProxySearch = reqBody.useLunaProxySearch || false;
  let useBrowserAutomation = reqBody.useBrowserAutomation || false;
  let useSerpApi = reqBody.useSerpApi || false;
  let useLunaHeadfulDirect = reqBody.useLunaHeadfulDirect || false;
  const serp_api_token = reqBody.serp_api_token;
  const serp_customer_id = reqBody.serp_customer_id;
  const serp_zone_name = reqBody.serp_zone_name;
  const serp_endpoint = reqBody.serp_endpoint;
  const serp_port = reqBody.serp_port;

  // Prefer request-supplied token, else fall back to environment default
  const effectiveBrowserApiToken = browser_api_token || FALLBACK_BROWSER_API_TOKEN;

    const deviceProfile = generateDeviceProfile(geoLocation || 'US');
    sessionLogger.log('SESSION', `Campaign Type: ${campaignType}, Target: ${url}`, 'info');
    sessionLogger.log('DEVICE', `Using: ${deviceProfile.name}`, 'info');
    console.log(`[SESSION] Type: ${(campaignType || 'direct').toUpperCase()}, Target: ${url}`);
    console.log(`[DEVICE] Using: ${deviceProfile.name}`);
    
    // Direct traffic: force Luna headful path and require Luna proxy creds
    if (campaignType === 'direct') {
      useLunaProxySearch = false;
      useBrowserAutomation = false;
      useSerpApi = false;
      useLunaHeadfulDirect = true;

      if (!proxy || !proxyUsername || !proxyPassword) {
        const msg = 'Direct traffic requires Luna proxy credentials (proxy, proxyUsername, proxyPassword)';
        sessionLogger.error('LUNA', msg);
        throw new Error(msg);
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // SEARCH CAMPAIGN - Browser API Only
    // ═══════════════════════════════════════════════════════════
    if (campaignType === 'search') {
      console.log('[FLOW] ✓✓✓ Browser API mode - Search traffic ✓✓✓');
      
      // Use custom referrer if provided, otherwise blank
      const googleReferrer = customReferrer || '';
      if (customReferrer) {
        sessionLogger.log('REFERRER', `Using custom referrer: ${customReferrer}`, 'info');
        console.log(`[BROWSER API] Using custom referrer: ${customReferrer}`);
      } else {
        sessionLogger.log('REFERRER', 'No custom referrer - using blank', 'info');
        console.log(`[BROWSER API] No custom referrer - using blank referrer`);
      }
      
      // Download extension FIRST (before any browser launch)
      let extensionPath = null;
      if (extensionId) {
        try {
          extensionPath = await getExtensionPath(extensionId);
          console.log(`[EXTENSION] Extension ready for search: ${extensionId} -> ${extensionPath}`);
        } catch (error) {
          console.error(`[EXTENSION] Failed to load extension ${extensionId}:`, error.message);
          // Continue without extension
        }
      }
      
      // For search traffic: perform Google search first WITH extension loaded
      if (searchKeyword) {
        console.log(`[BROWSER API] Performing Google search for: ${searchKeyword}`);
        if (extensionPath) {
          console.log(`[BROWSER API] Extension will be active during search`);
        }
        
        let searchResults = null;
        
        // Try HTTP API first (for regular Browser API zones like 'unblocker')
        // Skip HTTP if using Scraping Browser zone (requires WebSocket)
        const isScrappingBrowserZone = browser_zone && browser_zone.includes('scraping_browser');
        if (!isScrappingBrowserZone && browser_api_token) {
          console.log('[BROWSER API] Attempting HTTP API method (zone allows HTTP)...');
          const browserConfig = {
            browser_api_token: effectiveBrowserApiToken,
            browser_zone
          };
          searchResults = await searchWithBrowserAPIHTTP(searchKeyword, geoLocation, browserConfig);
        } else if (isScrappingBrowserZone) {
          console.log('[BROWSER API] Detected Scraping Browser zone - skipping HTTP API (requires WebSocket)');
        }
        
        // Fallback to WebSocket with headless: false and extension
        if ((!searchResults || searchResults.links.length === 0) && browser_customer_id && browser_username && browser_password) {
          console.log('[BROWSER API] Falling back to WebSocket method WITH EXTENSION...');
          const browserConfig = {
            browser_customer_id,
            browser_username,
            browser_zone,
            browser_password,
            browser_endpoint,
            browser_port
          };
          
          // Pass headless: false and extension path for search
          const searchOptions = {
            headless: false, // Always use headless: false for search with extension
            extensionPath: extensionPath // Load extension during search
          };
          
          searchResults = await searchWithBrowserAPI(searchKeyword, geoLocation, browserConfig, searchOptions);
        } else if ((!searchResults || searchResults.links.length === 0) && !browser_password) {
          console.log('[BROWSER API] ⚠️ WebSocket fallback skipped: missing browser_password credentials');
        }
        const searchResultsFromSearch = searchResults;
        
        if (searchResults && searchResults.links && searchResults.links.length > 0) {
          const targetDomain = new URL(url).hostname.replace('www.', '');
          console.log(`[BROWSER API] Target domain to match: ${targetDomain}`);
          
          let foundUrl = searchResults.links.find(resultUrl => {
            try {
              const resultDomain = new URL(resultUrl).hostname.replace('www.', '');
              const isMatch = resultDomain.includes(targetDomain) || targetDomain.includes(resultDomain);
              console.log(`[BROWSER API] Checking domain "${resultDomain}" against "${targetDomain}": ${isMatch ? 'MATCH' : 'no match'}`);
              return isMatch;
            } catch (e) {
              return false;
            }
          });
          
          if (!foundUrl) {
            const randomIdx = Math.floor(Math.random() * Math.min(5, searchResults.links.length));
            foundUrl = searchResults.links[randomIdx];
            console.log(`[BROWSER API] No target match, selecting random result #${randomIdx + 1}`);
          } else {
            console.log(`[BROWSER API] ✓ Found target match in results`);
          }
          
          clickedUrl = foundUrl;
        }
      }

      // Navigate to target (or clicked result) in a real browser WITH PROXY so GA/JS runs
      // Extension already downloaded above
      console.log(`[BROWSER API] Navigating (real browser) to: ${clickedUrl}`);
      
      // Add geo-targeting to username
      const geoCode = geoLocation ? geoLocation.toUpperCase() : 'US';
      let authUsername = browser_username || '';
      
      // Bright Data uses -country-, Luna uses -region-
      const isLunaProxy = authUsername.includes('admin_') || authUsername.includes('lunaproxy');
      
      if (isLunaProxy && !authUsername.includes('-region-')) {
        authUsername = `${authUsername}-region-${geoCode.toLowerCase()}`;
      } else if (!isLunaProxy && !authUsername.includes('-country-')) {
        authUsername = `${authUsername}-country-${geoCode}`;
      }
      
      const proxyHost = browser_endpoint || 'brd.superproxy.io';
      const proxyPort = '33335';
      
      console.log(`[BROWSER API] Using proxy for final navigation: ${proxyHost}:${proxyPort} (geo: ${geoCode}) [${isLunaProxy ? 'Luna' : 'Bright Data'}]`);
      
      // Build browser args - load extension WITHOUT proxy first (saves bandwidth)
      const browserArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--proxy-bypass-list=<-loopback>',
        `--window-size=${deviceProfile.screenWidth},${deviceProfile.screenHeight}`,
      ];
      
      // Add extension loading args if provided (loads from server bandwidth, not proxy)
      if (extensionPath) {
        browserArgs.push(`--disable-extensions-except=${extensionPath}`);
        browserArgs.push(`--load-extension=${extensionPath}`);
        console.log(`[EXTENSION] Loading extension from: ${extensionPath} (using server bandwidth)`);
      }
      
      // Add proxy AFTER extension args
      browserArgs.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
      
      browser = await puppeteer.launch({
        headless: false, // Always use headless: false for search campaigns (Xvfb provides display)
        ignoreHTTPSErrors: true,
        args: browserArgs
      });
      
      console.log(`[BROWSER API] ✓ Browser launched with headless: false${extensionPath ? ' and extension' : ''}`);

      page = await browser.newPage();
      bandwidthTracker.attachToPage(page);
      try { initLeanResourceGuards(page, new URL(clickedUrl).hostname); } catch {}
      
      // Set proxy authentication with geo-targeting
      await page.authenticate({
        username: authUsername,
        password: browser_password
      });
      
      console.log(`[BROWSER API] ✓ Proxy authentication configured for final navigation (geo: ${geoCode})`);
      
      await injectRealDeviceFingerprint(page, deviceProfile);
      await setRealisticHeaders(page, deviceProfile);
      
      const gotoOptions = { waitUntil: 'domcontentloaded', timeout: 30000 };
      if (googleReferrer) {
        gotoOptions.referer = googleReferrer;
      }
      await page.goto(clickedUrl, gotoOptions);
      
      // Wait for GA/GTM scripts to fire after domcontentloaded
      await new Promise(r => setTimeout(r, 2000));
      console.log(`[BROWSER API] ✓ Allowed 2s for GA scripts to fire`);
      
      // User journey (if provided) else random browsing with multi-page chance
      if (userJourney && userJourney.length > 0) {
        for (const action of userJourney) {
          const { type, selector, url: actionUrl, text, delay } = action;
          try {
            if (type === 'click' && selector) {
              await page.click(selector);
              sessionLogger.log('JOURNEY', `Clicked: ${selector}`, 'success');
            } else if (type === 'type' && selector) {
              await page.type(selector, text, { delay: 100 });
              sessionLogger.log('JOURNEY', `Typed in: ${selector}`, 'success');
            } else if (type === 'navigate' && actionUrl) {
              await page.goto(actionUrl, { waitUntil: 'networkidle2' });
              sessionLogger.log('JOURNEY', `Navigated to: ${actionUrl}`, 'success');
            }
            if (delay) await new Promise(r => setTimeout(r, delay));
          } catch (err) {
            sessionLogger.warning('JOURNEY', err.message);
          }
        }
        sessionLogger.success('JOURNEY', 'Completed');
      } else {
        await maybeMultiPageBrowse(page, clickedUrl, sessionLogger);
      }

      // Dwell/bounce duration honoring frontend inputs
      const minSec = sessionDurationMin || 30;
      const maxSec = sessionDurationMax || 120;
      const shouldBounce = (bounceRate || 0) > 0 && Math.random() < ((bounceRate || 0) / 100);
      const durationSec = shouldBounce ? Math.floor(5 + Math.random() * 5) : Math.floor(minSec + Math.random() * (maxSec - minSec));
      lastPlannedDurationSec = durationSec;
      await new Promise(r => setTimeout(r, durationSec * 1000));
      
      const actualDurationSec = Math.round((Date.now() - sessionStartMs) / 1000);
      bandwidthTracker.report(clickedUrl, actualDurationSec);
      console.log('[BROWSER API] ✓ Session completed successfully (real browser)');
      const logs = sessionLogger.getLogs();
      return { success: true, sessionId, clickedUrl, targetUrl: clickedUrl, method: 'browser_api_browser', logs, bandwidthBytes: bandwidthTracker.getTotalBytes(), actualDurationSec };
    }
    
    // ═══════════════════════════════════════════════════════════
    // DIRECT CAMPAIGN - Luna Headful (NEW OPTION 2)
    // ═══════════════════════════════════════════════════════════
    if (campaignType === 'direct' && useLunaHeadfulDirect && proxy) {
      sessionLogger.log('FLOW', 'Luna Headful Direct mode - Direct navigation with extension', 'info');
      
      // Download extension if provided
      let extensionPath = null;
      if (extensionId) {
        try {
          extensionPath = await getExtensionPath(extensionId);
          sessionLogger.success('EXTENSION', `Extension ready: ${extensionId}`);
        } catch (error) {
          sessionLogger.error('EXTENSION', `Failed to load extension ${extensionId}: ${error.message}`);
        }
      }
      
      const lunaConfig = {
        proxy,
        proxyUsername,
        proxyPassword
      };
      
      sessionLogger.log('LUNA', 'Initiating Luna Headful Direct navigation', 'info');
      const result = await navigateWithLunaHeadful(url, geoLocation || 'US', lunaConfig, deviceProfile, extensionPath, searchKeyword, customReferrer);
      
      if (result.success && result.page) {
        page = result.page;
        browser = result.browser;
        clickedUrl = url;
        bandwidthTracker.attachToPage(page);
        // Network guards disabled for CPU optimization
        
        sessionLogger.success('LUNA', 'Browser and page acquired for session continuation');
        
        // Execute user journey or random behavior
        if (userJourney && userJourney.length > 0) {
          sessionLogger.log('JOURNEY', 'Executing user actions', 'info');
          for (const action of userJourney) {
            const { type, selector, url: actionUrl, text, delay } = action;
            try {
              if (type === 'click' && selector) {
                await page.click(selector);
                sessionLogger.log('JOURNEY', `Clicked: ${selector}`, 'success');
              } else if (type === 'type' && selector) {
                await page.type(selector, text, { delay: 100 });
                sessionLogger.log('JOURNEY', `Typed in: ${selector}`, 'success');
              } else if (type === 'navigate' && actionUrl) {
                await page.goto(actionUrl, { waitUntil: 'networkidle2' });
                sessionLogger.log('JOURNEY', `Navigated to: ${actionUrl}`, 'success');
              }
              
              if (delay) {
                await new Promise(r => setTimeout(r, delay));
              }
            } catch (err) {
              sessionLogger.warning('JOURNEY', err.message);
            }
          }
          sessionLogger.success('JOURNEY', 'Completed');
        } else {
          await maybeMultiPageBrowse(page, clickedUrl, sessionLogger);
        }
        
        // Session duration honoring frontend inputs
        const minSec = sessionDurationMin || 30;
        const maxSec = sessionDurationMax || 120;
        const shouldBounce = (bounceRate || 0) > 0 && Math.random() < ((bounceRate || 0) / 100);
        const durationSec = shouldBounce ? Math.floor(5 + Math.random() * 5) : Math.floor(minSec + Math.random() * (maxSec - minSec));
        lastPlannedDurationSec = durationSec;
        await new Promise(r => setTimeout(r, durationSec * 1000));
        
        const actualDurationSec = Math.round((Date.now() - sessionStartMs) / 1000);
        bandwidthTracker.report(clickedUrl, actualDurationSec);
        sessionLogger.success('SESSION', 'Completed successfully');
        const logs = sessionLogger.getLogs();
        return { success: true, sessionId, clickedUrl, targetUrl: clickedUrl, method: 'luna_headful_direct', logs, bandwidthBytes: bandwidthTracker.getTotalBytes(), actualDurationSec };
      } else {
        sessionLogger.error('LUNA', `Navigation failed: ${result.error}`);
        const logs = sessionLogger.getLogs();
        throw new Error(`Luna Headful Direct failed: ${result.error}`);
      }
    }
    
    // ORIGINAL FLOW: For non-Browser API campaigns
    // Step 1: Perform Google search (via Browser API or SERP API if enabled)
    clickedUrl = url;
    
    // DEBUG: Check all conditions for Browser API search
    sessionLogger.log('DEBUG', 'Checking conditions for Browser API search', 'info');
    console.log('[DEBUG CONDITIONS]');
    console.log(`  useLunaProxySearch: ${useLunaProxySearch}`);
    console.log(`  searchKeyword: ${searchKeyword}`);
    console.log(`  browser_customer_id: ${browser_customer_id ? 'YES' : 'NO'}`);
    console.log(`  browser_username: ${browser_username ? 'YES' : 'NO'}`);
    console.log(`  browser_password: ${browser_password ? 'YES' : 'NO'}`);
    console.log(`  ALL CONDITIONS MET: ${useLunaProxySearch && searchKeyword && browser_customer_id && browser_username && browser_password}`);
    
    // Browser API Search (PRIMARY - replaces Luna for search traffic)
    if (useLunaProxySearch && searchKeyword && browser_customer_id && browser_username) {
      console.log('[FLOW] ✓✓✓ Browser API Search mode - Google search + click via Browser API ✓✓✓');
      
      const browserConfig = {
        browser_customer_id,
        browser_username,
        browser_zone,
        browser_password,
        browser_api_token: effectiveBrowserApiToken,
        browser_endpoint,
        browser_port
      };
      
      // Try HTTP API first IF we have API token (more reliable for Google), fallback to WebSocket
      let searchResults = null;
      if (effectiveBrowserApiToken) {
        searchResults = await searchWithBrowserAPIHTTP(searchKeyword, geoLocation, browserConfig);
      } else {
        console.log('[BROWSER API] No API token provided, skipping HTTP method');
      }

      // Only try WebSocket fallback if password exists AND zone is allowed for Browser API WS
      const allowWebSocketFallback = !!browser_password && !(browser_zone && browser_zone.includes('scraping_browser1'));
      if ((!searchResults || searchResults.links.length === 0) && allowWebSocketFallback) {
        console.log('[BROWSER API] HTTP method failed/skipped, trying WebSocket method...');
        searchResults = await searchWithBrowserAPI(searchKeyword, geoLocation, browserConfig);
      } else if ((!searchResults || searchResults.links.length === 0) && !allowWebSocketFallback) {
        console.log('[BROWSER API] Skipping WebSocket fallback (zone not authorized for WS or missing password).');
      } else if (!browser_password && !browser_api_token) {
        console.log('[BROWSER API] ⚠️ No credentials provided (need API token for HTTP or password for WebSocket)');
      }
      
      if (searchResults && searchResults.links && searchResults.links.length > 0) {
        // Find target URL or pick random from results
        const targetDomain = new URL(url).hostname.replace('www.', '');
        console.log(`[BROWSER API SEARCH] Target domain to match: ${targetDomain}`);
        
        let foundUrl = searchResults.links.find(resultUrl => {
          try {
            const resultDomain = new URL(resultUrl).hostname.replace('www.', '');
            const isMatch = resultDomain.includes(targetDomain) || targetDomain.includes(resultDomain);
            console.log(`[BROWSER API SEARCH] Checking domain "${resultDomain}" against "${targetDomain}": ${isMatch ? 'MATCH' : 'no match'}`);
            return isMatch;
          } catch (e) {
            console.log(`[BROWSER API SEARCH] Error parsing URL: ${resultUrl}`);
            return false;
          }
        });
        
        if (!foundUrl) {
          const randomIdx = Math.floor(Math.random() * Math.min(5, searchResults.links.length));
          foundUrl = searchResults.links[randomIdx];
          console.log(`[BROWSER API SEARCH] No target match found, selecting random result #${randomIdx + 1}`);
          console.log(`[BROWSER API SEARCH] *** WILL CLICK ON: ${foundUrl}`);
        } else {
          console.log(`[BROWSER API SEARCH] *** FOUND TARGET MATCH IN RESULTS ***`);
          console.log(`[BROWSER API SEARCH] *** WILL CLICK ON: ${foundUrl}`);
        }
        
        clickedUrl = foundUrl;
      } else {
        console.log('[BROWSER API SEARCH] No results found from search');
        console.log(`[BROWSER API SEARCH] *** WILL NAVIGATE TO TARGET: ${url}`);
      }
    }
    // SERP API Search (SECONDARY - if Luna not selected but SERP API enabled)
    else if (useSerpApi && searchKeyword && serp_api_token && serp_customer_id) {
      console.log('[FLOW] SERP API mode - using dual-proxy approach');
      
      const serpConfig = {
        api_token: serp_api_token,
        customer_id: serp_customer_id,
        zone_name: serp_zone_name || 'serp',
        endpoint: serp_endpoint || 'brd.superproxy.io',
        port: serp_port || '33335'
      };
      
      // Launch temporary browser for SERP search with real device mode
      let serpBrowser = await puppeteer.launch({
        headless: true,
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
      console.log('[SERP] ✓ Closed SERP browser, launching final browser');
    }
    
    // Step 2: Launch final browser for site navigation
    // Download extension if ID provided (before deciding navigation method)
    // Only download/attach extension for non-direct flows (direct is handled in Luna headful block above)
    let extensionPath = null;
    if (campaignType !== 'direct' && extensionId) {
      try {
        extensionPath = await getExtensionPath(extensionId);
        console.log(`[EXTENSION] Extension ready: ${extensionId} -> ${extensionPath}`);
      } catch (error) {
        console.error(`[EXTENSION] Failed to load extension ${extensionId}:`, error.message);
        // Continue without extension
      }
    }

    // Decide if Browser API WS navigation is allowed (skip for zones like scraping_browser1)
    const allowBrowserApiNavigation = useLunaProxySearch && searchKeyword && browser_customer_id && browser_username && browser_password && !(browser_zone && browser_zone.includes('scraping_browser1'));
    
    // If extension is loaded, ALWAYS use launch() instead of connect()
    if (extensionPath) {
      // Launch browser with extension (for both search and direct)
      console.log('[EXTENSION] Using puppeteer.launch() for extension support (headless: false)');
      
      const geoCode = geoLocation ? geoLocation.toUpperCase() : 'US';
      const proxyHost = browser_endpoint || 'brd.superproxy.io';
      const proxyPort = '33335'; // HTTP proxy port for extension support
      
      // Build browser args with extension first, then proxy
      const browserArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--proxy-bypass-list=<-loopback>',
        `--window-size=${deviceProfile.screenWidth},${deviceProfile.screenHeight}`,
      ];
      
      // Add extension loading args FIRST (loads from server, not through proxy)
      browserArgs.push(`--disable-extensions-except=${extensionPath}`);
      browserArgs.push(`--load-extension=${extensionPath}`);
      console.log(`[EXTENSION] Loading extension from: ${extensionPath} (using server bandwidth)`);
      
      // Add proxy AFTER extension args
      browserArgs.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
      
      // Launch with headless: false (required for extensions)
      browser = await puppeteer.launch({
        headless: false,
        ignoreHTTPSErrors: true,
        args: browserArgs
      });
      
      page = await browser.newPage();
      bandwidthTracker.attachToPage(page);
      try { initLeanResourceGuards(page, new URL(clickedUrl).hostname); } catch {}
      
      // Authenticate proxy with geo-targeting
      let authUsername = browser_username || '';
      if (!authUsername) {
        throw new Error('[EXTENSION + PROXY] Missing browser_username for proxy authentication');
      }
      // Bright Data uses -country-, Luna uses -region-
      const isLunaProxy = authUsername.includes('admin_') || authUsername.includes('lunaproxy');
      
      if (isLunaProxy && !authUsername.includes('-region-')) {
        authUsername = `${authUsername}-region-${geoCode.toLowerCase()}`;
      } else if (!isLunaProxy && !authUsername.includes('-country-')) {
        authUsername = `${authUsername}-country-${geoCode}`;
      }
      
      await page.authenticate({
        username: authUsername,
        password: browser_password
      });
      
      console.log(`[EXTENSION + PROXY] ✓ Browser launched with extension and proxy auth (${isLunaProxy ? 'Luna' : 'Bright Data'}, geo: ${geoCode})`);
      console.log(`[EXTENSION + PROXY] Auth username: ${authUsername.substring(0, 40)}...`);
      
    } else if (allowBrowserApiNavigation) {
      // Continue with Browser API WebSocket after search (no extension)
      const geoCode = geoLocation ? geoLocation.toUpperCase() : 'US';
      // Add geo-targeting to username if not already present
      let authUsername = browser_username;
      if (!authUsername.includes('-country-')) {
        authUsername = `${authUsername}-country-${geoCode}`;
      }
      const wsEndpoint = `wss://${authUsername}:${browser_password}@${browser_endpoint || 'brd.superproxy.io'}:${browser_port || '9222'}`;
      
      console.log('[BROWSER API] Connecting for site navigation...');
      browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        ignoreHTTPSErrors: true
      });
      console.log('[BROWSER API] ✓ Connected');
      
      const pages = await browser.pages();
      page = pages[0] || await browser.newPage();
      bandwidthTracker.attachToPage(page);
      try { initLeanResourceGuards(page, new URL(clickedUrl).hostname); } catch {}
    } else if (useBrowserAutomation && browser_customer_id && browser_username && browser_password) {
      // Use Browser API for direct navigation (no search, no extension)
      const geoCode = geoLocation ? geoLocation.toUpperCase() : 'US';
      // Add geo-targeting to username if not already present
      let authUsername = browser_username;
      if (!authUsername.includes('-country-')) {
        authUsername = `${authUsername}-country-${geoCode}`;
      }
      const wsEndpoint = `wss://${authUsername}:${browser_password}@${browser_endpoint || 'brd.superproxy.io'}:${browser_port || '9222'}`;
      
      console.log('[BROWSER API] Connecting for direct navigation...');
      browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        ignoreHTTPSErrors: true
      });
      console.log('[BROWSER API] ✓ Connected');
      
      const pages = await browser.pages();
      page = pages[0] || await browser.newPage();
      bandwidthTracker.attachToPage(page);
      try { initLeanResourceGuards(page, new URL(clickedUrl).hostname); } catch {}
    } else {
      // Luna Proxy fallback for direct navigation (no extension, no Browser API)
      browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--ignore-certificate-errors',
          '--proxy-bypass-list=<-loopback>',
          `--window-size=${deviceProfile.screenWidth},${deviceProfile.screenHeight}`,
          ...(proxy ? [`--proxy-server=${proxy}`] : [])
        ]
      });
      
      page = await browser.newPage();
      bandwidthTracker.attachToPage(page);
      try { initLeanResourceGuards(page, new URL(clickedUrl).hostname); } catch {}
      
      // Set proxy auth if using Luna Proxy
      if (proxy && proxyUsername && proxyPassword) {
        // Luna proxy format: user-admin_X5otK-region-{countrycode}
        const authUsername = proxyUsername.includes('-region-') 
          ? proxyUsername 
          : `${proxyUsername}-region-${geoLocation ? geoLocation.toLowerCase() : 'us'}`;
        
        await page.authenticate({
          username: authUsername,
          password: proxyPassword
        });
        console.log(`[LUNA PROXY] ✓ Geo-targeting configured: ${authUsername}`);
      }
    }
    
    // Apply real device fingerprinting to final browser
    await injectRealDeviceFingerprint(page, deviceProfile);
    await setRealisticHeaders(page, deviceProfile);
    
    // Load cookies - skip for Browser API (managed automatically)
    if (!(useLunaProxySearch && searchKeyword && browser_customer_id && browser_username && browser_password) &&
        !(useBrowserAutomation && browser_customer_id && browser_username && browser_password)) {
      const proxyIdentifier = proxy ? proxy.replace(/[^a-zA-Z0-9]/g, '_') : sessionId || 'default';
      const cookies = loadOrCreateCookies(proxyIdentifier);
      try {
        await page.setCookie(...cookies);
      } catch (err) {
        console.log('[COOKIES] Warning - could not set cookies:', err.message);
      }
    }
    
    // Navigate to target URL
    console.log(`[NAVIGATE] *** NAVIGATION STEP ***`);
    console.log(`[NAVIGATE] URL to navigate: ${clickedUrl}`);
    console.log(`[NAVIGATE] Source: ${useLunaProxySearch && searchKeyword ? 'Browser API Search Result' : 'Direct Traffic/Target URL'}`);
    try {
      await page.goto(clickedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for GA/GTM scripts to fire after domcontentloaded
      await new Promise(r => setTimeout(r, 2000));
      console.log(`[NAVIGATE] ✓ Allowed 2s for GA scripts to fire`);
      
      const finalUrl = page.url();
      console.log(`[NAVIGATE] ✓ Page loaded successfully`);
      console.log(`[NAVIGATE] Final URL after navigation: ${finalUrl}`);
      if (finalUrl !== clickedUrl) {
        console.log(`[NAVIGATE] ⚠️ URL changed due to redirects: ${clickedUrl} -> ${finalUrl}`);

      }
    } catch (err) {
      console.error(`[NAVIGATE] Error navigating to ${clickedUrl}: ${err.message}`);
      throw err;
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
      await maybeMultiPageBrowse(page, clickedUrl, sessionLogger);
    }
    
    // Session duration honoring frontend inputs
    const minSec = sessionDurationMin || 30;
    const maxSec = sessionDurationMax || 120;
    const shouldBounce = (bounceRate || 0) > 0 && Math.random() < ((bounceRate || 0) / 100);
    const durationSec = shouldBounce ? Math.floor(5 + Math.random() * 5) : Math.floor(minSec + Math.random() * (maxSec - minSec));
    lastPlannedDurationSec = durationSec;
    await new Promise(r => setTimeout(r, durationSec * 1000));
    
    const actualDurationSec = Math.round((Date.now() - sessionStartMs) / 1000);
    bandwidthTracker.report(clickedUrl, actualDurationSec);
    console.log('[SESSION] ✓ Completed successfully');
    const logs = sessionLogger.getLogs();
    return { success: true, sessionId, clickedUrl, targetUrl: clickedUrl, logs, bandwidthBytes: bandwidthTracker.getTotalBytes(), actualDurationSec };
    
  } catch (error) {
    sessionLogger.error('SESSION', error.message);
    console.error('[ERROR]', error.message);
    throw error; // Re-throw for job queue to catch
  } finally {
    // CRITICAL CLEANUP: Always close browser
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        console.log('[CLEANUP] Browser close error:', err.message);
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
// QUEUE-BASED ENDPOINTS
// ════════════════════════════════════════════════════════════════════════

// Submit job to queue (returns immediately with jobId)
app.post('/api/automate', async (req, res) => {
  const jobId = genJobId();
  JOBS.set(jobId, { status: 'queued', createdAt: Date.now(), sessionId: jobId });
  QUEUE.push({ jobId, payload: req.body });
  console.log(`[QUEUE] Job ${jobId} queued (${QUEUE.length} in queue, ${activeSessionCount}/${MAX_CONCURRENT_SESSIONS} active)`);
  runQueue(); // Try to start immediately if slot available
  
  return res.status(202).json({ accepted: true, jobId, status: 'queued', message: 'Job queued for processing' });
});

// Poll job status/result
app.get('/api/jobs/:jobId', (req, res) => {
  const job = JOBS.get(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json(job);
});

// Optional: cancel queued job
app.delete('/api/jobs/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const idx = QUEUE.findIndex(j => j.jobId === jobId);
  if (idx >= 0) {
    QUEUE.splice(idx, 1);
    JOBS.set(jobId, { status: 'cancelled', finishedAt: Date.now() });
    console.log(`[QUEUE] Job ${jobId} cancelled`);
    return res.json({ success: true, message: 'Job cancelled' });
  }
  res.status(409).json({ success: false, error: 'Job already running or finished' });
});

// Test headless: false compatibility for extensions
app.post('/api/test-headless', async (req, res) => {
  let browser;
  
  try {
    console.log('[HEADLESS TEST] Testing headless: false on this server...');
    console.log('[HEADLESS TEST] OS:', process.platform);
    console.log('[HEADLESS TEST] Display:', process.env.DISPLAY || 'NOT SET');
    
    // Try launching with headless: false
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ]
    });
    
    console.log('[HEADLESS TEST] ✓ Browser launched successfully with headless: false');
    
    const page = await browser.newPage();
    await page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 10000 });
    
    const title = await page.title();
    console.log('[HEADLESS TEST] Page loaded:', title);
    
    await browser.close();
    
    return res.json({
      success: true,
      message: 'headless: false works on this server!',
      display: process.env.DISPLAY || 'None (but works anyway)',
      platform: process.platform
    });
    
  } catch (error) {
    console.error('[HEADLESS TEST] ✗ Failed:', error.message);
    
    // Check if it's the DISPLAY error
    const isDisplayError = error.message.includes('DISPLAY') || 
                          error.message.includes('X11') ||
                          error.message.includes('cannot open display');
    
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    
    return res.status(500).json({
      success: false,
      error: error.message,
      needsXvfb: isDisplayError,
      platform: process.platform,
      display: process.env.DISPLAY || 'NOT SET',
      solution: isDisplayError ? 
        'Install Xvfb: sudo apt-get install -y xvfb && export DISPLAY=:99 && Xvfb :99 -screen 0 1920x1080x24 &' : 
        'Unknown error - check logs'
    });
  }
});

app.listen(3000, () => {
  console.log('✅ Server running on port 3000 - Browser API + Luna Proxy + SERP API');
  console.log('📊 Search Traffic: Browser API (auto-CAPTCHA solving)');
  console.log('🔄 Direct Traffic: Luna Proxy (cost-effective)');
});

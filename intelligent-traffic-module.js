/**
 * Intelligent Traffic Module
 * Provides advanced traffic generation with:
 * - Site structure analysis (on first visit in debug mode)
 * - Bounce rate enforcement
 * - Intelligent navigation (multi-page with analysis)
 * - Debug-mode bandwidth tracking (zero production overhead)
 */

// ════════════════════════════════════════════════════════════════════════
// 1. ANALYZE SITE STRUCTURE (on first visit, debug mode only)
// ════════════════════════════════════════════════════════════════════════
async function analyzeSiteStructure(page, url, sessionLogger) {
  try {
    sessionLogger.log('ANALYSIS', 'Starting intelligent site analysis...', 'info');
    
    const analysis = await page.evaluate(() => {
      // Find navigation links
      const navLinks = [];
      const selectors = [
        'a[href]:not([href^="#"])',
        'a[href*="page"], a[href*="post"], a[href*="article"]',
        '[role="navigation"] a',
        'nav a',
        '.nav a',
        '.menu a'
      ];
      
      const linkSet = new Set();
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const href = el.getAttribute('href');
            const text = el.textContent.trim().substring(0, 50);
            if (href && href.startsWith('http')) {
              const key = `${href}|||${text}`;
              if (!linkSet.has(key) && linkSet.size < 15) {
                linkSet.add(key);
                navLinks.push({ href, text, selector: el.className || el.id || el.tagName });
              }
            }
          }
        } catch (e) {
          // Skip selector errors
        }
      }
      
      // Find forms
      const forms = [];
      const formElements = document.querySelectorAll('form');
      for (let i = 0; i < Math.min(formElements.length, 5); i++) {
        const form = formElements[i];
        const inputs = form.querySelectorAll('input[type="text"], textarea');
        forms.push({
          id: form.id,
          className: form.className,
          inputCount: inputs.length,
          action: form.action
        });
      }
      
      // Find content areas
      const contentAreas = [];
      const selectors_content = [
        'article', 'main', '[role="main"]', '.content', '.post', '.entry',
        '[class*="article"]', '[class*="post"]', '[class*="content"]'
      ];
      
      for (const selector of selectors_content) {
        try {
          const elements = document.querySelectorAll(selector);
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            const text = elements[i].textContent.substring(0, 100);
            contentAreas.push({ selector, textLength: text.length, className: elements[i].className });
          }
        } catch (e) {
          // Skip
        }
      }
      
      // Get page metadata
      const title = document.title;
      const description = document.querySelector('meta[name="description"]')?.content || '';
      const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim().substring(0, 50));
      
      return {
        title,
        description,
        h1s,
        navLinks: navLinks.slice(0, 10),
        forms,
        contentAreas,
        pageHeight: document.documentElement.scrollHeight,
        pageWidth: document.documentElement.scrollWidth
      };
    });
    
    sessionLogger.log('ANALYSIS', `Found ${analysis.navLinks.length} nav links, ${analysis.forms.length} forms, ${analysis.contentAreas.length} content areas`, 'success');
    return analysis;
  } catch (err) {
    sessionLogger.warning('ANALYSIS', `Site analysis failed: ${err.message}`);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════
// 2. BOUNCE RATE ENFORCEMENT
// ════════════════════════════════════════════════════════════════════════
function shouldBounce(bounceRate) {
  // bounceRate is a percentage (0-100)
  // Return true if this session should bounce (skip navigation)
  if (!bounceRate || bounceRate <= 0) return false;
  const randomPercent = Math.random() * 100;
  return randomPercent < bounceRate;
}

// ════════════════════════════════════════════════════════════════════════
// 3. INTELLIGENT MULTI-PAGE NAVIGATION
// ════════════════════════════════════════════════════════════════════════
async function intelligentNavigate(page, siteAnalysis, bounceRate, minPages, maxPages, sessionLogger, preMapdSiteStructure = null) {
  try {
    // Always scroll a bit on the current page
    const scrolls = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < scrolls; i++) {
      try {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
      } catch (err) {
        sessionLogger.warning('BEHAVIOR', `Scroll failed: ${err.message}`);
      }
    }
    
    // Check if should bounce
    if (shouldBounce(bounceRate)) {
      sessionLogger.log('BEHAVIOR', `Bounce triggered (${bounceRate}% bounce rate) - skipping navigation`, 'info');
      return;
    }
    
    sessionLogger.log('BEHAVIOR', 'Starting intelligent multi-page navigation', 'info');
    
    const pagesToVisit = minPages + Math.floor(Math.random() * (maxPages - minPages + 1));
    sessionLogger.log('BEHAVIOR', `Will visit ${pagesToVisit} total pages (min: ${minPages}, max: ${maxPages})`, 'info');
    
    // Use pre-mapped site structure if available
    const navPages = preMapdSiteStructure?.navigablePages || (siteAnalysis?.navLinks || []);
    
    if (preMapdSiteStructure && preMapdSiteStructure.navigablePages && preMapdSiteStructure.navigablePages.length > 0) {
      sessionLogger.log('BEHAVIOR', `Using pre-mapped site structure with ${preMapdSiteStructure.navigablePages.length} pages`, 'info');
      
      for (let i = 0; i < pagesToVisit - 1; i++) {
        try {
          const randomPage = preMapdSiteStructure.navigablePages[Math.floor(Math.random() * preMapdSiteStructure.navigablePages.length)];
          sessionLogger.log('NAVIGATION', `Navigating to: ${randomPage}`, 'info');
          await page.goto(randomPage, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          // Random think time
          const thinkTime = 3000 + Math.random() * 7000;
          await new Promise(r => setTimeout(r, thinkTime));
          
          // Random scroll
          if (Math.random() > 0.3) {
            await page.evaluate(() => window.scrollBy(0, window.innerHeight / 3));
            await new Promise(r => setTimeout(r, 500 + Math.random() * 1500));
          }
        } catch (err) {
          sessionLogger.warning('NAVIGATION', `Failed to navigate: ${err.message}`);
          break;
        }
      }
    } else if (siteAnalysis && siteAnalysis.navLinks && siteAnalysis.navLinks.length > 0) {
      sessionLogger.log('BEHAVIOR', 'Using intelligent link selection from site analysis', 'info');
      
      for (let i = 0; i < pagesToVisit - 1; i++) {
        try {
          // Prefer links with keywords (page, post, article, category, etc.)
          const weightedLinks = siteAnalysis.navLinks.map(link => ({
            ...link,
            weight: (
              (link.text.toLowerCase().includes('page') ? 3 : 0) +
              (link.text.toLowerCase().includes('post') ? 3 : 0) +
              (link.text.toLowerCase().includes('article') ? 3 : 0) +
              (link.text.toLowerCase().includes('category') ? 2 : 0) +
              (link.text.toLowerCase().includes('blog') ? 2 : 0) +
              1
            )
          }));
          
          // Weighted random selection
          const totalWeight = weightedLinks.reduce((sum, link) => sum + link.weight, 0);
          let random = Math.random() * totalWeight;
          let selectedLink = weightedLinks[0];
          
          for (const link of weightedLinks) {
            random -= link.weight;
            if (random <= 0) {
              selectedLink = link;
              break;
            }
          }
          
          sessionLogger.log('BEHAVIOR', `Navigating to: ${selectedLink.text.substring(0, 50)} (${selectedLink.href.substring(0, 60)})`, 'info');
          
          try {
            await page.goto(selectedLink.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000)); // 2-5s delay
          } catch (navErr) {
            sessionLogger.warning('BEHAVIOR', `Navigation to ${selectedLink.href.substring(0, 50)} failed: ${navErr.message}`);
          }
        } catch (err) {
          sessionLogger.warning('BEHAVIOR', `Link selection error: ${err.message}`);
          break;
        }
      }
    }
    } else {
      // Fallback: random browsing (original behavior)
      sessionLogger.log('BEHAVIOR', 'No site analysis available - using random browsing', 'info');
      
      for (let i = 0; i < pagesToVisit - 1; i++) {
        try {
          const links = await page.$$eval('a[href]:not([href^="#"])', elements => 
            elements
              .filter(el => {
                const href = el.getAttribute('href');
                return href && href.startsWith('http');
              })
              .map(el => ({ href: el.getAttribute('href'), text: el.textContent.trim() }))
              .slice(0, 20)
          );
          
          if (links.length === 0) {
            sessionLogger.warning('BEHAVIOR', 'No clickable links found on page');
            break;
          }
          
          const randomLink = links[Math.floor(Math.random() * links.length)];
          sessionLogger.log('BEHAVIOR', `Random click: ${randomLink.text.substring(0, 50)}`, 'info');
          
          try {
            await page.goto(randomLink.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
          } catch (navErr) {
            sessionLogger.warning('BEHAVIOR', `Navigation failed: ${navErr.message}`);
          }
        } catch (err) {
          sessionLogger.warning('BEHAVIOR', `Random click error: ${err.message}`);
          break;
        }
      }
    }
    
    sessionLogger.log('BEHAVIOR', `Multi-page navigation completed (${pagesToVisit} pages)`, 'success');
  } catch (err) {
    sessionLogger.warning('BEHAVIOR', `Intelligent navigation error: ${err.message}`);
  }
}

// ════════════════════════════════════════════════════════════════════════
// 4. DEBUG-MODE BANDWIDTH TRACKER (zero production overhead)
// ════════════════════════════════════════════════════════════════════════
function createDebugBandwidthTracker(sessionLogger, debugMode) {
  let totalBytes = 0;
  let responseCount = 0;
  let pageReferences = new WeakMap();
  
  return {
    attachToPage(page) {
      // Only attach if debug mode is enabled
      if (!debugMode) return;
      
      try {
        page.on('response', (response) => {
          try {
            const headers = response.headers();
            const len = headers['content-length'] || headers['Content-Length'];
            if (len) {
              const bytes = parseInt(len, 10);
              if (!isNaN(bytes)) {
                totalBytes += bytes;
                responseCount++;
              }
            }
          } catch (e) {
            // Ignore response tracking errors
          }
        });
        
        pageReferences.set(page, true);
        if (debugMode) {
          sessionLogger.log('DEBUG', `Bandwidth tracking attached (debug mode enabled)`, 'info');
        }
      } catch (e) {
        // Silently skip if tracking fails
      }
    },
    
    report(url, durationSec) {
      if (!debugMode) {
        // Production mode: zero overhead return
        return { success: true, bandwidth: 0, debugMode: false };
      }
      
      // Debug mode: return tracking data
      const totalKB = (totalBytes / 1024).toFixed(2);
      const avgKBPerSec = (totalBytes / 1024 / Math.max(1, durationSec)).toFixed(2);
      
      const report = {
        url,
        bandwidthBytes: totalBytes,
        bandwidthKB: totalKB,
        responseCount,
        durationSec,
        avgKBPerSec,
        estimatedMonthly: ((totalBytes / 1024) * 100).toFixed(1) // For 100 sessions
      };
      
      if (debugMode) {
        sessionLogger.log('DEBUG', `Bandwidth Report: ${totalKB}KB over ${durationSec}s (${avgKBPerSec}KB/s, ${responseCount} responses)`, 'success');
      }
      
      return report;
    },
    
    getTotalBytes() {
      return totalBytes;
    }
  };
}

// ════════════════════════════════════════════════════════════════════════
// 5. ULTRA-LEAN 10KB RESOURCE GUARDS
// ════════════════════════════════════════════════════════════════════════
function initUltra10KBGuards(page, mainHost) {
  const BANDWIDTH_LIMIT = 10 * 1024; // 10KB ultra-lean limit
  let totalBytes = 0;
  let limitReached = false;
  
  // Only analytics hosts (minimal set)
  const analyticsHosts = [
    'google-analytics.com', 'www.google-analytics.com', 'ssl.google-analytics.com',
    'googletagmanager.com', 'www.googletagmanager.com',
    'analytics.google.com', 'www.google.com'
  ];
  
  const isAnalytics = (url) => {
    try {
      const u = new URL(url);
      return analyticsHosts.some(h => u.hostname.includes(h));
    } catch {
      return false;
    }
  };
  
  // Track bandwidth
  page.on('response', (response) => {
    if (limitReached) return;
    try {
      const headers = response.headers();
      const len = headers['content-length'] || headers['Content-Length'];
      if (len) {
        const bytes = parseInt(len, 10);
        if (!isNaN(bytes)) {
          totalBytes += bytes;
          if (totalBytes > BANDWIDTH_LIMIT) {
            limitReached = true;
            console.log(`[ULTRA 10KB] 10KB hard limit exceeded (${totalBytes} bytes)`);
          }
        }
      }
    } catch {}
  });
  
  page.setRequestInterception(true).catch(() => {});
  page.on('request', (req) => {
    try {
      const url = req.url();
      const type = req.resourceType();
      
      // Allow extension:// URLs
      if (url.startsWith('extension://') || url.startsWith('chrome-extension://')) {
        return req.continue();
      }
      
      // Allow document + navigation
      if (req.isNavigationRequest() || type === 'document') return req.continue();
      
      // Block almost everything
      if (type === 'image' || type === 'media' || type === 'font' || type === 'stylesheet' || type === 'xhr') {
        return req.abort();
      }
      
      // If bandwidth limit reached, block everything
      if (limitReached) return req.abort();
      
      // Allow only GA scripts (ultra-minimal)
      if (type === 'script') {
        if (isAnalytics(url) && (url.includes('gtag') || url.includes('analytics.js') || url.includes('gtm.js'))) {
          return req.continue();
        }
        return req.abort();
      }
      
      // Allow GA beacons only
      if (type === 'fetch') {
        if (isAnalytics(url)) return req.continue();
        return req.abort();
      }
      
      return req.abort();
    } catch {
      try { req.continue(); } catch {}
    }
  });
}

module.exports = {
  analyzeSiteStructure,
  shouldBounce,
  intelligentNavigate,
  createDebugBandwidthTracker,
  initUltra10KBGuards
};

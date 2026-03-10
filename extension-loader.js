const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSIONS_DIR = path.join(__dirname, 'extensions');

// Ensure extensions directory exists
if (!fs.existsSync(EXTENSIONS_DIR)) {
  fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
}

// In-process cache + de-dupe for concurrent downloads
const extensionPathCache = new Map();
const inFlightDownloads = new Map();

function normalizeExtensionId(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();

  // If value is a Chrome Web Store URL, extract id from /detail/.../<id>
  const urlMatch = trimmed.match(/\/detail\/(?:[^/]+\/)?([a-z]{32})(?:[/?#]|$)/i);
  if (urlMatch && urlMatch[1]) return urlMatch[1].toLowerCase();

  // If already an id (32 lowercase chars), accept as-is
  const idMatch = trimmed.match(/^([a-z]{32})$/i);
  if (idMatch && idMatch[1]) return idMatch[1].toLowerCase();

  // Fallback to original (legacy behavior)
  return trimmed;
}

/**
 * Download and unpack Chrome extension by ID
 * @param {string} extensionId - Chrome Web Store extension ID
 * @returns {Promise<string>} Path to unpacked extension
 */
async function getExtensionPath(extensionId) {
  const normalizedId = normalizeExtensionId(extensionId);
  if (!normalizedId) {
    throw new Error('Invalid extension ID');
  }

  const extensionDir = path.join(EXTENSIONS_DIR, normalizedId);

  // Fast in-memory cache
  if (extensionPathCache.has(normalizedId)) {
    return extensionPathCache.get(normalizedId);
  }

  // De-dupe concurrent requests for same extension
  if (inFlightDownloads.has(normalizedId)) {
    return inFlightDownloads.get(normalizedId);
  }

  const work = (async () => {
  
  // Check if already downloaded
    if (fs.existsSync(extensionDir) && fs.readdirSync(extensionDir).length > 0) {
      console.log(`[EXTENSION] Using cached extension: ${normalizedId}`);
      extensionPathCache.set(normalizedId, extensionDir);
      return extensionDir;
    }
  
    console.log(`[EXTENSION] Downloading extension: ${normalizedId}`);
  
  // Create extension directory
  if (!fs.existsSync(extensionDir)) {
    fs.mkdirSync(extensionDir, { recursive: true });
  }
  
    const crxPath = path.join(EXTENSIONS_DIR, `${normalizedId}.crx`);
  
  // Download CRX from Chrome Web Store
    const downloadUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0.0.0&acceptformat=crx2,crx3&x=id%3D${normalizedId}%26uc`;
  
    await downloadFile(downloadUrl, crxPath);
  
    console.log(`[EXTENSION] Downloaded CRX to: ${crxPath}`);
  
  // Unpack CRX using unzip (CRX is essentially a ZIP with header)
    try {
      execSync(`unzip -o "${crxPath}" -d "${extensionDir}"`);
      console.log(`[EXTENSION] Unpacked extension to: ${extensionDir}`);
    
    // Clean up CRX file - with proper error handling
      try {
        if (fs.existsSync(crxPath)) {
          fs.unlinkSync(crxPath);
          console.log(`[EXTENSION] Cleaned up CRX file: ${crxPath}`);
        } else {
          console.log(`[EXTENSION] CRX file already removed`);
        }
      } catch (unlinkErr) {
        console.log(`[EXTENSION] Warning: Could not delete CRX file: ${unlinkErr.message}`);
        // Continue anyway - extension is successfully unpacked
      }
    
      extensionPathCache.set(normalizedId, extensionDir);
      return extensionDir;
    } catch (error) {
      console.error(`[EXTENSION] Failed to unpack: ${error.message}`);
      throw error;
    }
  })();

  inFlightDownloads.set(normalizedId, work);
  try {
    return await work;
  } finally {
    inFlightDownloads.delete(normalizedId);
  }
}

/**
 * Download file from URL
 * @param {string} url - URL to download from
 * @param {string} dest - Destination file path
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      // Follow redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete partial file
      reject(err);
    });
  });
}

module.exports = { getExtensionPath };

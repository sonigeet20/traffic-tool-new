const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSIONS_DIR = path.join(__dirname, 'extensions');

// Ensure extensions directory exists
if (!fs.existsSync(EXTENSIONS_DIR)) {
  fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
}

/**
 * Download and unpack Chrome extension by ID
 * @param {string} extensionId - Chrome Web Store extension ID
 * @returns {Promise<string>} Path to unpacked extension
 */
async function getExtensionPath(extensionId) {
  const extensionDir = path.join(EXTENSIONS_DIR, extensionId);
  
  // Check if already downloaded
  if (fs.existsSync(extensionDir) && fs.readdirSync(extensionDir).length > 0) {
    console.log(`[EXTENSION] Using cached extension: ${extensionId}`);
    return extensionDir;
  }
  
  console.log(`[EXTENSION] Downloading extension: ${extensionId}`);
  
  // Create extension directory
  if (!fs.existsSync(extensionDir)) {
    fs.mkdirSync(extensionDir, { recursive: true });
  }
  
  const crxPath = path.join(EXTENSIONS_DIR, `${extensionId}.crx`);
  
  // Download CRX from Chrome Web Store
  const downloadUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0.0.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;
  
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
    
    return extensionDir;
  } catch (error) {
    console.error(`[EXTENSION] Failed to unpack: ${error.message}`);
    throw error;
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

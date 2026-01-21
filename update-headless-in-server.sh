#!/bin/bash
# Update server.js to use headless: false now that we have Xvfb
set -e

SERVER_FILE="/home/ubuntu/puppeteer-server/server.js"

if [ ! -f "$SERVER_FILE" ]; then
  echo "❌ Server file not found at $SERVER_FILE"
  exit 1
fi

echo "📝 Updating server.js to use headless: false..."

# Backup original
cp "$SERVER_FILE" "$SERVER_FILE.backup-$(date +%Y%m%d-%H%M%S)"

# Replace all headless: true with headless: false
sed -i 's/headless: true/headless: false/g' "$SERVER_FILE"

echo "✅ Updated all headless: true to headless: false"

# Restart pm2
echo "🔄 Restarting pm2..."
pm2 restart server

echo "✅ Server updated and restarted!"
pm2 logs server --lines 20

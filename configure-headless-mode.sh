#!/bin/bash
# Configure headless mode for puppeteer-server
# Usage: ./configure-headless-mode.sh [true|false|new]
#
# Modes:
#   true  - Traditional headless mode (default, works everywhere, supports extensions)
#   false - Headed mode (requires Xvfb/X11, best anti-detection but can be unstable)
#   new   - New headless mode (Chrome 112+, best of both worlds, supports extensions)

MODE="${1:-true}"

if [ "$MODE" != "true" ] && [ "$MODE" != "false" ] && [ "$MODE" != "new" ]; then
  echo "❌ Invalid mode: $MODE"
  echo "Usage: $0 [true|false|new]"
  exit 1
fi

echo "🔧 Configuring HEADLESS_MODE=$MODE"

# Update pm2 ecosystem config
ECOSYSTEM_FILE="/home/ubuntu/puppeteer-server/ecosystem.config.js"
if [ -f "$ECOSYSTEM_FILE" ]; then
  # Update or add HEADLESS_MODE env var
  if grep -q "HEADLESS_MODE" "$ECOSYSTEM_FILE"; then
    sed -i "s/HEADLESS_MODE: '[^']*'/HEADLESS_MODE: '$MODE'/g" "$ECOSYSTEM_FILE"
    echo "✅ Updated HEADLESS_MODE in $ECOSYSTEM_FILE"
  else
    echo "⚠️  HEADLESS_MODE not found in ecosystem.config.js"
    echo "   Add manually: HEADLESS_MODE: '$MODE' to env section"
  fi
fi

# Restart pm2 with new environment
echo "🔄 Restarting pm2 with HEADLESS_MODE=$MODE..."
cd /home/ubuntu/puppeteer-server
HEADLESS_MODE=$MODE pm2 restart server --update-env

echo "✅ Configuration complete!"
echo ""
echo "📊 Current mode: HEADLESS_MODE=$MODE"
echo ""
echo "Mode descriptions:"
echo "  true  = Traditional headless (stable, works everywhere)"
echo "  false = Headed mode (requires Xvfb, can have startup issues)"
echo "  new   = New headless (Chrome 112+, recommended for extensions)"

#!/bin/bash
# Deploy headful browser configuration to running instances
# Run this script on each EC2 instance via SSM or SSH

set -e

echo "🚀 Deploying headful browser configuration..."

# Install Xvfb if not present
if ! command -v Xvfb &> /dev/null; then
    echo "📦 Installing Xvfb..."
    sudo apt-get update -qq
    sudo apt-get install -y xvfb
fi

# Stop existing pm2 processes
echo "🛑 Stopping existing pm2 processes..."
pm2 stop all || true
pm2 delete all || true

# Kill any existing Xvfb on :99 and clean lock files
pkill -f "Xvfb :99" || true
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 || true
sleep 3

# Start Xvfb
echo "🖥️  Starting Xvfb on display :99..."
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
export DISPLAY=:99
sleep 3

# Navigate to app directory
APP_DIR="/home/ubuntu/puppeteer-server"
if [ ! -d "$APP_DIR" ]; then
    echo "❌ Directory $APP_DIR not found"
    exit 1
fi
cd "$APP_DIR"

# No git pull needed - code already deployed via other means
echo "📦 Using existing code in $APP_DIR..."

# Install dependencies if needed
if [ -f "package.json" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Start with pm2 and set DISPLAY
echo "▶️  Starting app with DISPLAY=:99..."
DISPLAY=:99 pm2 start server.js --name server --update-env

# Configure pm2 startup
echo "💾 Configuring pm2 startup..."
pm2 startup systemd -u $USER --hp $HOME || true
pm2 save

# Verify
echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔍 Verification:"
ps aux | grep Xvfb | grep -v grep && echo "  ✓ Xvfb running on :99"
pm2 list
echo ""
echo "📊 Monitor with: pm2 logs app"
echo "🔄 Restart with: pm2 restart app"

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

# Kill any existing Xvfb on :99
pkill -f "Xvfb :99" || true
sleep 2

# Start Xvfb
echo "🖥️  Starting Xvfb on display :99..."
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
sleep 3

# Navigate to app directory
cd /opt/traffic-tool || cd /home/ubuntu/traffic-tool || cd ~/traffic-tool

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main || git pull

# Install dependencies if needed
if [ -f "package.json" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Start with pm2 and set DISPLAY
echo "▶️  Starting app with DISPLAY=:99..."
DISPLAY=:99 pm2 start server.cjs --name app --interpreter node

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

#!/bin/bash
# Start Xvfb and server with DISPLAY environment variable set
# This enables headful Puppeteer browser launches

# Start Xvfb in background
echo "Starting Xvfb display server..."
Xvfb :99 -screen 0 1920x1080x24 &
XVFB_PID=$!
export DISPLAY=:99

# Wait for Xvfb to be ready
sleep 2

# Start server with pm2, setting DISPLAY for all instances
echo "Starting server with pm2 (DISPLAY=:99)..."
pm2 start server.cjs --name app --interpreter node

# Save pm2 config to resurrect on reboot
pm2 startup
pm2 save

echo "✅ Server started with DISPLAY=:99"
echo "📊 Monitor with: pm2 monit"

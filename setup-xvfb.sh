#!/bin/bash
# Setup Xvfb for running Chrome with extensions

# Resolve server directory flexibly
SERVER_DIR="${SERVER_DIR:-/home/ubuntu/puppeteer-server}"
if [ ! -f "$SERVER_DIR/server.js" ]; then
	SERVER_DIR="$PWD"
fi
mkdir -p "$SERVER_DIR"

echo "Installing Xvfb..."
sudo apt-get update
sudo apt-get install -y xvfb

echo "Creating Xvfb startup script..."
cat > "$SERVER_DIR/start-with-xvfb.sh" << 'EOF'
#!/bin/bash
export DISPLAY=:99
Xvfb :99 -screen 0 1920x1080x24 > /dev/null 2>&1 &
sleep 2
node "$SERVER_DIR/server.js"
EOF

chmod +x "$SERVER_DIR/start-with-xvfb.sh"

echo "Updating PM2 to use Xvfb..."
pm2 delete server 2>/dev/null || true
pm2 start "$SERVER_DIR/start-with-xvfb.sh" --name server --log "$SERVER_DIR/logs.txt"
pm2 save

echo "Done! Server restarted with Xvfb support"
pm2 status

#!/bin/bash
# Xvfb Setup Script for AWS EC2
# This allows headless: false to work for Chrome extensions

echo "=========================================="
echo "Installing Xvfb (Virtual Display) on AWS"
echo "=========================================="

# Update package list
echo "Updating package list..."
sudo apt-get update -y

# Install Xvfb
echo "Installing Xvfb..."
sudo apt-get install -y xvfb

# Verify installation
if command -v Xvfb &> /dev/null; then
    echo "✓ Xvfb installed successfully"
else
    echo "✗ Xvfb installation failed"
    exit 1
fi

# Create systemd service for Xvfb (auto-start on boot)
echo "Creating systemd service..."
sudo tee /etc/systemd/system/xvfb.service > /dev/null <<EOF
[Unit]
Description=X Virtual Frame Buffer Service
After=network.target

[Service]
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24
Restart=always
User=ubuntu
Environment=DISPLAY=:99

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd, enable and start service
echo "Enabling Xvfb service..."
sudo systemctl daemon-reload
sudo systemctl enable xvfb
sudo systemctl start xvfb

# Check status
sleep 2
if sudo systemctl is-active --quiet xvfb; then
    echo "✓ Xvfb service is running"
else
    echo "✗ Xvfb service failed to start"
    sudo systemctl status xvfb
    exit 1
fi

# Add DISPLAY to environment for current user
echo "Configuring environment..."
if ! grep -q "export DISPLAY=:99" ~/.bashrc; then
    echo "export DISPLAY=:99" >> ~/.bashrc
    echo "✓ Added DISPLAY to ~/.bashrc"
fi

# Export for current session
export DISPLAY=:99

echo ""
echo "=========================================="
echo "✓ Xvfb Setup Complete!"
echo "=========================================="
echo ""
echo "Display: :99"
echo "Status: $(sudo systemctl is-active xvfb)"
echo ""
echo "Next steps:"
echo "1. Restart your Node.js server:"
echo "   pkill -f 'node server.cjs'"
echo "   DISPLAY=:99 node server.cjs &"
echo ""
echo "2. Test again:"
echo "   curl -X POST http://localhost:3000/api/test-headless"
echo ""
echo "=========================================="

#!/bin/bash
# AWS User Data script for new EC2 instances
# Add this to Launch Template or EC2 instance user data

# Wait for instance to be ready
sleep 30

# Install dependencies
apt-get update -qq
apt-get install -y xvfb git nodejs npm

# Install pm2 globally
npm install -g pm2

# Clone or pull repository (adjust path/repo as needed)
cd /opt
if [ ! -d "traffic-tool" ]; then
    git clone https://github.com/geet-sketch/traffic-tool.git
fi
cd traffic-tool
git pull origin main

# Install app dependencies
npm install --production

# Start Xvfb
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
sleep 3

# Start app with pm2
DISPLAY=:99 pm2 start server.cjs --name app --interpreter node

# Configure pm2 to start on boot
env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save

# Set DISPLAY environment variable system-wide
echo "export DISPLAY=:99" >> /etc/environment
echo "DISPLAY=:99" >> /etc/systemd/system.conf

echo "✅ Instance configured for headful browser sessions"

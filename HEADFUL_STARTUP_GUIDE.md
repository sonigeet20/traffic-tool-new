# PM2 Startup Configuration for Headful Browser Sessions

## Quick Start

```bash
# Make script executable
chmod +x start-with-display.sh

# Start server with DISPLAY support
./start-with-display.sh
```

## What This Does

1. **Starts Xvfb** (virtual X display) on `:99`
2. **Sets DISPLAY=:99** environment variable
3. **Launches server** with pm2 in that display context
4. **Auto-resurrects** on server reboot

## For New AMI Instances

When launching new EC2 instances from this AMI:

### Option 1: User Data Script (Recommended)
```bash
#!/bin/bash
cd /opt/traffic-tool
export DISPLAY=:99
Xvfb :99 -screen 0 1920x1080x24 &
sleep 2
pm2 start server.cjs --name app --interpreter node
pm2 startup
pm2 save
```

### Option 2: SSM Parameter Store
Store this script in AWS Systems Manager Parameter Store and reference it from EC2 launch template.

### Option 3: Manual SSH
```bash
ssh -i your-key.pem ubuntu@<instance-ip>
cd /opt/traffic-tool
chmod +x start-with-display.sh
./start-with-display.sh
```

## Verify It's Running

```bash
# Check Xvfb
ps aux | grep Xvfb

# Check pm2
pm2 status

# Check environment
pm2 env app | grep DISPLAY
```

## Environment Variables in PM2

```bash
# Set DISPLAY for a running app
pm2 set pm2:env:app "DISPLAY=:99"

# Or set it when starting
DISPLAY=:99 pm2 start server.cjs --name app
```

## Troubleshooting

### Xvfb not found
```bash
sudo apt-get install -y xvfb
```

### Display already in use
```bash
# Find process using :99
lsof -i :99
# Kill it and try again
```

### Browser still fails to launch
```bash
# Check full logs
pm2 logs app
```

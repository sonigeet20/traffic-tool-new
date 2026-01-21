#!/bin/bash

# Update AWS instance with new code and Supabase credentials
# Run this script locally - it will SSH to the instance and update everything

INSTANCE_IP="98.80.137.133"
KEY_PATH="~/Downloads/browser-automation-key.pem"

echo "=== Updating AWS Instance ==="
echo "Instance: $INSTANCE_IP"
echo ""

# Create environment update script
cat > /tmp/update-env.sh << 'EOF'
#!/bin/bash
cd /home/ubuntu
echo "Current directory: $(pwd)"
echo "Listing files:"
ls -la

# Find where server.cjs is located
echo -e "\nSearching for server.cjs..."
SERVER_DIR=$(find /home/ubuntu -name "server.cjs" 2>/dev/null | head -1 | xargs dirname)

if [ -z "$SERVER_DIR" ]; then
    echo "ERROR: Could not find server.cjs"
    exit 1
fi

echo "Found server at: $SERVER_DIR"
cd "$SERVER_DIR"

# Update .env with new Supabase credentials
echo -e "\nUpdating .env file..."
cat > .env << 'ENVEOF'
VITE_SUPABASE_URL=https://pffapmqqswcmndlvkjrs.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODY3OTYsImV4cCI6MjA4NDU2Mjc5Nn0.oVibU3ip3oLVBK0ItBjCjQSZaa1Xi-R7ocmysuqNp2k
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4Njc5NiwiZXhwIjoyMDg0NTYyNzk2fQ.8sfPKQV8awv8tFR5fbBH0PCxrGa69x6ER-QEa-Hf7ak
ENVEOF

echo ".env file updated successfully"
echo -e "\nNew .env contents:"
cat .env

# If this is a git repository, pull latest code
if [ -d .git ]; then
    echo -e "\nPulling latest code from GitHub..."
    git pull origin main
else
    echo -e "\nNot a git repository, skipping code update"
fi

# Restart PM2
echo -e "\nRestarting PM2..."
pm2 restart all
echo -e "\nPM2 status:"
pm2 list

echo -e "\nUpdate complete!"
EOF

chmod +x /tmp/update-env.sh

# Copy script to instance and execute
echo "Copying update script to instance..."
scp -i $KEY_PATH -o StrictHostKeyChecking=no /tmp/update-env.sh ubuntu@$INSTANCE_IP:/tmp/

echo "Executing update script on instance..."
ssh -i $KEY_PATH -o StrictHostKeyChecking=no ubuntu@$INSTANCE_IP "bash /tmp/update-env.sh"

echo ""
echo "=== Update Complete ==="
echo "Frontend: Vercel will auto-deploy (check Vercel dashboard)"
echo "Backend: AWS instance updated with new Supabase URL"
echo "Database: Supabase project https://pffapmqqswcmndlvkjrs.supabase.co"

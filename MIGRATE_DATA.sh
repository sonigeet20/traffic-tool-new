#!/bin/bash

# Data Migration Script - OLD PROJECT TO NEW PROJECT
# Fill in your OLD project credentials below

echo "=== Supabase Data Migration Tool ==="
echo ""
echo "IMPORTANT: Please provide your OLD Supabase project credentials:"
echo ""

read -p "Enter OLD Supabase URL (e.g., https://xrqobmncpllhkjjorjul.supabase.co): " OLD_URL
read -p "Enter OLD Supabase ANON_KEY: " OLD_KEY

NEW_URL="https://pffapmqqswcmndlvkjrs.supabase.co"
NEW_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODY3OTYsImV4cCI6MjA4NDU2Mjc5Nn0.oVibU3ip3oLVBK0ItBjCjQSZaa1Xi-R7ocmysuqNp2k"

echo ""
echo "=== Starting Migration ==="
echo "Old project: $OLD_URL"
echo "New project: $NEW_URL"
echo ""

# Step 1: Export campaigns from old project
echo "1. Exporting campaigns from old project..."
curl -s -X GET "${OLD_URL}/rest/v1/campaigns?select=*" \
  -H "apikey: ${OLD_KEY}" \
  -H "Content-Type: application/json" > /tmp/old_campaigns.json

if grep -q "message.*Invalid\|message.*Unauthorized" /tmp/old_campaigns.json; then
  echo "   ❌ ERROR: Could not authenticate to old project"
  echo "   Please check your OLD_URL and OLD_KEY"
  exit 1
fi

CAMPAIGN_COUNT=$(jq 'if type == "array" then length else 0 end' /tmp/old_campaigns.json)
echo "   ✓ Found $CAMPAIGN_COUNT campaigns"

# Step 2: Import campaigns to new project
if [ "$CAMPAIGN_COUNT" -gt 0 ]; then
  echo "2. Importing campaigns to new project..."
  jq -c '.[]' /tmp/old_campaigns.json | while read -r campaign; do
    # Remove id to let new project generate it
    campaign_data=$(echo "$campaign" | jq 'del(.id)')
    
    response=$(curl -s -X POST "${NEW_URL}/rest/v1/campaigns" \
      -H "apikey: ${NEW_KEY}" \
      -H "Content-Type: application/json" \
      -d "$campaign_data")
    
    if echo "$response" | jq -e '.' > /dev/null 2>&1; then
      echo "   ✓ Imported campaign"
    else
      echo "   ⚠ Failed to import campaign"
    fi
  done
fi

# Step 3: Export settings from old project
echo ""
echo "3. Exporting settings (serp_configs) from old project..."
curl -s -X GET "${OLD_URL}/rest/v1/serp_configs?select=*" \
  -H "apikey: ${OLD_KEY}" \
  -H "Content-Type: application/json" > /tmp/old_settings.json

SETTINGS_COUNT=$(jq 'if type == "array" then length else 0 end' /tmp/old_settings.json)
echo "   ✓ Found $SETTINGS_COUNT settings"

# Step 4: Import settings to new project
if [ "$SETTINGS_COUNT" -gt 0 ]; then
  echo "4. Importing settings to new project..."
  jq -c '.[]' /tmp/old_settings.json | while read -r setting; do
    # Remove id to let new project generate it
    setting_data=$(echo "$setting" | jq 'del(.id)')
    
    response=$(curl -s -X POST "${NEW_URL}/rest/v1/serp_configs" \
      -H "apikey: ${NEW_KEY}" \
      -H "Content-Type: application/json" \
      -d "$setting_data")
    
    if echo "$response" | jq -e '.' > /dev/null 2>&1; then
      echo "   ✓ Imported setting"
    else
      echo "   ⚠ Failed to import setting"
    fi
  done
fi

# Step 5: Verify migration
echo ""
echo "=== Verification ==="
echo "5. Campaigns in new project:"
curl -s -X GET "${NEW_URL}/rest/v1/campaigns?select=id,name,user_id,target_url" \
  -H "apikey: ${NEW_KEY}" | jq '.[] | "\(.id) | \(.name) | \(.user_id)"' 2>/dev/null || echo "   No campaigns found"

echo ""
echo "6. Settings in new project:"
curl -s -X GET "${NEW_URL}/rest/v1/serp_configs?select=id,user_id,customer_id" \
  -H "apikey: ${NEW_KEY}" | jq '.[] | "\(.id) | \(.user_id)"' 2>/dev/null || echo "   No settings found"

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Temporary files:"
echo "  - /tmp/old_campaigns.json (campaigns from old project)"
echo "  - /tmp/old_settings.json (settings from old project)"

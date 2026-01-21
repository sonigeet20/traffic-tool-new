#!/bin/bash

echo "=========================================="
echo "CAMPAIGN EXECUTION DIAGNOSTIC"
echo "=========================================="
echo ""

echo "1. Checking Supabase campaigns..."
CAMPAIGNS=$(curl -s "https://pffapmqqswcmndlvkjrs.supabase.co/rest/v1/campaigns?select=id,name,status,total_sessions" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODY3OTYsImV4cCI6MjA4NDU2Mjc5Nn0.oVibU3ip3oLVBK0ItBjCjQSZaa1Xi-R7ocmysuqNp2k")
echo "$CAMPAIGNS" | jq .
echo ""

echo "2. Checking settings table..."
SETTINGS=$(curl -s "https://pffapmqqswcmndlvkjrs.supabase.co/rest/v1/settings?select=*" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODY3OTYsImV4cCI6MjA4NDU2Mjc5Nn0.oVibU3ip3oLVBK0ItBjCjQSZaa1Xi-R7ocmysuqNp2k")
echo "$SETTINGS" | jq .
echo ""

echo "3. Checking backend health..."
curl -s http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000/health | jq .
echo ""

echo "4. Checking bot sessions..."
SESSIONS=$(curl -s "https://pffapmqqswcmndlvkjrs.supabase.co/rest/v1/bot_sessions?select=id,status,created_at&order=created_at.desc&limit=5" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODY3OTYsImV4cCI6MjA4NDU2Mjc5Nn0.oVibU3ip3oLVBK0ItBjCjQSZaa1Xi-R7ocmysuqNp2k")
echo "$SESSIONS" | jq .
echo ""

echo "=========================================="
echo "ISSUES FOUND:"
echo "=========================================="

# Check if campaigns table has any records
CAMPAIGN_COUNT=$(echo "$CAMPAIGNS" | jq 'length')
if [ "$CAMPAIGN_COUNT" -eq 0 ]; then
  echo "❌ No campaigns found - create a campaign first"
else
  echo "✓ Found $CAMPAIGN_COUNT campaign(s)"
  
  # Check if any are active
  ACTIVE_COUNT=$(echo "$CAMPAIGNS" | jq '[.[] | select(.status == "active")] | length')
  if [ "$ACTIVE_COUNT" -eq 0 ]; then
    echo "❌ No active campaigns - click the Play button to start one"
  else
    echo "✓ Found $ACTIVE_COUNT active campaign(s)"
  fi
fi

# Check settings table
SETTINGS_COUNT=$(echo "$SETTINGS" | jq 'length')
if [ "$SETTINGS_COUNT" -eq 0 ]; then
  echo "⚠️  Settings table is empty (edge functions won't use it)"
  echo "   This is OK - hardcoded backend URL will be used"
else
  echo "✓ Settings table has $SETTINGS_COUNT record(s)"
fi

# Check bot sessions
SESSION_COUNT=$(echo "$SESSIONS" | jq 'length')
if [ "$SESSION_COUNT" -eq 0 ]; then
  echo "❌ No bot sessions created - campaigns not executing"
else
  echo "✓ Found $SESSION_COUNT recent session(s)"
fi

echo ""
echo "=========================================="
echo "NEXT STEPS:"
echo "=========================================="
echo "1. Make sure you have a campaign created"
echo "2. Click the Play/Start button on the campaign"
echo "3. Campaign status should change from 'draft' to 'active'"
echo "4. Wait 1-2 minutes and run this script again"
echo "5. You should see bot_sessions being created"
echo ""

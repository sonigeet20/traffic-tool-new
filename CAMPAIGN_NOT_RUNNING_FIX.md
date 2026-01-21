# Campaign Not Running - Root Cause Analysis

## Problem
Campaigns show as "active" but no bot sessions are executing.

## Root Cause
**The `settings` table is missing from the new Supabase project.**

This table is critical because:
- It stores the **backend endpoint URL** (AWS ALB address)
- The edge functions need this URL to trigger campaign execution on AWS
- Without it, campaigns can't communicate with the backend

## Impact
- ❌ Campaigns marked as "active" but never execute
- ❌ No bot sessions created
- ❌ No traffic generated
- ❌ Edge functions can't find backend endpoint

## Solution

### Step 1: Create the Settings Table

Go to Supabase SQL Editor and run the migration:
https://supabase.com/dashboard/project/pffapmqqswcmndlvkjrs/sql/new

SQL is in: `supabase/migrations/20260121000000_add_settings_table.sql`

Or run: `./APPLY_SETTINGS_MIGRATION.sh` for copy-paste instructions

### Step 2: Verify Table Creation

Check the table exists:
```sql
SELECT * FROM settings;
```

Should show:
- `backend_endpoint`: http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000
- `user_id`: Your user ID (3e9e81e7-c007-4ffa-a86a-e20e6968de8d)

### Step 3: Test Campaign Execution

1. Start a campaign from the dashboard
2. Check `bot_sessions` table for new rows
3. Monitor backend health: http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000/health

## Why This Happened

When we deployed the new Supabase project, we ran `COMPLETE_SCHEMA.sql` which didn't include the settings table. It was added later as a separate migration that never got applied.

## Prevention

Always run ALL migrations in order:
```bash
ls supabase/migrations/*.sql | sort | while read f; do
  echo "Applying: $f"
  # Apply via Supabase SQL Editor
done
```

## Next Steps

1. ✅ Apply settings table migration
2. Configure Luna Proxy credentials in Settings panel (optional)
3. Start campaign and verify bot sessions are created
4. Monitor AWS backend logs for activity

# Supabase Migration Guide - New Project

## Project Details
- **URL**: https://pffapmqqswcmndlvkjrs.supabase.co
- **Project ID**: pffapmqqswcmndlvkjrs
- **ANON KEY**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODY3OTYsImV4cCI6MjA4NDU2Mjc5Nn0.oVibU3ip3oLVBK0ItBjCjQSZaa1Xi-R7ocmysuqNp2k
- **SERVICE_ROLE_KEY**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4Njc5NiwiZXhwIjoyMDg0NTYyNzk2fQ.8sfPKQV8awv8tFR5fbBH0PCxrGa69x6ER-QEa-Hf7ak

## Steps to Deploy

### 1. Apply Database Schema

Go to: https://app.supabase.com → Select project → SQL Editor

Run these migrations:

#### Add site_structure columns to campaigns
```sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS site_structure JSONB;
CREATE INDEX IF NOT EXISTS idx_campaigns_site_structure ON campaigns USING GIN (site_structure);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS site_structure_traced_at TIMESTAMP;
COMMENT ON COLUMN campaigns.site_structure IS 'Pre-mapped website structure including navigable pages, forms, content areas, and internal links';
COMMENT ON COLUMN campaigns.site_structure_traced_at IS 'Timestamp when website structure was analyzed';
```

### 2. Deploy Edge Functions

All edge functions are located in `supabase/functions/`:

- `campaign-scheduler` - Schedules campaign execution
- `start-campaign` - Starts a campaign
- `test-puppeteer-connection` - Tests Puppeteer connection
- `update-session-tracking` - Updates session tracking
- `analyze-site-structure` - Analyzes website structure (NEW)

Deploy via CLI:
```bash
supabase functions deploy campaign-scheduler
supabase functions deploy start-campaign
supabase functions deploy test-puppeteer-connection
supabase functions deploy update-session-tracking
supabase functions deploy analyze-site-structure
```

Or manually in Supabase dashboard under "Edge Functions"

### 3. Verify .env is Updated

```
VITE_SUPABASE_URL=https://pffapmqqswcmndlvkjrs.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODY3OTYsImV4cCI6MjA4NDU2Mjc5Nn0.oVibU3ip3oLVBK0ItBjCjQSZaa1Xi-R7ocmysuqNp2k
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4Njc5NiwiZXhwIjoyMDg0NTYyNzk2fQ.8sfPKQV8awv8tFR5fbBH0PCxrGa69x6ER-QEa-Hf7ak
```

### 4. Next Steps

Once Supabase is migrated:
1. Deploy frontend to Vercel (auto-deploys on git push)
2. Update AWS instances with new Supabase URL
3. Run test campaigns to verify site structure tracing works

## Troubleshooting

If migrations fail:
1. Check that you're in the correct Supabase project
2. Verify all tables exist (campaigns, bot_sessions, etc.)
3. Use Supabase Dashboard to view table schema
4. Re-run migrations with IF NOT EXISTS clauses

## Status Checklist

- [ ] Supabase project linked in config.toml
- [ ] Database schema migrated (campaigns table + site_structure columns)
- [ ] Edge functions deployed
- [ ] .env updated with new credentials
- [ ] Frontend redeployed
- [ ] AWS instances updated
- [ ] Test campaign successful

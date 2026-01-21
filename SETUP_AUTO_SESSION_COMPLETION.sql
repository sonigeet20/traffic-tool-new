-- SETUP AUTOMATIC SESSION COMPLETION CHECKER
-- Run this in your Supabase SQL Editor

-- Step 1: Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 3: Create the cron job to run every 5 minutes
-- This will automatically mark sessions as "completed" if they've been running for more than 5 minutes
SELECT cron.schedule(
  'session-completion-checker',  -- Job name
  '*/5 * * * *',                  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://pffapmqqswcmndlvkjrs.supabase.co/functions/v1/session-completion-checker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4Njc5NiwiZXhwIjoyMDg0NTYyNzk2fQ.8sfPKQV8awv8tFR5fbBH0PCxrGa69x6ER-QEa-Hf7ak'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Step 4: Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'session-completion-checker';

-- To unschedule the job (if needed):
-- SELECT cron.unschedule('session-completion-checker');

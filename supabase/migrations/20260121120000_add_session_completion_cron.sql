-- Add pg_cron extension if not exists
create extension if not exists pg_cron;

-- Create a cron job to check and complete stale sessions every 5 minutes
select cron.schedule(
  'session-completion-checker',
  '*/5 * * * *', -- Every 5 minutes
  $$
  select
    net.http_post(
      url:='https://pffapmqqswcmndlvkjrs.supabase.co/functions/v1/session-completion-checker',
      headers:=format('{"Content-Type": "application/json", "Authorization": "Bearer %s"}', current_setting('app.settings.service_role_key'))::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

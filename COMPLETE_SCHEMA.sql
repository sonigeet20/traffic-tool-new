-- Add Luna headful direct option to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS use_luna_headful_direct BOOLEAN DEFAULT FALSE;

-- Add comment for clarity
COMMENT ON COLUMN campaigns.use_luna_headful_direct IS 'Enable Luna proxy headful direct mode (Option 2 - Direct traffic with extension support)';

-- Add session logs table for storing detailed logs
CREATE TABLE IF NOT EXISTS session_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  log_entries JSONB NOT NULL, -- Array of log entries
  total_logs INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_session_logs_campaign_id ON session_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_session_id ON session_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON session_logs(created_at DESC);

-- Add table comment
COMMENT ON TABLE session_logs IS 'Detailed logs for each automation session for debugging and monitoring';
/*
  # Add Geo Location, Proxy, and Distribution Settings to Campaigns

  1. Changes to campaigns table
    - Add `target_geo_locations` (jsonb array) - list of target countries/regions (e.g., ["US", "UK", "CA"])
    - Add `use_residential_proxies` (boolean) - whether to use residential proxies
    - Add `proxy_provider` (text) - proxy provider name/settings
    - Add `total_users` (integer) - total number of users/sessions to simulate
    - Add `distribution_period_hours` (integer) - time period in hours for user distribution
    - Add `distribution_pattern` (text) - pattern type: 'uniform', 'spike', 'gradual_increase', 'random'
    - Add `sessions_per_hour` (integer) - calculated field for distribution rate

  2. Notes
    - Geo locations stored as JSON array for flexibility
    - Distribution logic will be handled by edge function
    - Proxy settings for future integration with proxy providers
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'target_geo_locations'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN target_geo_locations jsonb DEFAULT '["US"]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'use_residential_proxies'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN use_residential_proxies boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'proxy_provider'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN proxy_provider text DEFAULT 'default';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'total_users'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN total_users integer DEFAULT 100;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'distribution_period_hours'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN distribution_period_hours integer DEFAULT 24;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'distribution_pattern'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN distribution_pattern text DEFAULT 'uniform';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'sessions_per_hour'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN sessions_per_hour numeric DEFAULT 4.17;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_sessions' AND column_name = 'geo_location'
  ) THEN
    ALTER TABLE bot_sessions ADD COLUMN geo_location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_sessions' AND column_name = 'proxy_ip'
  ) THEN
    ALTER TABLE bot_sessions ADD COLUMN proxy_ip text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_sessions' AND column_name = 'proxy_type'
  ) THEN
    ALTER TABLE bot_sessions ADD COLUMN proxy_type text;
  END IF;
END $$;/*
  # Add Traffic Source Types to Campaigns

  1. Changes to campaigns table
    - Add `traffic_source_distribution` (jsonb) - distribution of traffic sources
      Example: {"direct": 50, "search": 50} means 50% direct, 50% from search
    - Add `search_keywords` (jsonb array) - keywords to use for Google search
      Example: ["brand name", "product category keyword"]

  2. Changes to bot_sessions table
    - Add `traffic_source` (text) - 'direct' or 'search'
    - Add `search_keyword` (text) - keyword used if traffic_source is 'search'
    - Add `referrer` (text) - referrer URL (Google search page for search traffic)

  3. Notes
    - Bots will either visit directly or search Google first then click result
    - Search traffic will have Google as referrer
    - Direct traffic will have no referrer
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'traffic_source_distribution'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN traffic_source_distribution jsonb DEFAULT '{"direct": 50, "search": 50}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'search_keywords'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN search_keywords jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_sessions' AND column_name = 'traffic_source'
  ) THEN
    ALTER TABLE bot_sessions ADD COLUMN traffic_source text DEFAULT 'direct';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_sessions' AND column_name = 'search_keyword'
  ) THEN
    ALTER TABLE bot_sessions ADD COLUMN search_keyword text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_sessions' AND column_name = 'referrer'
  ) THEN
    ALTER TABLE bot_sessions ADD COLUMN referrer text;
  END IF;
END $$;/*
  # Add Proxy Credentials to Campaigns

  1. Changes
    - Add proxy configuration fields to campaigns table:
      - `proxy_username` (text) - Proxy username/customer ID
      - `proxy_password` (text) - Proxy password
      - `proxy_host` (text) - Proxy server hostname
      - `proxy_port` (text) - Proxy server port
    
  2. Notes
    - These fields allow per-campaign proxy configuration
    - Credentials are stored securely in the database
    - Will be used by edge function to configure Luna Proxy connections
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'proxy_username'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN proxy_username text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'proxy_password'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN proxy_password text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'proxy_host'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN proxy_host text DEFAULT 'pr.lunaproxy.com';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'proxy_port'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN proxy_port text DEFAULT '12233';
  END IF;
END $$;/*
  # Add CRX File Support to Campaigns

  1. Changes
    - Add `extension_crx_url` column to campaigns table
      - Stores the Supabase Storage URL for uploaded CRX files
      - Nullable (extensions are optional)
    
  2. Notes
    - CRX files will be uploaded to Supabase Storage
    - The URL will be stored in this column
    - Puppeteer will download and load the extension at runtime
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'extension_crx_url'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN extension_crx_url text;
  END IF;
END $$;/*
  # Setup Campaign Scheduler with pg_cron

  1. Enable pg_cron extension
  2. Create a scheduled job to trigger campaign-scheduler edge function every hour
  3. Add a helper function to invoke the edge function

  ## Notes
  - Runs every hour to process active campaigns
  - Automatically stops campaigns when total sessions reached
*/

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the campaign scheduler edge function
CREATE OR REPLACE FUNCTION trigger_campaign_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get Supabase URL and key from environment or settings
  -- Note: In production, these would be set via Supabase secrets
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Call the edge function using pg_net or http extension
  -- This is a placeholder - actual implementation depends on your setup
  RAISE NOTICE 'Campaign scheduler triggered at %', now();
END;
$$;

-- Schedule the campaign scheduler to run every hour
-- Note: This requires pg_cron to be enabled in your Supabase project
SELECT cron.schedule(
  'campaign-scheduler-hourly',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT trigger_campaign_scheduler();
  $$
);

-- Alternative: Create a simple tracking table for manual triggers
CREATE TABLE IF NOT EXISTS campaign_scheduler_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending',
  result jsonb,
  error text
);

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_scheduler_log_triggered 
  ON campaign_scheduler_log(triggered_at DESC);

-- Enable RLS
ALTER TABLE campaign_scheduler_log ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage logs
CREATE POLICY "Service role can manage scheduler logs"
  ON campaign_scheduler_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);/*
  # Add Bounce Rate to Campaigns

  1. Changes
    - Add `bounce_rate` column to campaigns table (percentage 0-100)
    - Default to 30% bounce rate
    - Add bounce tracking to bot_sessions

  ## Notes
  - Bounce rate determines percentage of sessions that exit after 1-5 seconds
  - Bounced sessions will have minimal interactions
*/

-- Add bounce_rate column to campaigns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'bounce_rate'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN bounce_rate integer DEFAULT 30;
  END IF;
END $$;

-- Add is_bounced column to bot_sessions to track bounced sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_sessions' AND column_name = 'is_bounced'
  ) THEN
    ALTER TABLE bot_sessions ADD COLUMN is_bounced boolean DEFAULT false;
  END IF;
END $$;

-- Add bounce_duration column to track how long bounced sessions stayed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_sessions' AND column_name = 'bounce_duration_ms'
  ) THEN
    ALTER TABLE bot_sessions ADD COLUMN bounce_duration_ms integer;
  END IF;
END $$;

-- Add comment explaining the bounce_rate column
COMMENT ON COLUMN campaigns.bounce_rate IS 'Percentage (0-100) of sessions that should bounce (exit after 1-5 seconds)';
COMMENT ON COLUMN bot_sessions.is_bounced IS 'Whether this session was a bounced session (exited within 1-5 seconds)';
COMMENT ON COLUMN bot_sessions.bounce_duration_ms IS 'Duration in milliseconds for bounced sessions (1000-5000ms)';/*
  # Auto-complete bot sessions based on duration

  1. Function
    - Creates a database function to auto-complete sessions
    - Marks sessions as completed after their calculated duration
    - Runs every minute via pg_cron
  
  2. Security
    - Function runs with elevated privileges to update sessions
*/

-- Create function to auto-complete sessions
CREATE OR REPLACE FUNCTION auto_complete_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Complete sessions that have exceeded their duration
  UPDATE bot_sessions
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE 
    status = 'running'
    AND (
      (is_bounced = true AND EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 >= bounce_duration_ms)
      OR
      (is_bounced = false AND started_at < NOW() - INTERVAL '2 minutes')
    );
    
  -- Mark very old stuck sessions as failed
  UPDATE bot_sessions
  SET 
    status = 'failed',
    error_message = 'Session timeout - exceeded 5 minutes',
    completed_at = NOW()
  WHERE 
    status = 'running'
    AND started_at < NOW() - INTERVAL '5 minutes';
END;
$$;/*
  # Add session duration tracking

  1. Changes
    - Add expected_duration_ms column to bot_sessions
    - Update auto_complete_sessions function to use this duration
  
  2. Notes
    - This allows precise completion timing for each session
*/

-- Add expected duration column
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS expected_duration_ms INTEGER;

-- Update auto-complete function to use expected duration
CREATE OR REPLACE FUNCTION auto_complete_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Complete sessions that have exceeded their expected duration
  UPDATE bot_sessions
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE 
    status = 'running'
    AND expected_duration_ms IS NOT NULL
    AND EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 >= expected_duration_ms;
    
  -- Complete sessions without duration after 2 minutes (fallback)
  UPDATE bot_sessions
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE 
    status = 'running'
    AND expected_duration_ms IS NULL
    AND started_at < NOW() - INTERVAL '2 minutes';
    
  -- Mark very old stuck sessions as failed
  UPDATE bot_sessions
  SET 
    status = 'failed',
    error_message = 'Session timeout - exceeded 5 minutes',
    completed_at = NOW()
  WHERE 
    status = 'running'
    AND started_at < NOW() - INTERVAL '5 minutes';
END;
$$;/*
  # Add Google Search Tracking to Sessions

  1. New Columns
    - `google_search_attempted` (boolean) - Whether the session attempted a Google search
    - `google_search_completed` (boolean) - Whether Google search was successfully completed
    - `google_search_result_clicked` (boolean) - Whether a search result was clicked
    - `google_search_timestamp` (timestamptz) - When Google search page was loaded
    - `target_site_reached_timestamp` (timestamptz) - When target site was reached from Google

  2. Purpose
    - Track the entire Google search funnel
    - Verify sessions are actually going through Google
    - Measure success rate of Google search traffic
    - Debug any issues with search automation

  3. Notes
    - These fields only apply to sessions with traffic_source = 'search'
    - Direct traffic sessions will have all these fields as NULL
    - Helps verify the search automation is working correctly
*/

-- Add tracking columns for Google search verification
ALTER TABLE bot_sessions 
  ADD COLUMN IF NOT EXISTS google_search_attempted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_search_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_search_result_clicked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_search_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS target_site_reached_timestamp timestamptz;

-- Add comments for clarity
COMMENT ON COLUMN bot_sessions.google_search_attempted IS 'Whether the session attempted to perform a Google search';
COMMENT ON COLUMN bot_sessions.google_search_completed IS 'Whether the Google search was successfully executed and results loaded';
COMMENT ON COLUMN bot_sessions.google_search_result_clicked IS 'Whether a search result link was successfully clicked';
COMMENT ON COLUMN bot_sessions.google_search_timestamp IS 'Timestamp when Google search page was loaded';
COMMENT ON COLUMN bot_sessions.target_site_reached_timestamp IS 'Timestamp when target site was reached from search results';

-- Create an index for querying search performance
CREATE INDEX IF NOT EXISTS idx_sessions_google_tracking 
  ON bot_sessions(traffic_source, google_search_attempted, google_search_completed, google_search_result_clicked);/*
  # Add Plugin Usage Tracking to Sessions

  1. New Columns
    - `plugin_loaded` (boolean) - Whether the Chrome extension was successfully loaded
    - `plugin_active` (boolean) - Whether the plugin executed/was active during session
    - `plugin_load_timestamp` (timestamptz) - When the plugin was loaded
    - `plugin_extension_id` (text) - The Chrome extension ID that was used

  2. Purpose
    - Verify that Chrome extensions are being loaded correctly
    - Track which sessions had plugin support
    - Debug plugin loading issues
    - Ensure plugins are functioning during sessions

  3. Notes
    - These fields apply to sessions that have a plugin configured
    - Sessions without plugins will have these fields as NULL/false
    - Helps verify the extension automation is working correctly
*/

-- Add tracking columns for plugin/extension verification
ALTER TABLE bot_sessions 
  ADD COLUMN IF NOT EXISTS plugin_loaded boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS plugin_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS plugin_load_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS plugin_extension_id text;

-- Add comments for clarity
COMMENT ON COLUMN bot_sessions.plugin_loaded IS 'Whether a Chrome extension was successfully loaded in the browser';
COMMENT ON COLUMN bot_sessions.plugin_active IS 'Whether the plugin was active/executed during the session';
COMMENT ON COLUMN bot_sessions.plugin_load_timestamp IS 'Timestamp when the plugin was loaded';
COMMENT ON COLUMN bot_sessions.plugin_extension_id IS 'The Chrome Web Store extension ID that was used';

-- Create an index for querying plugin usage
CREATE INDEX IF NOT EXISTS idx_sessions_plugin_tracking 
  ON bot_sessions(plugin_loaded, plugin_active, plugin_extension_id);/*
  # Add Device Type Tracking

  1. Changes
    - Add `device_type` column to track whether session used mobile or desktop

  2. Purpose
    - Enable tracking of diverse user agents across sessions
    - Provide analytics on mobile vs desktop traffic distribution
*/

-- Add device type column to bot_sessions table
ALTER TABLE bot_sessions
ADD COLUMN IF NOT EXISTS device_type text CHECK (device_type IN ('mobile', 'desktop'));

-- Create index for device type queries
CREATE INDEX IF NOT EXISTS idx_bot_sessions_device_type ON bot_sessions(device_type);

-- Create index for combined campaign and device type queries
CREATE INDEX IF NOT EXISTS idx_bot_sessions_campaign_device ON bot_sessions(campaign_id, device_type);
/*
  # Add clicked URL tracking to bot sessions

  1. Changes
    - Add `google_search_clicked_url` column to store the exact URL clicked from Google search results
    - This helps verify the bot is clicking the correct domain and diagnose organic search tracking issues

  2. Purpose
    - Debug why Google Analytics shows all sessions as direct instead of organic search
    - Verify the correct URL is being clicked from search results
    - Ensure proper referrer tracking for GA
*/

-- Add column to store the URL clicked from Google search
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_sessions' AND column_name = 'google_search_clicked_url'
  ) THEN
    ALTER TABLE bot_sessions ADD COLUMN google_search_clicked_url text;
  END IF;
END $$;/*
  # Add custom referrer override to campaigns

  1. Changes
    - Add `custom_referrer` column to campaigns table
    - Allows hard-setting the referrer for all traffic regardless of source
    - Helps ensure Google Analytics registers organic search traffic correctly

  2. Purpose
    - Override the referrer header sent to target site
    - Force GA to recognize traffic as coming from specific source (e.g., google.com)
    - Useful when Google search clicks aren't properly setting referrer
*/

-- Add custom referrer field to campaigns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'custom_referrer'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN custom_referrer text;
    COMMENT ON COLUMN campaigns.custom_referrer IS 'Custom referrer URL to override for all traffic (e.g., https://www.google.com/)';
  END IF;
END $$;/*
  # Add CAPTCHA tracking to bot_sessions

  1. Changes
    - Add `google_captcha_encountered` boolean column to track when Google shows CAPTCHA
    - Defaults to false
    - Helps identify problematic proxies that get flagged by Google
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_sessions' AND column_name = 'google_captcha_encountered'
  ) THEN
    ALTER TABLE bot_sessions ADD COLUMN google_captcha_encountered boolean DEFAULT false;
  END IF;
END $$;
/*
  # Add Bright Data SERP API Configuration

  1. New Tables
    - `bright_data_serp_config`
      - `id` (uuid, primary key)
      - `user_id` (uuid, unique) - one config per user
      - `api_token` (text) - Bright Data API token
      - `customer_id` (text) - Bright Data customer ID
      - `zone_name` (text) - Zone/proxy zone name
      - `enabled` (boolean) - whether SERP API is enabled
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to campaigns table
    - Add `use_serp_api` (boolean) - whether to use SERP API for this campaign
    - Add `serp_api_provider` (text) - which SERP provider (bright_data, oxylabs, etc.)
    - Defaults to false and regular proxies

  3. Security
    - Enable RLS on `bright_data_serp_config` table
    - Users can only read/update their own configuration
*/

-- Create Bright Data SERP config table
CREATE TABLE IF NOT EXISTS bright_data_serp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  api_token text,
  customer_id text,
  zone_name text DEFAULT 'serp',
  enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bright_data_serp_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own SERP config"
  ON bright_data_serp_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own SERP config"
  ON bright_data_serp_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own SERP config"
  ON bright_data_serp_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own SERP config"
  ON bright_data_serp_config FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add columns to campaigns table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'use_serp_api'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN use_serp_api boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'serp_api_provider'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN serp_api_provider text DEFAULT 'bright_data';
  END IF;
END $$;

-- Add helpful comment
COMMENT ON COLUMN campaigns.use_serp_api IS 'Whether to use SERP API (e.g., Bright Data SERP) instead of regular proxies for Google searches';
COMMENT ON COLUMN campaigns.serp_api_provider IS 'SERP API provider to use: bright_data, oxylabs, smartproxy, etc.';
COMMENT ON TABLE bright_data_serp_config IS 'Configuration for Bright Data SERP API integration';
/*
  # Add password field to Bright Data SERP configuration

  1. Changes
    - Add `api_password` column to `bright_data_serp_config` table
    - This stores the Bright Data zone password for SERP API authentication

  2. Security
    - Password is stored as encrypted text
    - Only accessible by the user who owns the configuration via existing RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bright_data_serp_config' AND column_name = 'api_password'
  ) THEN
    ALTER TABLE bright_data_serp_config ADD COLUMN api_password text;
  END IF;
END $$;
/*
  # Add endpoint and port fields to SERP configuration

  1. Changes to bright_data_serp_config table
    - Add `endpoint` (text) - SERP API endpoint hostname (e.g., brd.superproxy.io)
    - Add `port` (text) - SERP API port (e.g., 33335)
    - Set default values for backward compatibility

  2. Notes
    - Allows users to configure custom endpoints and ports for different SERP providers
    - Defaults to Bright Data SERP API values
    - Ensures flexibility for future SERP API providers
*/

-- Add endpoint and port columns to bright_data_serp_config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bright_data_serp_config' AND column_name = 'endpoint'
  ) THEN
    ALTER TABLE bright_data_serp_config ADD COLUMN endpoint text DEFAULT 'brd.superproxy.io';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bright_data_serp_config' AND column_name = 'port'
  ) THEN
    ALTER TABLE bright_data_serp_config ADD COLUMN port text DEFAULT '33335';
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN bright_data_serp_config.endpoint IS 'SERP API endpoint hostname (e.g., brd.superproxy.io)';
COMMENT ON COLUMN bright_data_serp_config.port IS 'SERP API port number (e.g., 33335 for Bright Data SERP)';
/*
  # Add IP rotation tracking for sessions

  1. New Tables
    - `session_ip_tracking`
      - `id` (uuid, primary key) - Unique identifier
      - `session_id` (uuid) - Reference to bot_sessions
      - `ip_address` (text) - The IP address used
      - `country_code` (text) - Country code (US, UK, etc.)
      - `used_at` (timestamptz) - When this IP was used
      - `campaign_id` (uuid) - Reference to campaign
      - `user_id` (uuid) - Reference to auth.users

  2. Indexes
    - Index on ip_address and used_at for fast lookups
    - Index on campaign_id for filtering by campaign

  3. Security
    - Enable RLS
    - Add policies for authenticated users to access their own IP tracking data

  4. Notes
    - This table tracks IP addresses used in sessions
    - Prevents IP reuse within 1 hour window
    - Helps ensure unique IPs for better traffic simulation
    - IPs older than 1 hour can be reused
*/

-- Create session_ip_tracking table
CREATE TABLE IF NOT EXISTS session_ip_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES bot_sessions(id) ON DELETE CASCADE,
  ip_address text NOT NULL,
  country_code text NOT NULL,
  used_at timestamptz DEFAULT now(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_session_ip_tracking_ip_used_at ON session_ip_tracking(ip_address, used_at);
CREATE INDEX IF NOT EXISTS idx_session_ip_tracking_campaign ON session_ip_tracking(campaign_id);
CREATE INDEX IF NOT EXISTS idx_session_ip_tracking_user ON session_ip_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_session_ip_tracking_country ON session_ip_tracking(country_code, used_at);

-- Enable RLS
ALTER TABLE session_ip_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own IP tracking data
CREATE POLICY "Users can view own IP tracking data"
  ON session_ip_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role can insert IP tracking data
CREATE POLICY "Service role can insert IP tracking data"
  ON session_ip_tracking
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can read all IP tracking data
CREATE POLICY "Service role can read all IP tracking data"
  ON session_ip_tracking
  FOR SELECT
  TO service_role
  USING (true);

-- Add helpful comments
COMMENT ON TABLE session_ip_tracking IS 'Tracks IP addresses used in bot sessions to prevent reuse within 1 hour';
COMMENT ON COLUMN session_ip_tracking.ip_address IS 'The actual IP address used for the session';
COMMENT ON COLUMN session_ip_tracking.used_at IS 'Timestamp when this IP was used (for 1-hour cooldown)';
COMMENT ON COLUMN session_ip_tracking.country_code IS 'Country code for geo-targeting (US, UK, CA, etc.)';
-- Add campaign_type column to campaigns table
-- This separates search campaigns (Browser API) from direct campaigns (Luna Proxy)

ALTER TABLE campaigns 
ADD COLUMN campaign_type TEXT DEFAULT 'direct' 
CHECK (campaign_type IN ('direct', 'search'));

-- Add index for efficient filtering
CREATE INDEX idx_campaigns_campaign_type ON campaigns(campaign_type);

-- Update existing campaigns to have explicit type
-- If they have search keywords, mark as search, otherwise direct
UPDATE campaigns 
SET campaign_type = CASE 
  WHEN search_keywords IS NOT NULL AND jsonb_array_length(search_keywords) > 0 THEN 'search'
  ELSE 'direct'
END;

-- Add comment for documentation
COMMENT ON COLUMN campaigns.campaign_type IS 'Campaign type: "search" uses Browser API for search+click, "direct" uses Luna Proxy for direct navigation';
/*
  # Add Bright Data Browser Automation API Support

  1. Changes to bright_data_serp_config table
    - Add `use_browser_automation` (boolean) - Toggle between SERP API (dual-proxy) vs Browser Automation (single proxy)
    - Add `browser_zone` (text) - Browser Automation zone name (e.g., 'unblocker', 'scraping_browser')
    
  2. How it works
    - When use_browser_automation = false: Uses existing SERP API + Luna dual-proxy flow
    - When use_browser_automation = true: Connects to Bright Data's browser via WebSocket, single proxy for entire session
    
  3. Browser Automation WebSocket Format
    wss://brd-customer-{CUSTOMER_ID}-zone-{ZONE}-country-{COUNTRY}:{PASSWORD}@brd.superproxy.io:9222
*/

-- Add Browser Automation toggle
ALTER TABLE bright_data_serp_config 
ADD COLUMN IF NOT EXISTS use_browser_automation boolean DEFAULT false;

-- Add Browser Automation zone (separate from SERP zone)
ALTER TABLE bright_data_serp_config 
ADD COLUMN IF NOT EXISTS browser_zone text DEFAULT 'unblocker';

-- Add comment explaining the difference
COMMENT ON COLUMN bright_data_serp_config.use_browser_automation IS 
'When true, uses Browser Automation API (single WebSocket proxy). When false, uses SERP API + Luna dual-proxy.';

COMMENT ON COLUMN bright_data_serp_config.browser_zone IS 
'Browser Automation zone name. Common values: unblocker, scraping_browser, residential';

COMMENT ON COLUMN bright_data_serp_config.zone_name IS 
'SERP API zone name (used when use_browser_automation = false). Common values: serp, serp_api1';
/*
  # Add Browser Automation toggle to campaigns

  1. Changes
    - Add use_browser_automation column to campaigns table
    - Allows per-campaign override of Browser Automation setting
    - When null, inherits from bright_data_serp_config.use_browser_automation
    - When set, overrides user-level setting for this specific campaign
*/

-- Add Browser Automation toggle to campaigns
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS use_browser_automation boolean DEFAULT NULL;

COMMENT ON COLUMN campaigns.use_browser_automation IS 
'Per-campaign Browser Automation toggle. NULL = inherit from user config, true/false = override for this campaign.';
-- Add separate Browser Automation credentials to bright_data_serp_config
ALTER TABLE bright_data_serp_config 
ADD COLUMN IF NOT EXISTS browser_username text,
ADD COLUMN IF NOT EXISTS browser_password text;

COMMENT ON COLUMN bright_data_serp_config.browser_username IS 
  'Full Browser Automation username (e.g., brd-customer-hl_a908b07a-zone-unblocker)';
  
COMMENT ON COLUMN bright_data_serp_config.browser_password IS 
  'Password for Browser Automation zone';
-- Add endpoint and port fields for Browser Automation configuration
ALTER TABLE bright_data_serp_config 
ADD COLUMN IF NOT EXISTS browser_endpoint text DEFAULT 'brd.superproxy.io',
ADD COLUMN IF NOT EXISTS browser_port text DEFAULT '9222';

-- Add comments for documentation
COMMENT ON COLUMN bright_data_serp_config.browser_endpoint IS 'WebSocket endpoint for Bright Data Browser Automation (default: brd.superproxy.io)';
COMMENT ON COLUMN bright_data_serp_config.browser_port IS 'WebSocket port for Bright Data Browser Automation (default: 9222)';
-- Add browser_ws_endpoint column to bright_data_serp_config
ALTER TABLE bright_data_serp_config ADD COLUMN browser_ws_endpoint text;-- Add API token field for Bright Data HTTP API
-- This is different from browser_password (WebSocket auth)
-- API token is a 64-char hex string used with Bearer authentication

ALTER TABLE bright_data_serp_config 
ADD COLUMN IF NOT EXISTS browser_api_token text;

COMMENT ON COLUMN bright_data_serp_config.browser_api_token IS 
  'API token for Bright Data HTTP API (64-char hex). Used as Bearer token for api.brightdata.com/request endpoint.';
-- Adds a toggle to run Google search + click via Luna proxy for search traffic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'use_luna_proxy_search'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN use_luna_proxy_search boolean DEFAULT false;
    COMMENT ON COLUMN campaigns.use_luna_proxy_search IS 'Force Google search via Luna proxy for search traffic when true';
  END IF;
END $$;
-- Add complete Browser API configuration fields to bright_data_serp_config
ALTER TABLE bright_data_serp_config 
ADD COLUMN IF NOT EXISTS browser_customer_id text,
ADD COLUMN IF NOT EXISTS browser_endpoint text DEFAULT 'brd.superproxy.io',
ADD COLUMN IF NOT EXISTS browser_port text DEFAULT '9222',
ADD COLUMN IF NOT EXISTS browser_zone text;

COMMENT ON COLUMN bright_data_serp_config.browser_customer_id IS 
  'Bright Data customer ID (e.g., hl_a908b07a)';
  
COMMENT ON COLUMN bright_data_serp_config.browser_endpoint IS 
  'Browser API endpoint (default: brd.superproxy.io)';
  
COMMENT ON COLUMN bright_data_serp_config.browser_port IS 
  'Browser API port (default: 9222 for WebSocket)';

COMMENT ON COLUMN bright_data_serp_config.browser_zone IS 
  'Browser API zone name (e.g., scraping_browser1, unblocker)';
-- Add site_structure JSON column to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS site_structure JSONB;

-- Add index for site structure queries
CREATE INDEX IF NOT EXISTS idx_campaigns_site_structure ON campaigns USING GIN (site_structure);

-- Add trace_timestamp to track when structure was analyzed
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS site_structure_traced_at TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN campaigns.site_structure IS 'Pre-mapped website structure including navigable pages, forms, content areas, and internal links';
COMMENT ON COLUMN campaigns.site_structure_traced_at IS 'Timestamp when website structure was analyzed';

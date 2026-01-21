-- ============================================================================
-- TRAFFIC TOOL - COMPLETE DATABASE SCHEMA
-- Apply this ONCE in Supabase SQL Editor
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CAMPAIGNS TABLE (Main configuration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 10,
  concurrent_bots INTEGER NOT NULL DEFAULT 2,
  session_duration_min INTEGER NOT NULL DEFAULT 30,
  session_duration_max INTEGER NOT NULL DEFAULT 120,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Geo & Proxy settings
  target_geo_locations JSONB DEFAULT '["US"]'::jsonb,
  use_residential_proxies BOOLEAN DEFAULT TRUE,
  proxy_provider TEXT DEFAULT 'luna',
  proxy_username TEXT,
  proxy_password TEXT,
  proxy_host TEXT DEFAULT 'pr.lunaproxy.com',
  proxy_port TEXT DEFAULT '12233',
  
  -- Distribution settings
  total_users INTEGER DEFAULT 100,
  distribution_period_hours INTEGER DEFAULT 24,
  distribution_pattern TEXT DEFAULT 'uniform',
  sessions_per_hour NUMERIC DEFAULT 4.17,
  
  -- Traffic source settings
  traffic_source_distribution JSONB DEFAULT '{"direct": 50, "search": 50}'::jsonb,
  search_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Intelligent traffic settings
  bounce_rate INTEGER DEFAULT 30,
  min_pages_per_session INTEGER DEFAULT 1,
  max_pages_per_session INTEGER DEFAULT 3,
  debug_mode BOOLEAN DEFAULT FALSE,
  
  -- Extension & referrer
  extension_crx_url TEXT,
  custom_referrer TEXT,
  
  -- API configs
  use_serp_api BOOLEAN DEFAULT FALSE,
  serp_api_provider TEXT DEFAULT 'bright_data',
  use_browser_automation BOOLEAN DEFAULT FALSE,
  use_luna_proxy_search BOOLEAN DEFAULT FALSE,
  use_luna_headful_direct BOOLEAN DEFAULT FALSE,
  campaign_type TEXT DEFAULT 'direct',
  
  -- Site structure (NEW)
  site_structure JSONB,
  site_structure_traced_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_site_structure ON campaigns USING GIN (site_structure);

-- ============================================================================
-- 2. BOT_SESSIONS TABLE (Session tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  geo_location TEXT,
  user_agent TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Session details
  session_duration_sec INTEGER,
  auto_completed BOOLEAN DEFAULT FALSE,
  google_search_completed BOOLEAN DEFAULT FALSE,
  google_result_clicked BOOLEAN DEFAULT FALSE,
  target_site_reached BOOLEAN DEFAULT FALSE,
  plugin_injected BOOLEAN DEFAULT FALSE,
  plugin_active BOOLEAN DEFAULT FALSE,
  device_type TEXT DEFAULT 'desktop',
  clicked_url TEXT,
  captcha_detected BOOLEAN DEFAULT FALSE,
  captcha_solved BOOLEAN DEFAULT FALSE,
  
  -- IP tracking
  assigned_ip TEXT,
  ip_rotation_count INTEGER DEFAULT 0,
  last_ip_rotation_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bot_sessions_campaign_id ON bot_sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_status ON bot_sessions(status);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_started_at ON bot_sessions(started_at DESC);

-- ============================================================================
-- 3. PERFORMANCE_METRICS TABLE (Performance tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES bot_sessions(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_session_id ON performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_metric_name ON performance_metrics(metric_name);

-- ============================================================================
-- 4. USER_JOURNEYS TABLE (User interaction paths)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_journeys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  selector TEXT,
  value TEXT,
  wait_before INTEGER DEFAULT 0,
  wait_after INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_journeys_campaign_id ON user_journeys(campaign_id);

-- ============================================================================
-- 5. BROWSER_PLUGINS TABLE (Browser extensions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS browser_plugins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  plugin_name TEXT NOT NULL,
  plugin_url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_browser_plugins_campaign_id ON browser_plugins(campaign_id);

-- ============================================================================
-- 6. SESSION_LOGS TABLE (Detailed session logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  log_entries JSONB NOT NULL,
  total_logs INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_logs_campaign_id ON session_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_session_id ON session_logs(session_id);

-- ============================================================================
-- 7. SERP_CONFIGS TABLE (SERP API configurations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS serp_configs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id TEXT,
  zone_name TEXT,
  username TEXT,
  password TEXT,
  endpoint TEXT DEFAULT 'brd.superproxy.io',
  port TEXT DEFAULT '33335',
  
  -- Browser API credentials
  browser_customer_id TEXT,
  browser_zone TEXT DEFAULT 'unblocker',
  browser_username TEXT,
  browser_password TEXT,
  browser_api_token TEXT,
  browser_endpoint TEXT DEFAULT 'brd.superproxy.io',
  browser_port TEXT DEFAULT '9222',
  browser_ws_endpoint TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serp_configs_user_id ON serp_configs(user_id);

-- ============================================================================
-- 8. RPC FUNCTION: Auto-complete stale sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_complete_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE bot_sessions
  SET 
    status = 'completed',
    completed_at = NOW(),
    auto_completed = TRUE
  WHERE 
    status = 'running'
    AND started_at < NOW() - INTERVAL '10 minutes';
END;
$$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'campaigns' ORDER BY column_name;


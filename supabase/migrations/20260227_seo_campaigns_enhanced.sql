-- ============================================================================
-- SEO+ CAMPAIGNS - ENHANCED FEATURES
-- Add advanced campaign planning features for professional SEO ranking boost
-- ============================================================================

-- Add advanced campaign configuration columns
ALTER TABLE seo_campaigns 
  ADD COLUMN IF NOT EXISTS device_mix JSONB DEFAULT '{"desktop": 60, "mobile": 30, "tablet": 10}'::jsonb,
  ADD COLUMN IF NOT EXISTS impression_ratio INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_serp_pages INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS click_delay_min INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS click_delay_max INTEGER DEFAULT 45,
  ADD COLUMN IF NOT EXISTS session_duration_min INTEGER DEFAULT 45,
  ADD COLUMN IF NOT EXISTS session_duration_max INTEGER DEFAULT 180,
  ADD COLUMN IF NOT EXISTS bounce_rate_target INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS pages_per_session_min INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pages_per_session_max INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS geo_targets JSONB DEFAULT '["US"]'::jsonb,
  ADD COLUMN IF NOT EXISTS search_engines JSONB DEFAULT '["google"]'::jsonb,
  ADD COLUMN IF NOT EXISTS time_distribution JSONB DEFAULT '{"business_hours": 70, "evening": 20, "night": 10}'::jsonb,
  ADD COLUMN IF NOT EXISTS behavior_pattern TEXT DEFAULT 'natural',
  ADD COLUMN IF NOT EXISTS scroll_depth_target INTEGER DEFAULT 75,
  ADD COLUMN IF NOT EXISTS engagement_level TEXT DEFAULT 'medium';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_seo_campaigns_device_mix ON seo_campaigns USING GIN (device_mix);
CREATE INDEX IF NOT EXISTS idx_seo_campaigns_geo_targets ON seo_campaigns USING GIN (geo_targets);
CREATE INDEX IF NOT EXISTS idx_seo_campaigns_time_distribution ON seo_campaigns USING GIN (time_distribution);

-- Add project-level settings
ALTER TABLE seo_projects
  ADD COLUMN IF NOT EXISTS avg_rank_target INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS search_engines JSONB DEFAULT '["google", "bing"]'::jsonb,
  ADD COLUMN IF NOT EXISTS device_preferences JSONB DEFAULT '{"desktop": 60, "mobile": 30, "tablet": 10}'::jsonb,
  ADD COLUMN IF NOT EXISTS serp_features JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tracked_competitors TEXT[],
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "rank_change": 5}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_campaign_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_campaign_trigger_rank INTEGER DEFAULT 11;

-- Add indexes for project settings
CREATE INDEX IF NOT EXISTS idx_seo_projects_search_engines ON seo_projects USING GIN (search_engines);
CREATE INDEX IF NOT EXISTS idx_seo_projects_device_preferences ON seo_projects USING GIN (device_preferences);
CREATE INDEX IF NOT EXISTS idx_seo_projects_auto_campaign ON seo_projects(auto_campaign_enabled, auto_campaign_trigger_rank);

-- Add enhanced click session tracking
ALTER TABLE seo_click_sessions
  ADD COLUMN IF NOT EXISTS keyword_id UUID REFERENCES seo_keywords(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS serp_page_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS serp_position INTEGER,
  ADD COLUMN IF NOT EXISTS search_impression_only BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rank_at_time INTEGER,
  ADD COLUMN IF NOT EXISTS bounced BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS scroll_depth INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mouse_movements INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keyboard_events INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_score NUMERIC(3,2) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS viewport_width INTEGER,
  ADD COLUMN IF NOT EXISTS viewport_height INTEGER,
  ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER;

-- Add indexes for session analytics
CREATE INDEX IF NOT EXISTS idx_seo_click_sessions_keyword_id ON seo_click_sessions(keyword_id);
CREATE INDEX IF NOT EXISTS idx_seo_click_sessions_serp_page ON seo_click_sessions(serp_page_number, serp_position);
CREATE INDEX IF NOT EXISTS idx_seo_click_sessions_impression_only ON seo_click_sessions(search_impression_only);
CREATE INDEX IF NOT EXISTS idx_seo_click_sessions_device_geo ON seo_click_sessions(device_type, geo_location);
CREATE INDEX IF NOT EXISTS idx_seo_click_sessions_executed_at ON seo_click_sessions(executed_at DESC);

-- Add campaign analytics function
CREATE OR REPLACE FUNCTION get_campaign_analytics(campaign_uuid UUID)
RETURNS TABLE (
  total_sessions BIGINT,
  total_clicks BIGINT,
  total_impressions BIGINT,
  avg_serp_position NUMERIC,
  avg_session_duration NUMERIC,
  device_breakdown JSONB,
  geo_breakdown JSONB,
  hourly_distribution JSONB,
  engagement_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_sessions,
    COUNT(*) FILTER (WHERE NOT search_impression_only)::BIGINT as total_clicks,
    COUNT(*) FILTER (WHERE search_impression_only)::BIGINT as total_impressions,
    AVG(serp_position) as avg_serp_position,
    AVG(session_duration_sec) as avg_session_duration,
    jsonb_object_agg(device_type, device_count) as device_breakdown,
    jsonb_object_agg(geo_location, geo_count) as geo_breakdown,
    jsonb_object_agg(hour, hour_count) as hourly_distribution,
    AVG(engagement_score) as engagement_score
  FROM (
    SELECT 
      device_type,
      COUNT(*) as device_count,
      geo_location,
      COUNT(*) as geo_count,
      EXTRACT(HOUR FROM executed_at) as hour,
      COUNT(*) as hour_count,
      session_duration_sec,
      serp_position,
      search_impression_only,
      engagement_score
    FROM seo_click_sessions
    WHERE campaign_id = campaign_uuid
    GROUP BY device_type, geo_location, hour, session_duration_sec, serp_position, search_impression_only, engagement_score
  ) sub;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON COLUMN seo_campaigns.device_mix IS 'Device distribution percentage: {"desktop": 60, "mobile": 30, "tablet": 10}';
COMMENT ON COLUMN seo_campaigns.impression_ratio IS 'Percentage of searches WITHOUT clicks (impressions only) to simulate natural behavior';
COMMENT ON COLUMN seo_campaigns.max_serp_pages IS 'Maximum SERP pages to search if target not found on page 1';
COMMENT ON COLUMN seo_campaigns.click_delay_min IS 'Minimum seconds between search and click (anti-detection)';
COMMENT ON COLUMN seo_campaigns.click_delay_max IS 'Maximum seconds between search and click (randomization)';
COMMENT ON COLUMN seo_campaigns.behavior_pattern IS 'natural, aggressive, conservative - affects timing and engagement patterns';
COMMENT ON COLUMN seo_campaigns.scroll_depth_target IS 'Target scroll depth percentage (0-100) to simulate reading content';
COMMENT ON COLUMN seo_campaigns.engagement_level IS 'low, medium, high - affects mouse movements, clicks, time on site';

COMMENT ON COLUMN seo_click_sessions.search_impression_only IS 'True if session only searched without clicking (impression generation)';
COMMENT ON COLUMN seo_click_sessions.serp_page_number IS 'Which SERP page the result was found/clicked (1, 2, 3, etc)';
COMMENT ON COLUMN seo_click_sessions.serp_position IS 'Position on the SERP page (1-10 typically)';
COMMENT ON COLUMN seo_click_sessions.engagement_score IS 'Calculated engagement score 0.0-1.0 based on scroll, time, interactions';
COMMENT ON COLUMN seo_click_sessions.execution_time_ms IS 'Total time to execute the session in milliseconds';

COMMENT ON COLUMN seo_projects.avg_rank_target IS 'Target average ranking position goal';
COMMENT ON COLUMN seo_projects.auto_campaign_enabled IS 'Automatically create campaigns when keywords drop below trigger rank';
COMMENT ON COLUMN seo_projects.auto_campaign_trigger_rank IS 'Rank threshold that triggers automatic campaign creation';

-- Create view for campaign performance dashboard
CREATE OR REPLACE VIEW seo_campaign_performance AS
SELECT 
  c.id as campaign_id,
  c.name as campaign_name,
  c.status,
  c.total_clicks_goal,
  c.daily_click_budget,
  c.device_mix,
  c.impression_ratio,
  c.geo_targets,
  c.created_at,
  c.started_at,
  c.completed_at,
  p.name as project_name,
  p.website_url,
  k.keyword,
  k.current_rank,
  k.target_rank,
  COUNT(s.id) FILTER (WHERE s.search_impression_only = false) as clicks_delivered,
  COUNT(s.id) FILTER (WHERE s.search_impression_only = true) as impressions_delivered,
  AVG(s.session_duration_sec) as avg_session_duration,
  AVG(s.engagement_score) as avg_engagement,
  COUNT(s.id) FILTER (WHERE s.device_type = 'desktop') as desktop_sessions,
  COUNT(s.id) FILTER (WHERE s.device_type = 'mobile') as mobile_sessions,
  COUNT(s.id) FILTER (WHERE s.device_type = 'tablet') as tablet_sessions,
  COUNT(DISTINCT s.geo_location) as geo_diversity,
  MIN(s.rank_at_time) as best_rank_during_campaign,
  MAX(s.rank_at_time) as worst_rank_during_campaign
FROM seo_campaigns c
JOIN seo_projects p ON c.project_id = p.id
JOIN seo_keywords k ON c.keyword_id = k.id
LEFT JOIN seo_click_sessions s ON c.id = s.campaign_id
GROUP BY c.id, c.name, c.status, c.total_clicks_goal, c.daily_click_budget, 
         c.device_mix, c.impression_ratio, c.geo_targets, c.created_at, 
         c.started_at, c.completed_at, p.name, p.website_url, 
         k.keyword, k.current_rank, k.target_rank;

-- Grant permissions on view
ALTER VIEW seo_campaign_performance OWNER TO postgres;
GRANT SELECT ON seo_campaign_performance TO authenticated;

